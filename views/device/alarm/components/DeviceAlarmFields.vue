<template>
  <a-form-item :label="$t('DeviceAlarm.form.name')" required>
    <a-input v-model:value="model.name" :maxlength="64" :placeholder="$t('DeviceAlarm.placeholder.name')" />
  </a-form-item>
  <a-form-item :label="$t('DeviceAlarm.form.level')" required>
    <a-select v-model:value="model.level" :options="levelOptions">
      <template #option="{ label }"><AIcon type="WarningOutlined" /> {{ label }}</template>
    </a-select>
  </a-form-item>
  <template v-if="!actionsOnly">
  <a-form-item :label="$t('DeviceAlarm.form.trigger')" required>
    <PropertyAlarmCondition :model="model" :property="conditionProperty" />
  </a-form-item>
  <PropertyAlarmRecovery :model="model" :property="conditionProperty" :disabled="disabled" />
  <p class="alarm-fields-preview"><AIcon type="InfoCircleOutlined" /> {{ previewText }}</p>
  </template>
  <a-button v-if="notificationDisclosure" class="alarm-notification-disclosure" type="text" block
    :aria-expanded="notificationDisclosure.open" @click="$emit('toggle-notification')">
    <AIcon :type="notificationDisclosure.open ? 'DownOutlined' : 'RightOutlined'" />
    <span>{{ $t('DeviceAlarm.notification.title') }}</span>
    <span class="alarm-notification-summary">{{ notificationDisclosure.summary }}</span>
  </a-button>
  <div v-show="!notificationDisclosure || notificationDisclosure.open">
    <RegistryComponent page-code="device/alarm" code="alarm-editor">
      <DeviceAlarmNotificationConfig :model="model" :methods="notifyMethods" :loading="notifyLoading" :disabled="disabled" />
    </RegistryComponent>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DeviceAlarmNotificationConfig from './DeviceAlarmNotificationConfig.vue'
import PropertyAlarmCondition from './PropertyAlarmCondition.vue'
import PropertyAlarmRecovery from './PropertyAlarmRecovery.vue'
import type { AlarmLevelOption, DeviceAlarmFormModel, DeviceAlarmNotifyMethod, ThingModelProperty } from '../types'
import { formatTriggerText } from '../utils'
const props = defineProps<{
  model: DeviceAlarmFormModel
  levelOptions: AlarmLevelOption[]
  property?: ThingModelProperty
  notifyMethods: DeviceAlarmNotifyMethod[]
  notifyLoading: boolean
  notificationDisclosure?: { open: boolean; summary: string }
  actionsOnly?: boolean
  disabled?: boolean
}>()
defineEmits<{ (e: 'toggle-notification'): void }>()
const { t: $t } = useI18n()
const conditionProperty = computed(() => props.property ?? { valueType: { type: 'double' } })
const previewText = computed(() => formatTriggerText({ ...props.model, propertyName: props.model.propertyName || $t('DeviceAlarm.preview.property') }))
</script>
<style scoped>
.alarm-fields-preview { color: var(--jet-theme-text-secondary); font-size: var(--fs-14); }
.alarm-notification-disclosure { display: flex; align-items: center; gap: var(--space-2); height: auto; padding: var(--space-2) 0; text-align: left; white-space: normal; }
.alarm-notification-summary { margin-left: auto; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
</style>
