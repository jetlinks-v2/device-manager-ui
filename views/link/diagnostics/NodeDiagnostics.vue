<template>
  <section class="node-diagnostics" :class="{ 'node-diagnostics--overview': tab === 'overview', 'node-diagnostics--logs': tab === 'logs', 'node-diagnostics--jvm': tab === 'jvm' }">
    <header>
      <div class="node-header-info">
        <slot name="node-leading" />
        <slot name="node-name"><a-tooltip :title="sampledAt ? t('runtimeDiagnostics.updatedAt', { time: sampledAt }) : undefined" :trigger="['hover', 'focus']"><strong :tabindex="sampledAt ? 0 : undefined" :aria-label="sampledAt ? `${nodeId} · ${t('runtimeDiagnostics.updatedAt', { time: sampledAt })}` : nodeId">{{ nodeId }}</strong></a-tooltip></slot>
        <a-tooltip v-if="attention.count" :title="attentionText"><a-badge :status="attention.level" :text="t('RuntimeMonitor.bottleneck.attention', { count: attention.count })" /></a-tooltip>
        <a-tooltip v-else-if="attention.retained.length" :title="attentionText"><a-badge status="default" :text="t('RuntimeMonitor.bottleneck.retained')" /></a-tooltip>
        <a-badge v-else :status="hasData && !stale ? 'success' : 'default'" :text="t(hasData ? stale ? 'runtimeDiagnostics.nodeStale' : 'runtimeDiagnostics.normal' : 'runtimeDiagnostics.noMonitoringData')" />
        <span v-for="metric in lifetime" :key="metric.key" class="node-lifetime"><span>{{ metric.label }}</span> {{ metric.value }}</span>
        <a-tooltip v-if="reloaded" :title="t('RuntimeMonitor.reloadedNodeHint')"><span class="node-cache-note">{{ t('RuntimeMonitor.reloadedNode') }}</span></a-tooltip>
      </div>
      <span class="node-header-actions">
        <template v-if="tab === 'jvm'">
          <a-tooltip :title="t('runtimeDiagnostics.localEvidenceHint')" :trigger="['hover', 'focus']"><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.localEvidenceHint')"><InfoCircleOutlined /></a-button></a-tooltip>
          <a-button type="text" size="small" :disabled="!jvm.canExportSnapshot.value" :title="t('runtimeDiagnostics.report.html')" :aria-label="t('runtimeDiagnostics.report.html')" @click="jvm.exportReportHtml"><DownloadOutlined /></a-button>
          <a-dropdown :trigger="['click']" :disabled="!jvm.canExportSnapshot.value"><a-button type="text" size="small" :disabled="!jvm.canExportSnapshot.value" :title="t('runtimeDiagnostics.report.more')" :aria-label="t('runtimeDiagnostics.report.more')"><DownOutlined /></a-button><template #overlay><a-menu @click="value => value.key === 'pdf' ? jvm.exportPdf() : jvm.exportSnapshot()"><a-menu-item key="json"><FileTextOutlined /> {{ t('runtimeDiagnostics.report.json') }}</a-menu-item><a-menu-item key="pdf"><FilePdfOutlined /> {{ t('runtimeDiagnostics.report.savePdf') }}</a-menu-item></a-menu></template></a-dropdown>
        </template>
        <slot name="actions" />
      </span>
    </header>
    <a-tabs :active-key="tab" @change="value => emit('tab', String(value))">
      <a-tab-pane key="overview" :tab="t('runtimeDiagnostics.overview')" />
      <a-tab-pane v-if="access.threads || access.jfr || access.heap" key="jvm" :tab="t('runtimeDiagnostics.performance')" />
      <a-tab-pane v-if="access.monitor" key="mbean" tab="MBean" />
      <a-tab-pane v-if="access.logs" key="logs" :tab="t('runtimeDiagnostics.logs')" />
    </a-tabs>
    <NodeOverview v-if="visitedTools.has('overview')" v-show="tab === 'overview'" :node-id="nodeId" :live="live" :stale="stale" :bottlenecks="bottlenecks.issues.value" @diagnose="openDiagnosis" @inspect="openBean" @settings="emit('settings')" @session="openSessions" />
    <div v-if="visitedTools.has('jvm')" v-show="tab === 'jvm'" class="node-jvm-canvas">
      <JvmDiagnosticPanel :node-id="nodeId" :active-tab="jvm.activeTab.value" :threads="jvm.threads.data.value ?? []" :thread-state="jvm.threadState.value" :snapshot="jvm.snapshot.value" :sampling-state="jvm.sampling.value" :stream-phase="jvm.streamPhase.value" :elapsed-seconds="jvm.elapsedSeconds.value" :access="jvm.access.value" :active="active && tab === 'jvm'" @update:active-tab="jvm.selectTab" @sample="jvm.sample" @start="jvm.start" @stop="jvm.stop" @export-html="jvm.exportHtml" @capture-jfr="jvm.requestCapture('jfr')" @heap-dump="value => jvm.requestCapture('heap-dump', value.live)" />
      <a-alert v-if="jvm.exportState.value" type="error" :message="jvm.exportState.value" />
      <DiagnosticCapture :node-id="nodeId" :open="!!jvm.captureKind.value" :kind="jvm.captureKind.value" :live="jvm.captureLive.value" @close="jvm.captureKind.value = undefined" />
    </div>
    <div v-if="visitedTools.has('mbean') && access.monitor" v-show="tab === 'mbean'">
      <MBeanBrowser :active="active && tab === 'mbean'" :beans="view.beans.value" :state="view.beanState.value" :detail-state="view.detailState.value" :result-state="view.invocation.state.value" :config="view.config.value" :invoke-access="{ allowed: access.invoke }" :busy="view.invocation.state.value.status === 'loading'" :result="view.invocation.data.value" :execute-invocation="view.invoke" :target="nodeId" :selected-object="view.selectedBean.value" @refresh="view.loadBeans" @invoke="view.invoke" @select="view.selectBean" @update:config="view.configure" />
    </div>
    <NodeLogPanel v-if="visitedTools.has('logs') && access.logs" v-show="tab === 'logs'" :node-id="nodeId" :trace-id="traceId" :active="active && tab === 'logs'" />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, toRef, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { DownloadOutlined, DownOutlined, FilePdfOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { JvmDiagnosticPanel, MBeanBrowser, type MetricValue } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { useNodeDiagnostics } from './useNodeDiagnostics'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useJvmDiagnostics } from './useJvmDiagnostics'
import DiagnosticCapture from './DiagnosticCapture.vue'
import { hasNodeMonitoringData } from '../RuntimeMonitor/nodeSummary'
import { useClusterSessionContext } from '../RuntimeMonitor/useClusterSessions'
import { useRuntimeWorkspaceNavigation } from '../useRuntimeWorkspace'
import { useNodeBottlenecks } from './diagnosis/useNodeBottlenecks'
import { nodeAttentionStatus, type Bottleneck } from './diagnosis/bottleneckRules'
import type { HeapEvidenceSnapshot, PropertyCacheSnapshot } from './useNodeOperationalSignals'
const NodeOverview = defineAsyncComponent(() => import('./NodeOverview.vue'))
const NodeLogPanel = defineAsyncComponent(() => import('./NodeLogPanel.vue'))
const props = defineProps({
  nodeId: { type: String, required: true }, scopeKey: { type: String, default: '' },
  propertyCache: { type: Object as PropType<PropertyCacheSnapshot>, default: undefined },
  heapEvidence: { type: Object as PropType<HeapEvidenceSnapshot>, default: undefined },
  tab: { type: String, default: 'overview' }, live: { type: Object as PropType<RealtimeNode>, default: undefined },
  stale: { type: Boolean, default: false }, active: { type: Boolean, default: true }, reloaded: { type: Boolean, default: false },
  metrics: { type: Array as PropType<MetricValue[]>, default: () => [] }, sampledAt: { type: String, default: '' }, traceId: { type: String, default: '' },
})
const emit = defineEmits<{ (event: 'tab', value: string): void; (event: 'settings'): void }>()
const { t } = useI18n()
const access = useDiagnosticsAccess()
const bottlenecks = useNodeBottlenecks(toRef(props, 'nodeId'), toRef(props, 'live'), toRef(props, 'active'), toRef(props, 'stale'), toRef(props, 'scopeKey'), toRef(props, 'propertyCache'), toRef(props, 'heapEvidence'))
const sessionContext = useClusterSessionContext()
const navigateWorkspace = useRuntimeWorkspaceNavigation()
const sessionSnapshot = computed(() => sessionContext?.snapshots.value.get(props.nodeId))
const hasData = computed(() => hasNodeMonitoringData(props.live))
const attention = computed(() => nodeAttentionStatus(props.live?.health, hasData.value && !props.stale, bottlenecks.issues.value))
const attentionText = computed(() => [
  ...attention.value.evidence.map(value => t(`components.RealtimeResource.health.signal.${value.signal}`, value.values)),
  ...[...attention.value.current, ...attention.value.retained].map(value => `${t(value.message, value.values ?? {})}${value.retained ? ` · ${t('RuntimeMonitor.bottleneck.retained')}` : ''}`),
].join('；'))
const lifetime = computed(() => props.metrics.filter(metric => ['startTime', 'uptime'].includes(metric.key) && metric.value !== undefined))
const visitedTools = ref(new Set<string>())
watch([() => props.tab, () => props.active], ([tab, active]) => { if (active) visitedTools.value.add(tab) }, { immediate: true, flush: 'sync' })
const view = useNodeDiagnostics(toRef(props, 'nodeId'), toRef(props, 'tab'), toRef(props, 'active'))
const jvm = useJvmDiagnostics(toRef(props, 'nodeId'), toRef(props, 'tab'), toRef(props, 'active'))
const route = useRoute(), router = useRouter()
function openBean(bean: string) { if (props.active && access.value.monitor) void router.replace({ query: { ...route.query, tool: 'mbean', bean } }) }
function openDiagnosis(target: Bottleneck['target']) {
  if (!props.active) return
  if (target.tool === 'mbean' && target.bean) openBean(target.bean)
  else if (target.tool === 'jvm' && (access.value.threads || access.value.jfr || access.value.heap)) emit('tab', 'jvm')
}
function openSessions() { if (props.active && access.value.sessions && sessionSnapshot.value?.supported === true) navigateWorkspace?.('connections', { nodeId: props.nodeId }) }
</script>
<style scoped>
.node-diagnostics { min-width:0; }
.node-diagnostics--overview > :deep(.ant-tabs > .ant-tabs-nav) { margin-bottom:var(--space-2,8px); }
.node-diagnostics--logs { display:flex; flex:1 1 0; flex-direction:column; min-height:0; overflow:hidden; }
.node-diagnostics--logs > header,.node-diagnostics--logs > :deep(.ant-tabs) { flex:0 0 auto; }
.node-diagnostics--jvm { display:flex; flex:1 1 0; flex-direction:column; min-height:0; overflow:hidden; }
.node-diagnostics--jvm > header,.node-diagnostics--jvm > :deep(.ant-tabs) { flex:0 0 auto; }
.node-jvm-canvas { display:flex; flex:1 1 0; min-height:0; overflow:auto; }
.node-jvm-canvas > :deep(.jvm-panel) { display:flex; flex:1 1 0; flex-direction:column; min-height:0; }
header { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:var(--space-2,8px); }
.node-header-info { display:flex; align-items:center; flex-wrap:wrap; min-width:0; gap:6px 10px; }
header strong { min-width:0; overflow-wrap:anywhere; font-size:var(--fs-title-4,16px); font-weight:600; }
.node-header-info > :deep(.node-health) { margin-left:0; }
.node-lifetime { color:var(--ink-2); font-size:var(--fs-caption,12px); white-space:nowrap; }.node-lifetime > span { color:var(--ink-3); }.node-header-actions { display:flex; align-items:center; }
.node-cache-note { color:var(--ink-3); font-size:var(--fs-caption,12px); }
</style>
