<template>
  <a-popover :open="open" :trigger="['click']" placement="bottomLeft" @open-change="changeOpen">
    <a-tooltip :title="text || placeholder"><button v-bind="$attrs" class="device-scope-cell" :class="{ 'is-missing': !text, 'is-editable': allowed }" type="button" :disabled="!allowed || disabled" :aria-label="`${t(kind === 'area' ? 'UnifiedDeviceList.changeArea' : 'UnifiedDeviceList.changeGroups')} · ${text || placeholder}`"><AIcon v-if="showIcon" :type="detailMetaIcons[kind === 'area' ? 'space' : 'group']" /><span>{{ text || placeholder }}</span></button></a-tooltip>
    <template #content>
      <div class="device-scope-cell__editor" @keydown.esc.stop.prevent="!saving && (open = false)">
        <strong>{{ t(kind === 'area' ? 'UnifiedDeviceList.changeArea' : 'UnifiedDeviceList.changeGroups') }}</strong>
        <a-skeleton v-if="loading" active :title="false" :paragraph="{ rows: 3 }" />
        <a-alert v-else-if="loadError" type="error" :message="loadError" />
        <a-tree-select v-else :value="kind === 'group' ? draft : draft[0]" :tree-data="options" :multiple="kind === 'group'" :allow-clear="kind === 'group'" show-search tree-default-expand-all tree-node-filter-prop="title" :placeholder="placeholder" :disabled="saving" :dropdown-style="{ maxHeight: '280px', overflow: 'auto' }" @change="changeDraft" />
        <a-typography-text v-if="failure" type="danger" role="alert">{{ failure }}</a-typography-text>
        <div class="device-scope-cell__actions"><a-button size="small" :disabled="saving" @click="open = false">{{ t('Editable.cancel') }}</a-button><a-button type="primary" size="small" :loading="saving" :disabled="!allowed || disabled || loading || !!loadError || (kind === 'area' && !draft.length)" @click="submit">{{ t('Editable.save') }}</a-button></div>
      </div>
    </template>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { detailMetaIcons } from '@jetlinks-web-core/components/DetailMetaItem'
import type { DeviceScopeKind, DeviceScopeOption } from './deviceScopeTypes'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ kind: DeviceScopeKind; text: string; value: string[]; options: DeviceScopeOption[]; allowed: boolean; disabled: boolean; loading: boolean; loadError: string; save: (ids: string[]) => Promise<void>; showIcon?: boolean }>(), { showIcon: true })
const emit = defineEmits<{ (event: 'open-change', value: boolean): void }>()
const { t } = useI18n()
const open = ref(false), draft = ref<string[]>([]), saving = ref(false), failure = ref('')
const placeholder = computed(() => t(props.kind === 'area' ? 'IotDeviceList.scope.unboundArea' : 'IotDeviceList.scope.unassignedGroup'))
watch(open, value => { if (value) { draft.value = [...props.value]; failure.value = '' }; emit('open-change', value) })
watch(() => props.loading, (value, previous) => { if (previous && !value && open.value) draft.value = [...props.value] })
function changeOpen(value: boolean) { if (props.allowed && !props.disabled && !saving.value) open.value = value }
function changeDraft(value: unknown) { draft.value = Array.isArray(value) ? value.map(String) : value ? [String(value)] : []; failure.value = '' }
async function submit() {
  if (saving.value || !props.allowed || props.disabled || props.loading || props.loadError) return
  if (props.kind === 'area' && !draft.value.length) { failure.value = t('IotDeviceList.assignArea.selectRequired'); return }
  if ([...draft.value].sort().join('|') === [...props.value].sort().join('|')) { open.value = false; return }
  saving.value = true
  try { await props.save([...draft.value]); open.value = false }
  catch (error) { failure.value = error instanceof Error ? error.message : t('UnifiedDeviceList.actionFailed') }
  finally { saving.value = false }
}
</script>
<style scoped>
.device-scope-cell { display:flex; align-items:center; gap:6px; width:100%; min-width:0; padding:0; border:0; background:transparent; color:inherit; text-align:start; line-height:var(--device-scope-line-height, 20px); }
.device-scope-cell > span:last-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.device-scope-cell > .anticon { flex:none; font-size:12px; color:var(--jet-theme-text-secondary); }
.device-scope-cell.is-missing { color:var(--jet-theme-text-secondary); font-size:12px; }
.device-scope-cell.is-editable:not(:disabled) { cursor:pointer; }
.device-scope-cell.is-editable:not(:disabled):hover { color:var(--jet-theme-primary); text-decoration:underline; }
.device-scope-cell:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:3px; }
.device-scope-cell__editor { display:flex; flex-direction:column; gap:12px; width:min(300px, calc(100vw - 48px)); }
.device-scope-cell__actions { display:flex; justify-content:flex-end; gap:8px; }
</style>
