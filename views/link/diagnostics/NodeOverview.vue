<template>
  <RuntimeMetricsPanel :metrics="resourceMetrics" :charts="view.charts.value" :state="state" :history-state="view.historyState.value" :range="historyRange" @range-change="selectRange" @refresh="refreshOverview">
    <template #metrics><NodeBottleneckHints :issues="bottlenecks" :access="{ jvm: view.access.value.threads || view.access.value.jfr || view.access.value.heap, monitor: view.access.value.monitor, query: view.access.value.query }" @inspect="inspectIssue" /><div v-if="view.access.value.query" class="node-resource-fallback"><NodeResourceSummary :live="live" :metrics="resourceMetrics" /></div><NodeOperationalSignals v-if="view.access.value.monitor" :trends="trends" :communication="communication" :config="deviceRuntimeConfig" @configure="configureDeviceRuntime" :signals="view.operational.signals.value" :state="view.operational.state.value" @session="emit('session')" @inspect="value => emit('inspect', value)" /><RuntimeMBeanOverview v-if="view.access.value.monitor" :beans="view.bufferBeans.value" :history="view.bufferHistory.value" :state="view.bufferState.value" :show-lifetime="false" :config="bufferConfig" :reset-access="view.bufferResetAccess.value" :reset-state="view.bufferReset.state.value" @reset="view.bufferReset.reset" @update:config="configureBuffer" @refresh="view.refreshBuffers" @settings="emit('settings')" @inspect="value => emit('inspect', value)" /><span ref="historyAnchor" class="node-history-anchor" /></template>
  </RuntimeMetricsPanel>
</template>
<script setup lang="ts">
import { computed, ref, toRef, type PropType } from 'vue'
import dayjs from 'dayjs'
import { RuntimeMetricsPanel, RuntimeMBeanOverview, type TimeWindow, type BufferDisplayConfig } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { useNodeMetricsContext } from './useNodeMetrics'
import NodeResourceSummary from './NodeResourceSummary.vue'
import { useDiagnosticPreferences } from './useDiagnosticPreferences'
import NodeOperationalSignals from './NodeOperationalSignals.vue'
import { useOverviewTrends } from './overview/useOverviewTrends'
import NodeBottleneckHints from './diagnosis/NodeBottleneckHints.vue'
import type { Bottleneck } from './diagnosis/bottleneckRules'
import { useClusterSessionContext } from '../RuntimeMonitor/useClusterSessions'
import type { DiagnosticNodePreference } from './preferences'
const props = defineProps({ nodeId: { type: String, required: true }, live: { type: Object as PropType<RealtimeNode>, default: undefined }, stale: { type: Boolean, default: false }, bottlenecks: { type: Array as PropType<Bottleneck[]>, default: () => [] } })
const emit = defineEmits<{ (event: 'inspect', objectName: string): void; (event: 'diagnose', target: Bottleneck['target']): void; (event: 'settings' | 'session'): void }>()
const historyAnchor = ref<HTMLElement>()
function inspectIssue(target: Bottleneck['target']) { if (target.tool === 'overview') historyAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }); else emit('diagnose', target) }
const view = useNodeMetricsContext(toRef(props, 'nodeId'), computed(() => true))
const trends = useOverviewTrends(toRef(props, 'nodeId'), view.operational.cache)
const resourceMetrics = computed((previous: typeof view.metrics.value | undefined) => {
  const next = view.metrics.value.filter(metric => !['startTime', 'uptime'].includes(metric.key))
  return previous && next.length === previous.length && next.every((metric, index) => metric.value === previous[index].value && metric.label === previous[index].label) ? previous : next
})
const preferences = useDiagnosticPreferences()
const sessions = useClusterSessionContext()
const communication = computed(() => sessions?.snapshots.value.get(props.nodeId)?.communication)
const deviceRuntimeConfig = computed(() => preferences?.value.value.nodes[props.nodeId] ?? {})
function configureDeviceRuntime(value: Partial<DiagnosticNodePreference>) { preferences?.updateNode(props.nodeId, value) }
const bufferConfig = computed<BufferDisplayConfig>(() => { const saved = preferences?.value.value.nodes[props.nodeId]; return { filter: saved?.bufferFilter ?? 'all', objectName: saved?.bufferObjectName, view: saved?.bufferView ?? 'backlog', visibleObjectNames: saved?.bufferVisibleObjectNames, scale: saved?.bufferScale ?? 'linear', grouping: saved?.bufferGrouping ?? 'aggregate' } })
const historyRange = computed(() => ({ from: view.range.value[0].valueOf(), to: view.range.value[1].valueOf() }))
const state = computed(() => props.stale && view.access.value.query ? { status: 'stale' as const } : { status: 'ready' as const })
function configureBuffer(config: BufferDisplayConfig) { preferences?.updateNode(props.nodeId, { bufferFilter: config.filter, bufferObjectName: config.objectName, bufferView: config.view, bufferVisibleObjectNames: config.visibleObjectNames, bufferScale: config.scale, bufferGrouping: config.grouping }) }
function refreshOverview() { view.refresh() }
function selectRange(value: TimeWindow) { if (view.access.value.query && Number.isFinite(value.from) && value.to > value.from && (value.from !== historyRange.value.from || value.to !== historyRange.value.to)) view.range.value = [dayjs(value.from), dayjs(value.to)] }
</script>
<style scoped>
.node-resource-fallback { min-width:0; }
.node-history-anchor { display:block; scroll-margin-block-start:var(--space-3,12px); }
</style>
