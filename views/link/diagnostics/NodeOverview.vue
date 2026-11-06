<template>
  <div ref="root" class="node-overview">
    <NodeBottleneckHints :issues="bottlenecks" :access="{ jvm: view.access.value.threads || view.access.value.jfr || view.access.value.heap, monitor: view.access.value.monitor, query: view.access.value.query }" @inspect="inspectIssue" />
    <a-skeleton v-if="!dashboard" active :paragraph="{ rows: 6 }" />
    <DashBoardCanvas v-if="dashboard" :key="`${scopeKey}:${nodeId}:${layout}`" :model-value="dashboard" :catalog="catalog" :editable="false" layout-editable :preview-mode="false" :storage-key="layoutKey" :aria-busy="initialLoading">
      <template #widget="{ widget }">
        <a-skeleton v-if="initialLoading" class="node-overview-skeleton" active :paragraph="{ rows: widget.type === 'summary' ? 1 : 4 }" />
        <NodeRuntimeSummary v-else-if="widget.type === 'summary'" :metric="nodeOverviewSummaryMetric(widget.id)" :communication="communication" :recording="recording.view.value" :session="trends.find(trend => trend.key === 'sessions')" :buffer="bufferSnapshot" :live="live" :stale="stale" />
        <section v-else class="node-overview-group" :data-overview-group="widget.type" tabindex="-1">
        <NodeOperationalSignals v-if="widget.type === 'device'" compact :active="active" :trends="trends" :communication="communication" :recording="recording.view.value" :config="deviceRuntimeConfig" @retry-recording="recording.refresh" @peak="selectPeak" @live="recording.live" @configure="configureDeviceRuntime" :signals="view.operational.signals.value" :state="view.operational.state.value" @session="emit('session')" @inspect="value => emit('inspect', value)" />
        <RuntimeMBeanOverview v-else-if="widget.type === 'buffer'" compact :beans="view.bufferBeans.value" :history="view.bufferHistory.value" :state="view.bufferState.value" :show-lifetime="false" :config="bufferConfig" :reset-access="view.bufferResetAccess.value" :reset-state="view.bufferReset.state.value" @reset="view.bufferReset.reset" @update:config="configureBuffer" @refresh="view.refreshBuffers" @settings="emit('settings')" @inspect="value => emit('inspect', value)">
          <template #buffer-details><NodeBufferHistory :beans="view.bufferBeans.value" :history="view.bufferHistory.value" :node-id="nodeId" :scope-key="scopeKey" :active="active" :permitted="view.access.value.monitor" :reset-access="view.bufferResetAccess.value" :reset-state="view.bufferReset.state.value" @reset="view.bufferReset.reset" @inspect="value => emit('inspect', value)" /></template>
        </RuntimeMBeanOverview>
        <div v-else ref="historyAnchor" class="node-history-anchor"><RuntimeMetricsPanel compact :expanded="resourcesExpanded" :initial-chart-keys="['cpu', 'memory']" :chart-capacity="resourceCapacity" :charts="view.charts.value" :state="state" :history-state="view.historyState.value" :range="historyRange" @range-change="selectRange" @refresh="refreshOverview" @update:expanded="resourcesExpanded = $event">
          <template #metrics />
          <template #default="{ expanded }"><NodeResourceSummary :compact="!expanded" :live="live" :metrics="resourceMetrics" /></template>
        </RuntimeMetricsPanel></div>
      </section></template>
    </DashBoardCanvas>
    <RuntimeMBeanExtensions v-if="view.access.value.monitor" :entries="extensions.entries.value" :target="nodeId" :active="active" @refresh="extensions.refresh" @inspect="value => emit('inspect', value)" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, toRef, type PropType } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Skeleton as ASkeleton } from 'ant-design-vue'
import { DashBoardCanvas } from '@jetlinks-web-core/components/DashBoardCanvas'
import { nodeOverviewCatalog, nodeOverviewDashboard, nodeOverviewLayout, nodeOverviewLayoutKey, nodeOverviewSummaryMetric, nodeResourceChartCapacity, type NodeOverviewGroup, type NodeOverviewLayout } from './overview/nodeOverviewDashboard'
import './overview/nodeOverviewDashboard.css'
import { RuntimeMetricsPanel, RuntimeMBeanOverview, RuntimeMBeanExtensions, type TimeWindow, type BufferDisplayConfig } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { useNodeMetricsContext } from './useNodeMetrics'
import { useNodeMBeanOverviews } from './useNodeMBeanOverviews'
import NodeResourceSummary from './NodeResourceSummary.vue'
import NodeRuntimeSummary from './overview/NodeRuntimeSummary.vue'
import NodeBufferHistory from './NodeBufferHistory.vue'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import NodeOperationalSignals from './NodeOperationalSignals.vue'
import { useOverviewTrends } from './overview/useOverviewTrends'
import NodeBottleneckHints from './diagnosis/NodeBottleneckHints.vue'
import type { Bottleneck } from './diagnosis/bottleneckRules'
import { useClusterSessionContext } from '../RuntimeMonitor/useClusterSessions'
import { useClusterBufferContext } from '../RuntimeMonitor/useClusterBuffers'
import type { DiagnosticNodePreference } from './preferences'
import { useDeviceMessageRecording } from '../RuntimeMonitor/device-runtime/useDeviceMessageRecording'
import type { DevicePeakSelection } from '../RuntimeMonitor/device-runtime/deviceMessageRecording'
const props = defineProps({ nodeId: { type: String, required: true }, active: { type: Boolean, default: true }, scopeKey: { type: String, default: '' }, live: { type: Object as PropType<RealtimeNode>, default: undefined }, stale: { type: Boolean, default: false }, bottlenecks: { type: Array as PropType<Bottleneck[]>, default: () => [] } })
const emit = defineEmits<{ (event: 'inspect', objectName: string): void; (event: 'diagnose', target: Bottleneck['target']): void; (event: 'settings' | 'session'): void }>()
const { t } = useI18n(), root = ref<HTMLElement>(), { width } = useElementSize(root)
// 缓存页隐藏时尺寸会归零；首次测量后保留最后档位，避免切节点重建画布。
const layout = computed<NodeOverviewLayout | undefined>(previous => width.value > 0 ? nodeOverviewLayout(width.value) : previous)
const resourcesExpanded = ref(false)
const catalog = computed(() => nodeOverviewCatalog(t))
const historyAnchor = ref<HTMLElement>()
const resourceSize = useElementSize(historyAnchor)
const resourceCapacity = computed((previous: number | undefined) => resourceSize.width.value > 0 && resourceSize.height.value > 0
  ? nodeResourceChartCapacity(resourceSize.width.value, resourceSize.height.value) : previous ?? 2)
function inspectIssue(target: Bottleneck['target']) { if (target.tool === 'overview') historyAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else emit('diagnose', target) }
const view = useNodeMetricsContext(toRef(props, 'nodeId'), computed(() => true))
const extensions = useNodeMBeanOverviews(toRef(props, 'nodeId'), toRef(props, 'active'), toRef(props, 'scopeKey'), computed(() => view.access.value.monitor))
const trends = useOverviewTrends(toRef(props, 'nodeId'), view.operational.cache)
const resourceMetrics = computed((previous: typeof view.metrics.value | undefined) => {
  const next = view.metrics.value.filter(metric => !['startTime', 'uptime'].includes(metric.key))
  return previous && next.length === previous.length && next.every((metric, index) => metric.value === previous[index].value && metric.label === previous[index].label) ? previous : next
})
const preferences = useDiagnosticPreferences()
const sessions = useClusterSessionContext()
const communication = computed(() => sessions?.snapshots.value.get(props.nodeId)?.communication)
const buffers = useClusterBufferContext()
const bufferSnapshot = computed(() => buffers?.snapshots.value.get(props.nodeId))
// 仅等待尚无证据的首轮加载；缓存刷新由原有状态保留正文，失败或能力缺失不阻塞展示。
const initialLoading = computed(() => {
  const buffer = view.bufferState.value, session = sessions?.snapshots.value.get(props.nodeId)?.state
  return view.access.value.query && view.historyState.value.status === 'loading'
    || view.access.value.monitor && (buffer.status === 'loading' && buffer.sampledAt === undefined
      || session?.status === 'loading' && session.sampledAt === undefined)
})
// 只跟踪能力集合与宽窄模式，普通采样不能重建画布配置或恢复坐标。
const availableGroups = computed(() => [
  ...(view.access.value.monitor && (trends.value.length > 0 || communication.value?.supported === true || view.operational.signals.value.length > 0) ? ['device'] : []),
  ...(view.access.value.monitor && (view.bufferBeans.value.length > 0 || !['ready', 'empty', 'unsupported'].includes(view.bufferState.value.status)) ? ['buffer'] : []),
  ...(view.access.value.query ? ['resources'] : []),
].join(','))
const dashboard = computed(() => layout.value ? nodeOverviewDashboard(layout.value, availableGroups.value.split(',') as NodeOverviewGroup[], resourcesExpanded.value) : undefined)
const layoutKey = computed(() => layout.value ? nodeOverviewLayoutKey(preferences?.key.value, props.nodeId, layout.value) : undefined)
const recording = useDeviceMessageRecording(toRef(props, 'nodeId'), computed(() => props.active && view.access.value.monitor && communication.value?.supported === true), toRef(props, 'scopeKey'), computed(() => preferences?.value.value.bufferIntervalSeconds), computed(() => communication.value?.history.findLast(point => point.startTime !== undefined)?.startTime))
/** 定位同一真实时刻，设备曲线与资源历史共享排查范围。 */
function selectPeak(selection: DevicePeakSelection) { void recording.select(selection); selectRange({ from: selection.peak.timestamp - 60000, to: selection.peak.timestamp + 60000 }) }
const deviceRuntimeConfig = computed(() => preferences?.value.value.nodes[props.nodeId] ?? {})
function configureDeviceRuntime(value: Partial<DiagnosticNodePreference>) { preferences?.updateNode(props.nodeId, value) }
const bufferConfig = computed<BufferDisplayConfig>(() => { const saved = preferences?.value.value.nodes[props.nodeId]; return { filter: saved?.bufferFilter ?? 'all', objectName: saved?.bufferObjectName, view: saved?.bufferView ?? 'backlog', visibleObjectNames: saved?.bufferVisibleObjectNames, scale: saved?.bufferScale ?? 'linear', grouping: saved?.bufferGrouping ?? 'aggregate' } })
const historyRange = computed(() => ({ from: view.range.value[0].valueOf(), to: view.range.value[1].valueOf(), relativeSeconds: view.relativeSeconds.value }))
const state = computed(() => props.stale && view.access.value.query ? { status: 'stale' as const } : { status: 'ready' as const })
function configureBuffer(config: BufferDisplayConfig) { preferences?.updateNode(props.nodeId, { bufferFilter: config.filter, bufferObjectName: config.objectName, bufferView: config.view, bufferVisibleObjectNames: config.visibleObjectNames, bufferScale: config.scale, bufferGrouping: config.grouping }) }
function refreshOverview() { view.refresh(); void extensions.refresh() }
function selectRange(value: TimeWindow) { if (view.access.value.query && Number.isFinite(value.from) && value.to > value.from && (value.from !== historyRange.value.from || value.to !== historyRange.value.to || value.relativeSeconds !== historyRange.value.relativeSeconds)) view.selectRange(value) }
</script>
<style scoped>
.node-overview { min-width:0; container-type:inline-size; }
.node-overview-skeleton { box-sizing:border-box; height:100%; padding:20px 12px; overflow:hidden; }
.node-history-anchor { scroll-margin-block-start:var(--space-3,12px); }
.node-overview :deep(.dashboard-card-layout),.node-overview :deep(.dashboard-card-content) { height:auto; overflow-x:clip; overflow-y:visible; }
.node-overview :deep(.dashboard-card-content) { scrollbar-gutter:auto; }.node-overview :deep(.dashboard-grid) { min-height:0; }
.node-overview :deep(.history-toolbar) { margin-top:0; }
</style>
