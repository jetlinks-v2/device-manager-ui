<template>
  <nav class="log-file-explorer" :aria-label="t('runtimeDiagnostics.fileDirectory')">
    <header><strong>{{ t('runtimeDiagnostics.fileDirectory') }}</strong><a-space-compact><a-button type="text" size="small" :disabled="!model.parents.length" :title="t('runtimeDiagnostics.fileParent')" :aria-label="t('runtimeDiagnostics.fileParent')" @click="emit('parent')"><ArrowUpOutlined /></a-button><a-button type="text" size="small" :loading="model.state.status === 'loading'" :title="t('runtimeDiagnostics.refreshDirectory')" :aria-label="t('runtimeDiagnostics.refreshDirectory')" @click="emit('refresh')"><ReloadOutlined /></a-button><slot name="actions" /></a-space-compact></header>
    <div class="log-catalog-breadcrumb" :title="model.parents.map(file => file.name).join(' / ')"><a-breadcrumb><a-breadcrumb-item><a-button type="text" size="small" :title="t('runtimeDiagnostics.fileRoot')" :aria-label="t('runtimeDiagnostics.fileRoot')" @click="emit('navigate', -1)"><HomeOutlined /></a-button></a-breadcrumb-item><a-breadcrumb-item v-for="(file, index) in model.parents" :key="logFileKey(file)"><a-button type="text" size="small" class="log-path-part" :title="file.name" @click="emit('navigate', index)">{{ file.name }}</a-button></a-breadcrumb-item></a-breadcrumb></div>
    <div v-if="failed" class="log-catalog-error" role="status"><WarningOutlined /><span>{{ model.state.message || t(`runtimeDiagnostics.${model.state.status === 'forbidden' ? 'forbidden' : model.state.status === 'unsupported' ? 'unsupported' : 'failed'}`) }}</span></div>
    <a-spin :spinning="model.state.status === 'loading'" class="log-catalog-list-state"><div class="log-catalog-list">
      <a-button v-for="file in model.files" :key="logFileKey(file)" type="text" block class="log-file-entry" :class="{ 'log-file-entry--selected': logFileKey(file) === model.selectedKey }" :aria-pressed="logFileKey(file) === model.selectedKey" :title="[file.name, logFileMetadata(file).modified].filter(Boolean).join('\n')" @click="emit('select', logFileKey(file))"><span class="log-file-entry-name"><FolderOutlined v-if="file.directory" /><FileZipOutlined v-else-if="/\.zip$/i.test(file.name) && !file.entry" /><FileTextOutlined v-else /><span>{{ file.name }}</span></span><span v-if="logFileMetadata(file).summary" class="log-file-entry-meta">{{ logFileMetadata(file).summary }}</span></a-button>
      <a-empty v-if="!model.files.length && model.state.status !== 'loading' && !failed" :description="t('runtimeDiagnostics.emptyDirectory')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </div></a-spin>
  </nav>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty } from 'ant-design-vue'
import { ArrowUpOutlined, FileTextOutlined, FileZipOutlined, FolderOutlined, HomeOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons-vue'
import type { LogFile, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { logFileKey, logFileMetadata } from './logFilePresentation'
const props = defineProps({ model: { type: Object as PropType<{ files: LogFile[]; parents: LogFile[]; selectedKey: string; state: ViewState }>, required: true } })
const emit = defineEmits<{ (event: 'select', key: string): void; (event: 'parent' | 'refresh'): void; (event: 'navigate', index: number): void }>()
const { t } = useI18n()
const failed = computed(() => ['error', 'forbidden', 'unsupported'].includes(props.model.state.status))
</script>
<style scoped>
.log-file-explorer { display:flex; flex-direction:column; min-width:0; min-height:0; height:100%; background:var(--bg-surface); }
header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; min-height:42px; border-bottom:1px solid var(--line); flex:none; }header strong { font-size:var(--fs-body,14px); font-weight:600; }header :deep(.ant-btn) { padding-inline:5px; }
.log-catalog-breadcrumb { padding:4px 6px; overflow-x:auto; flex:none; border-bottom:1px solid var(--line); }.log-catalog-breadcrumb :deep(.ant-breadcrumb ol) { display:flex; flex-wrap:nowrap; align-items:center; width:max-content; }.log-catalog-breadcrumb :deep(.ant-breadcrumb li) { display:flex; align-items:center; }.log-catalog-breadcrumb :deep(.ant-btn) { padding-inline:3px; font-size:var(--fs-caption,12px); }.log-path-part { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.log-catalog-error { display:flex; align-items:flex-start; gap:6px; color:var(--warning); padding:8px; font-size:var(--fs-caption,12px); overflow-wrap:anywhere; flex:none; }.log-catalog-error > .anticon { margin-top:3px; }
.log-catalog-list-state { display:flex; flex:1; min-height:0; }.log-catalog-list-state :deep(.ant-spin-container) { flex:1; min-height:0; overflow:auto; }.log-catalog-list { padding:4px; min-width:0; }
.log-file-entry { display:flex; flex-direction:column; align-items:stretch; justify-content:center; text-align:start; height:auto; min-height:34px; padding:6px; border-radius:3px; margin-bottom:1px; }.log-file-entry-name { display:flex; align-items:center; gap:7px; min-width:0; font-size:var(--fs-sm,13px); }.log-file-entry-name > .anticon { flex:none; color:var(--ink-3); }.log-file-entry-name > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }.log-file-entry-meta { padding-inline-start:21px; font-size:var(--fs-caption,12px); color:var(--ink-3); line-height:1.6; white-space:nowrap; }.log-file-entry--selected { background:var(--accent-soft); color:var(--accent); font-weight:500; }.log-file-entry--selected .anticon { color:var(--accent); }.log-catalog-list :deep(.ant-empty) { margin-block:28px; font-size:var(--fs-caption,12px); }
</style>
