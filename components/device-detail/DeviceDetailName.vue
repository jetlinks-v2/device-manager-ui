<template>
  <InputEditable :key="`${projectId}:${deviceId}`" :value="displayName" :title="displayName" size="small" trigger="text" :label="`${t('Editable.edit')} ${t('UnifiedDeviceList.name')} · ${displayName}`" :disabled="!allowed || disabled" :error="failure" :save="save" save-feedback :max-length="64" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InputEditable from '@jetlinks-web-core/components/Editable/InputEditable.vue'
import { i18nText } from '@jetlinks-web-core/components/I18n'
import { useDeviceHeaderEditing } from './useDeviceHeaderEditing'
const props = defineProps<{ deviceId: string; projectId?: string; name: string; i18nMessages?: Record<string, Record<string, string>>; allowed: boolean; disabled?: boolean; refresh: (id: string) => void | Promise<void> }>()
const { t, locale } = useI18n()
const displayName = computed(() => i18nText(props.name, props.i18nMessages?.name, String(locale.value)))
const { failure, saveName } = useDeviceHeaderEditing(props)
async function save(value: string) { await saveName(value); return true }
</script>
