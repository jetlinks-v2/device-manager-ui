<template>
  <InlineEditSurface :open="open && allowed" :label="label">
    <template #display="{ contentId }">
      <a-tooltip :title="text || placeholder"><button v-bind="$attrs" class="device-scope-cell" :class="{ 'is-missing': !text, 'is-editable': allowed }" type="button" :disabled="!allowed || disabled || saving" :aria-label="`${label} · ${text || placeholder}`" :aria-controls="contentId" :aria-expanded="open" @click="changeOpen(true)"><AIcon v-if="showIcon" :type="detailMetaIcons[kind === 'area' ? 'space' : 'group']" /><span class="device-scope-cell__text">{{ text || placeholder }}</span><SaveFeedback v-if="!open" :state="feedback" class="device-scope-cell__feedback" /></button></a-tooltip>
    </template>
    <span v-if="open" class="device-scope-cell__editor">
    <a-tree-select v-if="open" class="device-scope-cell__select" :value="kind === 'group' ? draft : draft[0]" :open="dropdownOpen" :tree-data="options" :multiple="kind === 'group'" :allow-clear="kind === 'group'" :max-tag-count="0" :max-tag-placeholder="values => values.map(item => item.label).join(' / ')" :bordered="false" size="small" show-search tree-default-expand-all tree-node-filter-prop="title" :placeholder="placeholder" :aria-label="label" :disabled="saving || disabled" :loading="loading" :dropdown-match-select-width="false" :dropdown-render="renderDropdown" :dropdown-style="{ minWidth: 'min(240px, calc(100vw - 32px))', maxWidth: 'calc(100vw - 32px)', maxHeight: '320px', overflow: 'auto' }" @change="selectDraft" @dropdown-visible-change="changeDropdownOpen" @keydown.esc.stop.prevent="changeOpen(false)" @keydown.ctrl.enter.stop.prevent="submit" @keydown.meta.enter.stop.prevent="submit">
      <template #suffixIcon><AIcon v-if="!feedback" type="DownOutlined" /></template>
    </a-tree-select>
      <SaveFeedback :state="feedback" class="device-scope-cell__editor-feedback" />
    </span>
  </InlineEditSurface>
      <DefineDropdown v-slot="{ menuNode }">
        <div class="device-scope-cell__dropdown">
          <a-skeleton v-if="loading" active :title="false" :paragraph="{ rows: 3 }" />
          <a-alert v-else-if="loadError" type="error" :message="loadError" />
          <component v-else :is="menuNode" />
          <a-typography-text v-if="failure" type="danger" role="alert">{{ failure }}</a-typography-text>
          <div class="device-scope-cell__actions" @mousedown.prevent><a-button size="small" :disabled="saving" @click="changeOpen(false)">{{ t('Editable.cancel') }}</a-button><a-button v-if="kind === 'group' || failure" type="primary" size="small" :loading="saving" :disabled="!allowed || disabled || loading || !!loadError" @click="submit">{{ t('Editable.save') }}</a-button></div>
        </div>
      </DefineDropdown>
</template>
<script setup lang="ts">
import { computed, h, type VNodeChild } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import type { TreeSelectProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import InlineEditSurface from '@jetlinks-web-core/components/InlineEditSurface'
import SaveFeedback from '@jetlinks-web-core/components/Editable/SaveFeedback.vue'
import { detailMetaIcons } from '@jetlinks-web-core/components/DetailMetaItem'
import { useDeviceScopeCellEditing } from './useDeviceScopeCellEditing'
import type { DeviceScopeKind, DeviceScopeOption } from './deviceScopeTypes'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ kind: DeviceScopeKind; text: string; value: string[]; options: DeviceScopeOption[]; allowed: boolean; disabled: boolean; loading: boolean; loadError: string; save: (ids: string[]) => Promise<void>; showIcon?: boolean }>(), { showIcon: true })
const emit = defineEmits<{ (event: 'open-change', value: boolean): void }>()
const { t } = useI18n()
const placeholder = computed(() => t(props.kind === 'area' ? 'IotDeviceList.scope.unboundArea' : 'IotDeviceList.scope.unassignedGroup'))
const label = computed(() => t(props.kind === 'area' ? 'UnifiedDeviceList.changeArea' : 'UnifiedDeviceList.changeGroups'))
const { open, dropdownOpen, draft, saving, failure, feedback, changeOpen, changeDropdownOpen, selectDraft, submit } = useDeviceScopeCellEditing(props, value => emit('open-change', value))
const [DefineDropdown, ScopeDropdown] = createReusableTemplate<{ menuNode?: VNodeChild }>()
const renderDropdown: TreeSelectProps['dropdownRender'] = options => h(ScopeDropdown, { menuNode: options?.menuNode })
</script>
<style scoped>
.device-scope-cell { position:relative; display:flex; align-items:center; gap:6px; width:100%; min-width:6em; padding:0; border:0; background:transparent; color:inherit; text-align:start; line-height:var(--device-scope-line-height, 20px); }
.device-scope-cell__text { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-scope-cell.is-editable { padding-inline-end:20px; }
.device-scope-cell__feedback { position:absolute; inset-inline-end:2px; }
.device-scope-cell > .anticon { flex:none; font-size:12px; color:var(--jet-theme-text-secondary); }
.device-scope-cell.is-missing { color:var(--jet-theme-text-secondary); font-size:12px; }
.device-scope-cell.is-editable:not(:disabled) { cursor:pointer; }
.device-scope-cell.is-editable:not(:disabled):hover { color:var(--jet-theme-primary); text-decoration:underline; }
.device-scope-cell:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:3px; }
.device-scope-cell__editor { position:relative; display:block; width:var(--inline-edit-anchor-width, 6em); max-width:calc(100vw - 52px); }
.device-scope-cell__select { width:100%; font-size:inherit; }
.device-scope-cell__editor-feedback { position:absolute; inset-inline-end:10px; top:0; bottom:0; margin-block:auto; height:16px; pointer-events:none; }
.device-scope-cell__dropdown { display:flex; flex-direction:column; gap:8px; }
.device-scope-cell__dropdown > :is(.ant-skeleton,.ant-alert) { padding:8px; }
.device-scope-cell__actions { display:flex; justify-content:flex-end; gap:8px; padding:8px; border-top:1px solid var(--line); }
</style>
