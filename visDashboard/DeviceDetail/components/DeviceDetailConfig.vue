<template>
  <a-form layout="vertical">
    <a-form-item :label="t('deviceDetailDashboard.title')"><a-input :value="config.title" :placeholder="t(titleKeys[kind])" :maxlength="60" @update:value="update('title', $event)" /></a-form-item>
    <a-form-item :label="t('deviceDetailDashboard.deviceId')" :help="t('deviceDetailDashboard.deviceHelp')"><a-input :value="config.deviceId" @update:value="update('deviceId', $event)" /></a-form-item>
    <a-form-item :label="t('deviceDetailDashboard.refresh')" :help="t('deviceDetailDashboard.refreshHelp')"><a-input-number :value="config.refreshSeconds" :min="0" :max="3600" :step="15" @update:value="update('refreshSeconds', $event)" /></a-form-item>
    <a-form-item v-if="kind === 'Properties'" :label="t('deviceDetailDashboard.pageSize')"><a-input-number :value="config.pageSize" :min="1" :max="12" :precision="0" @update:value="update('pageSize', $event)" /></a-form-item>
    <a-form-item v-if="kind === 'RecentAlarms'" :label="t('deviceDetailDashboard.limit')"><a-input-number :value="config.limit" :min="1" :max="20" :precision="0" @update:value="update('limit', $event)" /></a-form-item>
  </a-form>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { kinds, settingsOf, titleKeys, typeOf, type DeviceDetailInfo, type DeviceDetailConfig } from '../shared'
const props = defineProps({ activeComponent: { type: Object as PropType<DeviceDetailInfo>, required: true } })
const emit = defineEmits<{ change: [value: DeviceDetailConfig, key: string] }>()
const { t } = useI18n()
const kind = computed(() => kinds.find(kind => typeOf(kind) === props.activeComponent.type) || 'ActiveDuration')
const config = computed(() => settingsOf(kind.value, props.activeComponent))
function update(key: keyof DeviceDetailConfig, value: unknown) {
  emit('change', settingsOf(kind.value, { componentProps: { [typeOf(kind.value)]: { ...config.value, [key]: value } } }), typeOf(kind.value))
}
</script>
