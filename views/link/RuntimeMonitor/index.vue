<template>
  <main ref="workspaceElement" class="runtime-monitor" :class="{ 'runtime-monitor--with-node-list': sidebar.expanded.value, 'runtime-monitor--logs': logLayoutActive, 'runtime-monitor--jvm': jvmCanvasActive }" :style="logWorkspaceStyle">
    <a-result v-if="!view.access.value.enter" status="403" :title="t('runtimeDiagnostics.forbidden')" />
    <div v-else class="runtime-monitor-grid" :class="{ 'runtime-monitor-grid--logs': logLayoutActive }" :style="sidebar.gridStyle.value">
      <aside id="runtime-monitor-node-sidebar" v-show="sidebar.expanded.value" class="cluster-sidebar" :inert="!sidebar.expanded.value || undefined" :aria-hidden="!sidebar.expanded.value || undefined">
        <a-input-search v-model:value="view.search.value" :placeholder="t('runtimeDiagnostics.nodeSearch')" allow-clear />
        <a-spin class="cluster-node-list" :spinning="view.membership.state.value.status === 'loading'">
          <a-tree :tree-data="tree" :selected-keys="[view.selected.value]" block-node @select="keys => keys[0] && view.select(String(keys[0]))">
            <template #title="{ dataRef }"><NodeSummary :node-id="dataRef.key" :label="dataRef.label" :live="dataRef.live" :stale="view.runtime.error.value" :waiting="waitingForMetrics" :metrics="dataRef.key === view.selected.value ? selectedMetrics : []" :buffer="buffers.snapshots.value.get(dataRef.key)" :session="sessions.snapshots.value.get(dataRef.key)" :can-open-buffer="view.access.value.monitor && view.active.value" @open-queue="openBufferQueue" @open-buffers="nodeId => openBufferQueue({ nodeId })" /></template>
          </a-tree>
        </a-spin>
        <a-alert v-if="view.membership.state.value.status === 'error'" type="error" :message="t('runtimeDiagnostics.failed')" />
      </aside>
      <section class="cluster-detail" :class="{ 'cluster-detail--logs': logLayoutActive, 'cluster-detail--jvm': jvmCanvasActive }">
        <KeepAlive :key="workspaceKey" :max="8"><RuntimeNodeWorkspace v-if="view.selected.value" :key="view.selected.value" :node-id="view.selected.value" :scope-key="workspaceKey" :tab="view.tab.value" :live="view.current.value?.live" :stale="view.runtime.error.value || !view.current.value?.live" :page-active="view.active.value" :connection="connection" :sampled-at="view.runtime.updatedAt.value" :trace-id="clusterTraceId" :reloaded="reloaded" @tab="view.selectTab" @metrics="acceptMetrics" @settings="openSettings">
          <template v-if="sidebar.canToggle.value" #node-leading><a-button class="cluster-sidebar-toggle" size="small" type="text" :aria-label="t(sidebar.expanded.value ? 'components.EqualHeightColumns.collapse' : 'components.EqualHeightColumns.expand')" :aria-expanded="sidebar.expanded.value" aria-controls="runtime-monitor-node-sidebar" @click="sidebar.toggle"><MenuFoldOutlined v-if="sidebar.expanded.value" /><MenuUnfoldOutlined v-else /></a-button></template>
          <template v-if="sidebar.compact.value" #node-name><a-select class="cluster-heading-select" size="small" :bordered="false" :value="view.selected.value" :options="mobileOptions" :title="view.selected.value" :aria-label="t('runtimeDiagnostics.nodeSearch')" show-search option-filter-prop="label" @change="value => view.select(String(value))" /></template>
          <template #actions>
            <a-popover :open="settingsOpen" trigger="click" placement="bottomRight" @open-change="setSettingsOpen">
              <template #content>
                <div ref="settingsContent" class="monitor-settings" tabindex="-1" @keydown.esc.stop="closeSettings">
                  <div v-if="view.access.value.monitor && view.nodes.value.length" class="monitor-settings-frequency" role="group" :aria-label="t('RuntimeMonitor.bufferSamplingInterval')">
                    <div class="monitor-settings-caption"><ClockCircleOutlined /><span>{{ t('RuntimeMonitor.bufferSamplingInterval') }}</span></div>
                    <a-segmented size="small" :value="bufferInterval" :options="bufferIntervalOptions" @change="setBufferInterval" />
                  </div>
                  <div class="monitor-settings-footer"><a-button size="small" type="text" @click="clearPreferences"><UndoOutlined />{{ t('RuntimeMonitor.clearPreferences') }}</a-button></div>
                </div>
              </template>
              <a-button ref="settingsTrigger" class="monitor-settings-trigger" size="small" type="text" :title="t('RuntimeMonitor.settings')" :aria-label="t('RuntimeMonitor.settings')" :aria-expanded="settingsOpen" @keydown.esc.stop="closeSettings"><template v-if="view.access.value.monitor && view.nodes.value.length"><ClockCircleOutlined /><span>{{ t('RuntimeMonitor.bufferSamplingSeconds', { seconds: bufferInterval }) }}</span><DownOutlined class="monitor-settings-chevron" /></template><SettingOutlined v-else /></a-button>
            </a-popover>
          </template>
        </RuntimeNodeWorkspace></KeepAlive>
        <template v-if="!view.selected.value"><a-spin v-if="view.membership.state.value.status === 'loading'" />
          <a-alert v-else-if="view.membership.state.value.status === 'error'" type="error" :message="t('runtimeDiagnostics.failed')" show-icon><template #action><a-button size="small" @click="view.loadNodes">{{ t('runtimeDiagnostics.refresh') }}</a-button></template></a-alert>
          <a-alert v-else-if="!view.canDiscover.value" type="info" :message="t('RuntimeMonitor.discoveryUnavailable')" show-icon />
          <a-empty v-else :description="t('runtimeDiagnostics.empty')" />
        </template>
      </section>
    </div>
  </main>
</template>
<script setup lang="ts" name="RuntimeMonitorPage">
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ClockCircleOutlined, DownOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { useClusterWorkspace } from './useClusterWorkspace'
import { useLogWorkspaceLayout } from './useLogWorkspaceLayout'
import { useClusterSidebarLayout } from './useClusterSidebarLayout'
import type { MetricValue } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import NodeSummary from './NodeSummary.vue'
import { provideClusterBuffers } from './useClusterBuffers'
import { useClusterSessionContext } from './useClusterSessions'
import { bufferIntervals, diagnosticIntervalSeconds, type BufferInterval } from '../diagnostics/preferences'
const RuntimeNodeWorkspace = defineAsyncComponent(() => import('./RuntimeNodeWorkspace.vue'))
const { t } = useI18n(); const route = useRoute(), router = useRouter()
const view = useClusterWorkspace()
const workspaceElement = ref<HTMLElement>()
const sidebar = useClusterSidebarLayout(workspaceElement, view.showNodeSelector, computed(() => view.access.value.enter))
const logLayoutActive = computed(() => view.active.value && view.access.value.enter && view.access.value.logs && view.tab.value === 'logs')
const jvmCanvasActive = computed(() => view.active.value && view.access.value.enter && (view.access.value.threads || view.access.value.jfr || view.access.value.heap) && view.tab.value === 'jvm')
const logWorkspaceStyle = useLogWorkspaceLayout(workspaceElement, logLayoutActive)
const settingsOpen = ref(false), settingsTrigger = ref<{ focus: () => void }>(), settingsContent = ref<HTMLElement>()
watch(view.active, active => { if (!active) settingsOpen.value = false }, { flush: 'sync' })
async function setSettingsOpen(open: boolean) { settingsOpen.value = open; if (open) { await nextTick(); if (settingsOpen.value) settingsContent.value?.focus() } }
function closeSettings() { settingsOpen.value = false; settingsTrigger.value?.focus() }
function openSettings() { void setSettingsOpen(true) }
function clearPreferences() { view.preferences.clear(); closeSettings() }
const connection = { stale: view.runtime.error }
const bufferInterval = computed(() => diagnosticIntervalSeconds(view.preferences.value.value.bufferIntervalSeconds))
const bufferIntervalOptions = computed(() => bufferIntervals.map(value => ({ value, label: t('RuntimeMonitor.bufferSamplingSeconds', { seconds: value }) })))
const buffers = provideClusterBuffers(computed(() => view.nodes.value.map(node => node.id)), computed(() => view.active.value && view.access.value.monitor), view.scopeKey, bufferInterval, view.discoveryScope, computed(() => view.access.value.monitor))
const sessions = useClusterSessionContext()!
/** 同时定位节点、概览与队列，避免两次路由替换互相覆盖；只接收当前可见证据。 */
function openBufferQueue(target: { nodeId: string; objectName?: string }) {
  const queues = buffers.snapshots.value.get(target.nodeId)?.queues
  if (!view.active.value || !view.access.value.enter || !view.access.value.monitor || !view.nodes.value.some(node => node.id === target.nodeId)
    || !queues?.length || target.objectName !== undefined && !queues.some(queue => queue.objectName === target.objectName)) return
  // 全部入口明确清除上次队列选择，不能用任意一个队列冒充概览。
  view.preferences.updateNode(target.nodeId, { bufferObjectName: target.objectName, bufferVisibleObjectNames: target.objectName ? [target.objectName] : undefined, bufferView: 'backlog', bufferFilter: 'all' })
  view.preferences.update({ nodeId: target.nodeId, tool: 'overview' })
  void router.replace({ query: { ...route.query, nodeId: target.nodeId, tool: 'overview', traceId: undefined, spanId: undefined, bean: undefined } })
}
function setBufferInterval(value: unknown) { if (view.access.value.monitor && bufferIntervals.includes(value as BufferInterval)) view.preferences.update({ bufferIntervalSeconds: value as BufferInterval }) }
const clusterTraceId = ref('')
watch([view.active, () => route.query.traceId], ([active, traceId]) => { if (active) clusterTraceId.value = typeof traceId === 'string' ? traceId : '' }, { immediate: true, flush: 'sync' })
const workspaceKey = computed(() => JSON.stringify([view.scopeKey.value, view.access.value]))
const selectedMetrics = shallowRef<MetricValue[]>([]), reloaded = ref(false)
let cachedNodes: string[] = [], visited = new Set<string>()
watch([view.selected, workspaceKey], ([nodeId, scope], previous) => {
  settingsOpen.value = false
  if (scope !== previous?.[1]) { cachedNodes = []; visited = new Set() }
  selectedMetrics.value = []
  reloaded.value = !!nodeId && visited.has(nodeId) && !cachedNodes.includes(nodeId)
  if (nodeId) { visited.add(nodeId); cachedNodes = [...cachedNodes.filter(id => id !== nodeId), nodeId].slice(-8) }
}, { immediate: true, flush: 'sync' })
function acceptMetrics(value: { nodeId: string; scopeKey: string; metrics: MetricValue[] }) { if (view.active.value && value.nodeId === view.selected.value && value.scopeKey === workspaceKey.value) selectedMetrics.value = value.metrics }
const waitingForMetrics = computed(() => view.access.value.query && view.runtime.loading.value && !view.runtime.updatedAt.value && !view.runtime.error.value)
const tree = computed(() => view.filtered.value.map(node => ({ key: node.id, label: node.alias || node.id, live: node.live })))
const mobileOptions = computed(() => view.nodes.value.map(node => ({ value: node.id, label: node.alias || node.id })))
</script>
<style scoped>
.runtime-monitor { display:flex; flex:1 1 auto; min-height:0; width:100%; min-width:0; }
.runtime-monitor-grid { display:grid; flex:1 1 auto; min-width:0; min-height:0; gap:16px; align-items:stretch; transition:grid-template-columns .2s ease; }
.runtime-monitor-grid--logs { min-height:0; }
/* 顶部位置由布局测量；底部间距交给 CSS token 换算，兼容 rem 和主题字号。 */
.runtime-monitor--logs { flex:0 0 auto; height:max(0px,calc(var(--runtime-log-available-height) - var(--space-3,12px))); overflow:hidden; }
.cluster-sidebar,.cluster-detail { min-width:0; }
.cluster-sidebar,.cluster-detail { height:100%; }
.cluster-detail--logs { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.cluster-detail--jvm { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.cluster-detail--jvm > :deep(.node-diagnostics) { flex:1 1 0; min-height:0; }
.cluster-sidebar { display:flex; flex-direction:column; min-height:0; align-self:stretch; overflow:hidden; padding-inline-end:var(--space-4,16px); border-inline-end:1px solid var(--jet-theme-border-color-1); }
.cluster-node-list { flex:1 1 0; min-height:0; margin-top:12px; overflow:auto; }
.cluster-sidebar :deep(.ant-tree) { min-height:0; }
.cluster-sidebar :deep(.ant-tree-node-content-wrapper) { min-width:0; }
.cluster-sidebar :deep(.ant-tree-switcher) { display:none; }.cluster-sidebar :deep(.ant-tree-title) { display:block; }.cluster-sidebar :deep(.ant-tree-node-content-wrapper) { padding-inline:6px; }
.runtime-monitor--with-node-list :deep(.node-resource-fallback) { display:none; }
.cluster-sidebar-toggle { flex:0 0 auto; }
.cluster-heading-select { width:180px; max-width:100%; font-weight:600; }.cluster-heading-select :deep(.ant-select-selector) { padding-inline:0 !important; }
.cluster-heading-select :deep(.ant-select-selection-item) { font-size:var(--fs-title-4,16px); font-weight:600; }
.monitor-settings { width:max-content; max-width:calc(100vw - 48px); outline:none; }
.monitor-settings-frequency { display:grid; gap:var(--space-2,8px); padding:0 0 var(--space-3,12px); }
.monitor-settings-caption { display:flex; align-items:center; gap:var(--space-2,8px); color:var(--ink-2); font-size:var(--fs-caption,12px); }
.monitor-settings-footer { border-top:1px solid var(--jet-theme-border-color-1); padding-top:var(--space-2,8px); }
.monitor-settings-footer :deep(.ant-btn) { padding-inline:4px; color:var(--ink-3); }
.monitor-settings-trigger { display:inline-flex; align-items:center; gap:4px; flex:0 0 auto; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.monitor-settings-trigger :deep(.anticon + span),.monitor-settings-trigger :deep(span + .anticon) { margin-inline-start:0; }
.monitor-settings-chevron { font-size:var(--fs-caption,12px); }
</style>
