<template>
  <div class="alarm-trigger-form">
    <a-form-item :label="$t('DeviceAlarm.form.trigger')" required>
      <PropertyAlarmCondition :model="model" :property="property" layout="form" />
    </a-form-item>
    <div class="alarm-condition-preview">
      <AIcon type="InfoCircleOutlined" /><span>{{ preview }}</span>
    </div>
    <a-form-item :label="$t('DeviceAlarm.autoRelieve.title')">
      <PropertyAlarmRecovery :model="model" :property="property" :disabled="disabled" layout="form" />
    </a-form-item>
    <div v-if="model.autoRelieve" class="alarm-condition-preview">
      <AIcon type="CheckCircleOutlined" /><span>{{ $t('DeviceAlarm.autoRelieve.condition') }}{{ relievePreview }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PropertyAlarmCondition from '../PropertyAlarmCondition.vue'
import PropertyAlarmRecovery from '../PropertyAlarmRecovery.vue'
import type { DeviceAlarmFormModel, ThingModelProperty } from '../../types'
defineProps<{ model: DeviceAlarmFormModel; property: ThingModelProperty; preview: string; relievePreview: string; disabled: boolean }>()
const { t: $t } = useI18n()
</script>
<style scoped>
.alarm-trigger-form { display: grid; gap: var(--space-4); }
.alarm-trigger-form :deep(.ant-form-item) { margin-bottom: 0; }
.alarm-condition-preview { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-3); border-radius: var(--r-3); background: var(--jet-theme-primary-bg); color: var(--jet-theme-text-secondary); line-height: 1.6; overflow-wrap: anywhere; }
.alarm-condition-preview :deep(.anticon) { flex: none; margin-top: 0.3em; color: var(--jet-theme-primary); }
</style>
