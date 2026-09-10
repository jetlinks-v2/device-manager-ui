<template>
  <a-modal :open="Boolean(state.record)" :width="600" :title="$t('DeviceAlarm.workspace.handle')"
    :confirm-loading="state.busy" :closable="!state.busy" :mask-closable="!state.busy" :keyboard="!state.busy"
    :cancel-button-props="{ disabled: state.busy }" :ok-text="$t('DeviceAlarm.workspace.confirmHandle')"
    @cancel="emit('close')" @ok="emit('submit')">
    <template v-if="state.record">
      <a-descriptions :column="1" size="small">
        <a-descriptions-item :label="$t('DeviceAlarm.record.alarmName')">{{ state.record.alarmName || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.sourceDevice')">{{ state.record.sourceName || state.record.targetName || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.workspace.lastAlarmTime')">{{ formatApiTime(state.record.lastAlarmTime || state.record.alarmTime) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.reason')">{{ state.record.actualDesc || '—' }}</a-descriptions-item>
      </a-descriptions>
      <a-form layout="vertical">
        <a-form-item required :label="$t('DeviceAlarm.record.handleDescription')" :help="state.error || undefined" :validate-status="state.error ? 'error' : undefined">
          <a-textarea :value="state.description" :rows="4" :maxlength="200" show-count :disabled="state.busy"
            :placeholder="$t('DeviceAlarm.record.handleDescriptionPlaceholder')" @update:value="value => emit('description', value)" />
        </a-form-item>
      </a-form>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatApiTime } from '../../list/services/iotDeviceDetailReal.service'
import type { DeviceAlarmEvent } from '../workspaceTypes'
defineProps<{ state: { record?: DeviceAlarmEvent; description: string; error: string; busy: boolean } }>()
const emit = defineEmits<{
  (event: 'description', value: string): void
  (event: 'close' | 'submit'): void
}>()
const { t: $t } = useI18n()
</script>
