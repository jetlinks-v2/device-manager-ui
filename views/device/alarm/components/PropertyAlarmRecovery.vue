<template>
  <span class="property-alarm-recovery">
    <span class="recovery-mode">
      <AIcon type="UndoOutlined" /><span>{{ $t('DeviceAlarm.condition.recovery.title') }}</span>
      <a-select :value="mode" :options="options" :disabled="disabled" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('DeviceAlarm.autoRelieve.title')" :title="mode === 'inverse' ? $t('DeviceAlarm.condition.recovery.inverseHint') : undefined" @update:value="changeMode" />
    </span>
    <span v-if="mode === 'custom'" class="recovery-condition"><PropertyAlarmCondition :model="model.relieveCondition!" :property="property" /></span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmFormModel, ThingModelProperty } from '../types'
import { invertCondition } from '../conditions'
import PropertyAlarmCondition from './PropertyAlarmCondition.vue'
const props = defineProps<{ model: DeviceAlarmFormModel; property: ThingModelProperty; disabled?: boolean }>()
const { t: $t } = useI18n()
const mode = computed(() => !props.model.autoRelieve ? 'off' : props.model.relieveCondition ? 'custom' : 'inverse')
const options = computed(() => ['off', 'inverse', 'custom'].map(value => ({ value, label: $t(`DeviceAlarm.condition.recovery.${value}`) })))
function changeMode(value: string) {
  if (props.disabled) return
  props.model.autoRelieve = value !== 'off'
  props.model.relieveCondition = value === 'custom' ? invertCondition(props.model) : undefined
}
</script>
<style scoped>
.property-alarm-recovery { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); min-width: 0; font-size: var(--fs-12); line-height: 24px; }
.recovery-mode, .recovery-condition { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 24px; }
.recovery-mode { color: var(--jet-theme-text-secondary); }
.recovery-mode :deep(.ant-select-selector) { font-size: inherit; }
.recovery-mode :deep(.ant-select-selection-item) { padding-inline-end: 14px; }
.recovery-mode :deep(.ant-select-arrow) { inset-inline-end: 0; font-size: 10px; }
.recovery-condition { color: var(--jet-theme-text); }
.recovery-condition :deep(.ant-input-number), .recovery-condition :deep(.ant-input-number-input), .recovery-condition :deep(.ant-select), .recovery-condition :deep(.ant-input) { font-size: inherit; }
.recovery-mode > :deep(.anticon) { font-size: 12px; }
</style>
