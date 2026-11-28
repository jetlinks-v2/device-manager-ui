<template>
  <a-popover :open="open" trigger="click" placement="bottomLeft" @open-change="changeOpen">
    <button type="button" class="device-detail-icon" :disabled="!allowed || disabled" :title="t('IotDeviceDetail.header.editIcon')" :aria-label="t('IotDeviceDetail.header.editIcon')" aria-haspopup="dialog" :aria-expanded="open" @keydown.esc.stop.prevent="!busy && (open = false)">
      <IconValueView v-if="value" :value="value" :size="40" style="width:100%;height:100%" :fallback-text="name" /><AIcon v-else :type="fallbackIcon" aria-hidden="true" /><span class="device-detail-icon__edit"><AIcon type="EditOutlined" /></span>
    </button>
    <template #content>
      <div class="device-detail-icon__editor" @keydown.esc.stop.prevent="!busy && (open = false)">
        <strong>{{ t('IotDeviceDetail.header.editIcon') }}</strong>
        <pro-upload v-model="draft" />
        <a-typography-text v-if="failure" type="danger" role="alert">{{ failure }}</a-typography-text>
        <div class="device-detail-icon__actions"><a-button size="small" :disabled="busy" @click="open = false">{{ t('Editable.cancel') }}</a-button><a-button size="small" type="primary" :loading="busy" @click="submit">{{ t('Editable.save') }}</a-button></div>
      </div>
    </template>
  </a-popover>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'
import { useDeviceHeaderEditing } from './useDeviceHeaderEditing'
const props = defineProps<{ deviceId: string; projectId?: string; value?: string; name: string; fallbackIcon: string; allowed: boolean; disabled?: boolean; refresh: (id: string) => void | Promise<void> }>()
const { t } = useI18n(), open = ref(false), draft = ref('')
const { busy, failure, saveIcon } = useDeviceHeaderEditing(props)
function changeOpen(value: boolean) { if (!busy.value && props.allowed && !props.disabled) { if (value) { draft.value = props.value || ''; failure.value = '' } open.value = value } }
async function submit() { if (busy.value || !props.allowed || props.disabled) return; try { if (draft.value !== (props.value || '')) await saveIcon(draft.value); open.value = false } catch { /* 字段错误由共享编辑状态显示，保留草稿。 */ } }
watch(() => [props.deviceId, props.projectId], () => { open.value = false })
</script>
<style scoped>
.device-detail-icon { display:grid; place-items:center; position:relative; width:100%; height:100%; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; font-size:inherit; }
.device-detail-icon:disabled { cursor:default; }
.device-detail-icon:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:-2px; }
.device-detail-icon__edit { position:absolute; inset-inline-end:0; bottom:0; font-size:10px; line-height:14px; width:14px; background:var(--jet-theme-bg-container); border-radius:3px; opacity:0; }
.device-detail-icon:not(:disabled):is(:hover,:focus-visible) .device-detail-icon__edit { opacity:1; }
.device-detail-icon[aria-expanded="true"] .device-detail-icon__edit { opacity:1; }
.device-detail-icon__editor { display:grid; gap:12px; width:min(280px, calc(100vw - 48px)); }
.device-detail-icon__actions { display:flex; justify-content:flex-end; gap:8px; }
@media (hover:none) { .device-detail-icon:not(:disabled) .device-detail-icon__edit { opacity:1; } }
</style>
