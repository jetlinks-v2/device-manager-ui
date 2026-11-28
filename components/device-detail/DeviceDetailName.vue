<template>
  <I18nTextEditable :key="`${projectId}:${deviceId}`" :value="name" :i18n-messages="i18nMessages" field="name" :title="displayName" size="small" :label="t('UnifiedDeviceList.name')" :disabled="!allowed || disabled" :save="save" save-feedback :i18n-max-length="64" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { I18nTextEditable, i18nText } from '@jetlinks-web-core/components/I18n'
import { useDeviceHeaderEditing } from './useDeviceHeaderEditing'
const props = defineProps<{ deviceId: string; projectId?: string; name: string; i18nMessages?: Record<string, Record<string, string>>; allowed: boolean; disabled?: boolean; refresh: (id: string) => void | Promise<void> }>()
const { t, locale } = useI18n()
const displayName = computed(() => i18nText(props.name, props.i18nMessages?.name, String(locale.value)))
const { saveName } = useDeviceHeaderEditing(props)
async function save(change: { value: string; i18nMessages: Record<string, Record<string, string>> }) { await saveName(change.value, change.i18nMessages.name); return true }
</script>
