<template>
  <a-popover v-model:open="open" trigger="click" placement="bottomLeft" :title="label">
    <button ref="trigger" type="button" class="device-detail-description__trigger" :disabled="disabled" :title="display || t('IotDeviceDetail.header.emptyDescription')" :aria-label="`${label} · ${display || t('IotDeviceDetail.header.emptyDescription')}`" :aria-expanded="open" aria-haspopup="dialog" @keydown.esc.stop.prevent="close">{{ compact ? label : display || t('IotDeviceDetail.header.emptyDescription') }}</button>
    <template #content><div class="device-detail-description__editor" role="dialog" :aria-label="label" @keydown.esc.stop.prevent="close"><I18nTextEditable :key="`${projectId}:${deviceId}`" :value="description" :i18n-messages="messages" field="description" :edit-request="open ? 1 : 0" :label="label" :placeholder="t('IotDeviceDetail.header.emptyDescription')" :disabled="!allowed || disabled" :save="save" save-feedback :i18n-max-length="200" size="small" textarea /></div></template>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { I18nTextEditable, i18nText } from '@jetlinks-web-core/components/I18n'
import { useDeviceHeaderEditing } from './useDeviceHeaderEditing'
const props = defineProps<{ deviceId: string; projectId?: string; description: string; i18nMessages?: Record<string, Record<string, string>>; allowed: boolean; disabled?: boolean; compact?: boolean; refresh: (id: string) => void | Promise<void> }>()
const { t, locale } = useI18n()
const open = ref(false)
const trigger = ref<HTMLButtonElement>()
function close() { open.value = false; void nextTick(() => trigger.value?.focus({ preventScroll: true })) }
watch(() => [props.deviceId, props.projectId], () => { open.value = false })
const label = computed(() => t('IotDeviceList.basicFields.label.description'))
const messages = computed(() => ({ ...props.i18nMessages, description: props.i18nMessages?.description ?? props.i18nMessages?.describe ?? {} }))
const display = computed(() => i18nText(props.description, messages.value.description, String(locale.value)))
const { saveDescription } = useDeviceHeaderEditing(props)
async function save(change: { value: string; i18nMessages: Record<string, Record<string, string>> }) { await saveDescription(change.value, change.i18nMessages.description); return true }
</script>
<style scoped>
.device-detail-description__trigger { display:block; max-width:100%; min-width:0; padding:0; border:0; background:transparent; color:inherit; font:inherit; text-align:start; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.device-detail-description__trigger:hover { color:var(--jet-theme-primary); text-decoration:underline; }
.device-detail-description__trigger:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:2px; }
.device-detail-description__editor { width:min(320px,calc(100vw - 48px)); max-height:calc(100vh - 96px); overflow:auto; --inline-edit-max-height:12rem; }
</style>
