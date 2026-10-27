<template>
  <nav class="log-file-explorer" :aria-label="t('runtimeDiagnostics.selectFile')">
    <header><strong>{{ t('runtimeDiagnostics.selectFile') }}</strong><a-space-compact><a-button type="text" size="small" :loading="model.state.status === 'loading'" :title="t('runtimeDiagnostics.refreshDirectory')" :aria-label="t('runtimeDiagnostics.refreshDirectory')" @click="emit('refresh')"><ReloadOutlined /></a-button><slot name="actions" /></a-space-compact></header>
    <div v-if="failed" class="log-catalog-error" role="status"><WarningOutlined /><span>{{ model.state.message || t(`runtimeDiagnostics.${model.state.status === 'forbidden' ? 'forbidden' : model.state.status === 'unsupported' ? 'unsupported' : 'failed'}`) }}</span><a-button type="link" size="small" @click="emit('refresh')">{{ t('runtimeDiagnostics.retry') }}</a-button></div>
    <div ref="scroller" class="log-catalog-tree" @scroll.passive="retained.onScroll">
      <a-directory-tree v-if="model.nodes.length" :tree-data="model.nodes" :expanded-keys="model.expandedKeys" :loaded-keys="model.loadedKeys" :selected-keys="model.selectedKey ? [model.selectedKey] : []" :active-key="active ? activeKey : undefined" :load-data="model.loadData" :auto-expand-parent="false" :virtual="false" show-icon block-node @active-change="setActiveKey" @expand="keys => emit('expand', keys)" @select="select">
        <template #icon="{ dataRef, expanded }"><LoadingOutlined v-if="model.selectingKey === dataRef.key" /><FolderOpenOutlined v-else-if="dataRef.file?.directory && expanded" /><FolderOutlined v-else-if="dataRef.file?.directory" /><FileZipOutlined v-else-if="/\.(zip|gz)$/i.test(dataRef.file?.name || '') && !dataRef.file?.entry" /><FileTextOutlined v-else-if="dataRef.file" /></template>
        <template #title="{ dataRef }">
          <span v-if="dataRef.file" class="log-file-entry" :data-log-key="dataRef.key" :title="[dataRef.file.name, logFileMetadata(dataRef.file).modified].filter(Boolean).join('\n')">
            <span class="log-file-entry-heading"><span class="log-file-entry-name">{{ dataRef.file.name }}</span><small v-if="dataRef.key === model.selectedKey" class="log-file-current">{{ t('RuntimeMonitor.currentLogFile') }}</small></span>
            <small v-if="logFileMetadata(dataRef.file).summary" class="log-file-entry-meta">{{ logFileMetadata(dataRef.file).summary }}</small>
          </span>
          <span v-else-if="dataRef.state" class="log-branch-status" role="status"><LoadingOutlined v-if="dataRef.state.status === 'loading'" /><span>{{ branchText(dataRef.state) }}</span><a-button v-if="branchFailed(dataRef.state)" type="link" size="small" @click.stop="emit('retry', dataRef.branchKey)" @keydown.stop>{{ t('runtimeDiagnostics.retry') }}</a-button></span>
        </template>
      </a-directory-tree>
      <div v-else-if="model.state.status === 'loading'" class="log-catalog-loading" role="status"><LoadingOutlined />{{ t('RuntimeMonitor.loadingLogDirectory') }}</div>
      <a-empty v-else-if="!failed" :description="t('runtimeDiagnostics.emptyDirectory')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </div>
  </nav>
</template>
<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty } from 'ant-design-vue'
import { FileTextOutlined, FileZipOutlined, FolderOpenOutlined, FolderOutlined, LoadingOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { useRetainedScroll } from '@jetlinks-web-core/hooks/useRetainedScroll'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { LogFileTreeNode } from './useLogFileTree'
import { logFileMetadata } from './logFilePresentation'
const props = defineProps({ active: { type: Boolean, default: false }, model: { type: Object as PropType<{ nodes: LogFileTreeNode[]; expandedKeys: string[]; loadedKeys: string[]; selectedKey: string; selectingKey: string; state: ViewState; loadData: (node: { key: string | number }) => Promise<unknown> }>, required: true } })
const emit = defineEmits<{ (event: 'select' | 'retry', key: string): void; (event: 'refresh'): void; (event: 'expand', keys: Array<string | number>): void }>()
const { t } = useI18n(), scroller = ref<HTMLElement>(), activeKey = ref('')
const retained = useRetainedScroll(scroller, () => props.active)
const branchFailed = (state: ViewState) => ['error', 'forbidden', 'unsupported'].includes(state.status)
const failed = computed(() => branchFailed(props.model.state))
function branchText(state: ViewState) { return state.message || t(state.status === 'loading' ? 'RuntimeMonitor.loadingLogDirectory' : `runtimeDiagnostics.${state.status === 'empty' ? 'emptyDirectory' : state.status === 'forbidden' ? 'forbidden' : state.status === 'unsupported' ? 'unsupported' : 'failed'}`) }
function select(keys: Array<string | number>) { if (keys.length) emit('select', String(keys[0])) }
let reveal = '', frame: number | undefined
/** 当前文件与键盘活动行分别受控；独立分支更新不能把列表拉回当前文件。 */
watch([() => props.active, () => props.model.selectedKey], () => { activeKey.value = props.model.selectedKey || props.model.nodes[0]?.key || ''; reveal = props.active ? activeKey.value : ''; locateSelected() }, { flush: 'post', immediate: true })
watch(() => props.model.nodes, locateSelected, { flush: 'post' })
function setActiveKey(key: string | number | null) { activeKey.value = key == null ? '' : String(key); if (activeKey.value) { reveal = activeKey.value; locateSelected() } }
async function locateSelected() {
  if (!reveal || !props.active || frame !== undefined) return
  await nextTick()
  if (frame !== undefined || !props.active) return
  frame = requestAnimationFrame(() => {
    frame = undefined
    const container = scroller.value, selected = container && Array.from(container.querySelectorAll<HTMLElement>('[data-log-key]')).find(element => element.dataset.logKey === reveal)
    if (!container || !selected || !container.clientHeight) return
    const viewport = container.getBoundingClientRect(), row = selected.getBoundingClientRect()
    if (row.top < viewport.top) container.scrollTop += row.top - viewport.top
    else if (row.bottom > viewport.bottom) container.scrollTop += row.bottom - viewport.bottom
    reveal = ''
  })
}
onScopeDispose(() => { if (frame !== undefined) cancelAnimationFrame(frame) })
</script>
<style scoped>
.log-file-explorer { display:flex; flex-direction:column; min-width:0; min-height:0; height:100%; overflow:hidden; background:var(--bg-surface,var(--component-background,#fff)); }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px; min-height:36px; border-bottom:1px solid var(--line); flex:none; }header strong { font-size:var(--fs-sm,13px); font-weight:600; }header :deep(.ant-btn) { padding-inline:5px; }
.log-catalog-tree { flex:1 1 0; min-height:0; overflow:auto; overscroll-behavior:contain; padding:6px 4px; }
.log-catalog-tree :deep(.ant-tree) { background:transparent; font-size:var(--fs-sm,13px); }.log-catalog-tree :deep(.ant-tree-treenode) { align-items:flex-start; padding:0 0 2px; }.log-catalog-tree :deep(.ant-tree-node-content-wrapper) { display:flex; align-items:flex-start; min-width:0; padding:4px; line-height:22px; }.log-catalog-tree :deep(.ant-tree-title) { flex:1; min-width:0; }.log-catalog-tree :deep(.ant-tree-iconEle),.log-catalog-tree :deep(.ant-tree-switcher) { flex:none; font-size:14px; line-height:30px; }.log-catalog-tree :deep(.ant-tree-iconEle) { line-height:22px; color:var(--ink-3); }.log-catalog-tree :deep(.ant-tree-node-selected) { font-weight:400; }
/* DirectoryTree 默认深蓝底与平台 Tree 的蓝色标题冲突；沿用平台浅色选中行。 */
.log-catalog-tree :deep(.ant-tree.ant-tree-directory .ant-tree-treenode-selected::before) { background:transparent; }
.log-catalog-tree :deep(.ant-tree.ant-tree-directory .ant-tree-treenode-selected .ant-tree-node-content-wrapper),.log-catalog-tree :deep(.ant-tree.ant-tree-directory .ant-tree-treenode-selected .ant-tree-iconEle) { color:var(--primary-color); }
.log-file-entry { display:block; min-width:0; }.log-file-entry-heading { display:flex; align-items:baseline; gap:8px; min-width:0; }.log-file-entry-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.log-file-current { flex:none; color:inherit; opacity:.8; font-size:var(--fs-caption,12px); }.log-file-entry-meta { display:block; color:var(--ink-3); font-size:var(--fs-caption,12px); font-weight:400; line-height:18px; white-space:nowrap; }.log-catalog-tree :deep(.ant-tree-node-selected) .log-file-entry-meta { color:inherit; opacity:.8; }
.log-catalog-error,.log-branch-status,.log-catalog-loading { display:flex; align-items:center; gap:6px; font-size:var(--fs-caption,12px); color:var(--ink-3); }.log-catalog-error { padding:8px; flex:none; color:var(--warning); }.log-catalog-error > span,.log-branch-status > span { min-width:0; overflow-wrap:anywhere; }.log-branch-status :deep(.ant-btn) { height:22px; padding:0 4px; font-size:inherit; }.log-catalog-loading { justify-content:center; padding:28px 0; }.log-catalog-tree :deep(.ant-empty) { margin-block:28px; font-size:var(--fs-caption,12px); }
</style>
