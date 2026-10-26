<template>
  <div class="node-log-panel">
    <div v-if="traceId || relatedTime" class="node-log-context"><span v-if="traceId">Trace ID: <code>{{ traceId }}</code></span><span v-if="relatedTime">{{ t('runtimeDiagnostics.relatedTime', { time: relatedTime }) }}<span v-if="spanId"> · Span {{ spanId }}</span></span></div>
    <a-alert v-if="mode === 'file' && logs.notice.value" type="info" show-icon :message="logs.notice.value" />
    <div class="node-log-workspace">
    <KeepAlive :max="2"><LogViewer :key="mode" class="node-log-viewer" embedded :active="active" :entries="mode === 'file' ? logs.entries.value : consoleLogs.entries.value" :files="files" :file-id="mode === 'file' ? logs.fileId.value : 'console'" :state="mode === 'file' ? logs.state.value : consoleState" :is-console="mode === 'console'" :file-busy="logs.windowQuery.state.value.status === 'loading' || logs.exportQuery.state.value.status === 'loading'"
      :filter="logs.filter.value" :config="logs.config.value" :following="mode === 'file' ? logs.following.value : consoleLogs.following.value" :loading="mode === 'file' && logs.windowQuery.state.value.status === 'loading'" :updated-at="mode === 'file' ? logs.windowQuery.state.value.sampledAt : undefined" :follow-access="fileFollowAccess" :has-previous="mode === 'file' && logs.windowData.value?.previousPosition != null" :has-next="mode === 'file' && logs.windowData.value?.nextPosition != null" :truncated="mode === 'file' ? logs.windowData.value?.truncated || logs.clipped.value : consoleLogs.clipped.value" :loading-direction="logs.loadingDirection.value"
      :empty-description="mode === 'console' ? t(consoleLogs.status.value === 'waiting' ? 'runtimeDiagnostics.consoleWaiting' : 'runtimeDiagnostics.consoleStartHint') : !logs.file.value ? t(logs.catalog.state.value.status === 'loading' ? 'runtimeDiagnostics.discoveringLogFiles' : 'runtimeDiagnostics.selectLogFromDirectory') : ''"
      :trace-access="{ allowed: access.trace }" :export-access="{ allowed: mode === 'file' && access.exportLogs && !!logs.file.value?.operations?.includes('download') }"
      @file="logs.select" @filter="logs.search" @update:config="logs.configure" @follow="follow" @refresh="mode === 'file' ? logs.fileId.value ? logs.read() : logs.roots() : refreshConsole()" @export="logs.download"
      @previous="logs.page(logs.windowData.value?.previousPosition)" @next="logs.page(logs.windowData.value?.nextPosition, 'forward')" @trace="openTrace">
      <template #source><div class="log-source-tabs" role="group" :aria-label="t('runtimeDiagnostics.logs')"><a-button type="text" size="small" :class="{ 'log-source-tabs__active': mode === 'file' }" :aria-pressed="mode === 'file'" @click="changeMode('file')">{{ t('runtimeDiagnostics.fileSource') }}</a-button><a-button type="text" size="small" :class="{ 'log-source-tabs__active': mode === 'console' }" :aria-pressed="mode === 'console'" @click="changeMode('console')">{{ t('runtimeDiagnostics.consoleSource') }}</a-button></div></template>
      <template #file-selector>
        <a-popover :open="layout.open.value" trigger="click" placement="bottomLeft" @open-change="setExplorerOpen">
          <template #content><div ref="explorerContent" class="log-directory-popup" tabindex="-1" @keydown.esc.stop="closeExplorer"><LogFileExplorer :model="catalogModel" @select="selectFile" @parent="logs.parent" @navigate="logs.navigate" @refresh="logs.refreshCatalog"><template #actions><a-button type="text" size="small" :title="t('runtimeDiagnostics.closeDirectory')" :aria-label="t('runtimeDiagnostics.closeDirectory')" @click="closeExplorer"><CloseOutlined /></a-button></template></LogFileExplorer></div></template>
          <a-button ref="explorerToggle" type="text" size="small" class="log-current-file" :disabled="!access.logs" :title="logs.filePath.value || t('runtimeDiagnostics.fileDirectory')" :aria-label="`${t('runtimeDiagnostics.fileDirectory')}: ${logs.file.value?.name || t('runtimeDiagnostics.noSelectedLogFile')}`" :aria-expanded="layout.open.value" @keydown.esc.stop="closeExplorer"><FolderOpenOutlined /><strong>{{ logs.file.value?.name || t('runtimeDiagnostics.fileDirectory') }}</strong><DownOutlined /></a-button>
        </a-popover>
      </template>
      <template #console-actions><span v-if="providersKnown" class="console-status" :class="{ 'console-status--receiving': consoleLogs.status.value === 'receiving' }" role="status" aria-live="polite"><span />{{ t(`runtimeDiagnostics.consoleStatus.${consoleLogs.status.value}`) }}</span><a-button :type="consoleRunning ? 'default' : 'primary'" :loading="!providersKnown && logs.providers.state.value.status === 'loading'" :disabled="!access.logs || logs.providers.state.value.status === 'forbidden' || providersKnown && !logs.consoleAvailable.value" @click="consoleRunning ? consoleLogs.stop() : refreshConsole()">{{ t(consoleRunning ? 'runtimeDiagnostics.consoleStop' : !providersKnown && logs.providers.state.value.status === 'error' ? 'runtimeDiagnostics.retry' : 'runtimeDiagnostics.consoleStart') }}</a-button><a-button size="small" :disabled="!consoleLogs.entries.value.length" @click="consoleLogs.clear">{{ t('runtimeDiagnostics.clearLogs') }}</a-button></template>
    </LogViewer></KeepAlive>
    </div>
    <a-alert v-if="logs.exportQuery.state.value.status === 'error'" type="error" :message="logs.exportQuery.state.value.message" />
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useElementVisibility } from '@vueuse/core'
import { CloseOutlined, DownOutlined, FolderOpenOutlined } from '@ant-design/icons-vue'
import { LogViewer } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useNodeLogs } from './useNodeLogs'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useRuntimeConsole } from './useRuntimeConsole'
import LogFileExplorer from './LogFileExplorer.vue'
import { useLogExplorerLayout } from './useLogExplorerLayout'
const props = defineProps({ nodeId: { type: String, required: true }, traceId: { type: String, default: '' }, active: { type: Boolean, default: true } })
const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const spanId = computed(() => typeof route.query.spanId === 'string' ? route.query.spanId : '')
const relatedTime = computed(() => {
  if (typeof route.query.logFrom !== 'string' || typeof route.query.logTo !== 'string') return ''
  const from = Number(route.query.logFrom), to = Number(route.query.logTo)
  const start = new Date(from), end = new Date(to)
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && from > 0 && to >= from
    ? `${start.toLocaleString()} – ${end.toLocaleString()}` : ''
})
const access = useDiagnosticsAccess()
const mode = ref<'file' | 'console'>('file')
const explorerToggle = ref<{ $el: HTMLButtonElement }>(), explorerContent = ref<HTMLElement>()
const layout = useLogExplorerLayout(computed(() => props.active && mode.value === 'file'))
const explorerVisible = useElementVisibility(explorerContent)
// Popover 先挂载再定位显示，等目录真正可见后再接收键盘操作。
watch([layout.open, explorerVisible], ([open, visible]) => { if (open && visible) explorerContent.value?.focus() }, { flush: 'post' })
const logs = useNodeLogs(toRef(props, 'nodeId'), computed(() => props.active && mode.value === 'file' ? 'logs' : ''), toRef(props, 'active'))
const consoleLogs = useRuntimeConsole(toRef(props, 'nodeId'), computed(() => props.active && mode.value === 'console'), computed(() => access.value.logs && logs.consoleAvailable.value))
const consoleRunning = computed(() => ['waiting', 'receiving'].includes(consoleLogs.status.value))
const providersKnown = computed(() => logs.providers.data.value !== undefined)
// 未知能力保留加载/可重试错误；仅确认没有 Java Provider 时才展示不支持。
const consoleState = computed(() => !access.value.logs ? { status: 'forbidden' as const } : !providersKnown.value ? logs.providers.state.value : !logs.consoleAvailable.value ? { status: 'unsupported' as const } : consoleLogs.status.value === 'error' ? { status: consoleLogs.entries.value.length ? 'stale' as const : 'error' as const, message: consoleLogs.message.value } : { status: 'ready' as const })
const files = computed(() => logs.file.value ? [{ ...logs.file.value, id: logs.fileId.value }] : [])
const fileFollowAccess = computed(() => ({ allowed: !!logs.file.value && !logs.file.value.entry && !/\.(zip|gz)$/i.test(logs.file.value.name) }))
const catalogModel = computed(() => ({ files: logs.catalog.data.value ?? [], parents: logs.parents.value, selectedKey: logs.fileId.value, state: logs.catalog.state.value }))
let appliedTrace = ''
watch([() => props.traceId, () => props.active], ([value, active]) => { if (active && value && value !== appliedTrace) { logs.search(value); appliedTrace = value } }, { immediate: true })
function openTrace(traceId: string) { if (props.active && access.value.trace) void router.push({ path: access.value.enter ? '/infrastructure/runtime-monitor' : '/infrastructure/tracing', query: { view: 'tracing', traceId, nodeId: props.nodeId } }) }
function changeMode(value: 'file' | 'console') { layout.close(); logs.follow(false); mode.value = value }
function refreshConsole() { if (!providersKnown.value) void logs.discoverProviders(true); else consoleLogs.start() }
function follow(value: boolean) { if (mode.value === 'file') logs.follow(value); else consoleLogs.following.value = value }
function setExplorerOpen(open: boolean) { layout.setOpen(open) }
async function selectFile(key: string) { if (await logs.select(key) && layout.open.value) closeExplorer() }
function closeExplorer() { layout.close(); void nextTick(() => { if (props.active && mode.value === 'file') explorerToggle.value?.$el?.focus() }) }
watch(() => props.nodeId, () => layout.close())
</script>
<style scoped>
.node-log-panel { display:flex; flex:1 1 0; flex-direction:column; min-width:0; min-height:0; gap:var(--space-2,8px); }
.node-log-workspace { position:relative; display:flex; flex:1 1 0; min-width:0; min-height:0; border:1px solid var(--line); border-radius:6px; overflow:hidden; }.node-log-viewer { flex:1 1 0; min-width:0; min-height:0; height:auto; }
.log-directory-popup { width:420px; max-width:calc(100vw - 48px); height:min(420px,65vh); outline:none; }
.log-current-file { display:flex; align-items:center; gap:6px; flex:1 1 140px; min-width:90px; max-width:240px; font-size:var(--fs-sm,13px); }.log-current-file > .anticon { flex:none; color:var(--ink-3); }.log-current-file strong { flex:1; text-align:start; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }.log-source-tabs { display:flex; align-items:center; gap:2px; }.log-source-tabs__active { color:var(--primary-color); font-weight:600; box-shadow:inset 0 -2px var(--primary-color); }
.node-log-context { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-3,12px); font-size:var(--fs-12,12px); color:var(--ink-3); overflow-wrap:anywhere; }
.node-log-context,.node-log-panel > :deep(.ant-alert) { flex:0 0 auto; }
.console-status { display:inline-flex; align-items:center; gap:6px; margin-inline-start:auto; color:var(--ink-3); font-size:var(--fs-caption,12px); white-space:nowrap; }.console-status > span { width:6px; height:6px; border-radius:50%; background:var(--ink-3); }.console-status--receiving > span { background:var(--success); }
</style>
