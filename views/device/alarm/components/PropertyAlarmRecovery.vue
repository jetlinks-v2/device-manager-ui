<template>
  <span class="property-alarm-recovery">
    <span class="recovery-mode"><AIcon type="UndoOutlined" /><a-select :value="mode" :options="options" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('DeviceAlarm.autoRelieve.title')" @update:value="changeMode" /></span>
    <span v-if="mode === 'custom'" class="recovery-condition"><PropertyAlarmCondition :model="model.relieveCondition!" :property="property" /><span>{{ $t('DeviceAlarm.condition.thenRecover') }}</span></span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmFormModel, ThingModelProperty } from '../types'
import { invertCondition } from '../conditions'
import PropertyAlarmCondition from './PropertyAlarmCondition.vue'
const props = defineProps<{ model: DeviceAlarmFormModel; property: ThingModelProperty }>()
const { t: $t } = useI18n()
const mode = computed(() => !props.model.autoRelieve ? 'off' : props.model.relieveCondition ? 'custom' : 'inverse')
const options = computed(() => ['off', 'inverse', 'custom'].map(value => ({ value, label: $t(`DeviceAlarm.condition.recovery.${value}`) })))
function changeMode(value: string) {
  props.model.autoRelieve = value !== 'off'
  props.model.relieveCondition = value === 'custom' ? invertCondition(props.model) : undefined
}
</script>
<style scoped>
.property-alarm-recovery { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-2); width: 100%; min-width: 0; font-size: inherit; }
.recovery-mode, .recovery-condition { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); min-height: 24px; }
.recovery-mode { color: var(--jet-theme-text-secondary); }
.recovery-mode :deep(.ant-select-selector) { font-size: inherit; }
.recovery-mode > :deep(.anticon) { font-size: 12px; }
</style>
