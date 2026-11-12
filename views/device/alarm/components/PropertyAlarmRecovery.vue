<template>
  <span class="property-alarm-recovery" :class="{ 'is-off': !model.autoRelieve, 'is-form': layout === 'form' }">
    <a-select v-if="layout === 'form'" :value="mode" :options="options" :disabled="disabled" :aria-label="$t('DeviceAlarm.autoRelieve.title')" @change="value => changeMode(String(value))" />
    <AIcon v-else type="CheckCircleOutlined" class="recovery-icon" />
    <span v-if="layout !== 'form' || (model.autoRelieve && model.relieveCondition)" class="recovery-body">
      <template v-if="model.autoRelieve">
        <PropertyAlarmCondition v-if="model.relieveCondition" :model="model.relieveCondition" :property="property" :layout="layout" recovery />
        <span v-else :title="$t('DeviceAlarm.condition.recovery.inverseHint')">{{ inferredText }}</span>
        <span v-if="layout !== 'form'">{{ $t('DeviceAlarm.sentence.when') }}</span>
      </template>
      <a-dropdown v-if="layout !== 'form'" :trigger="['click']" :disabled="disabled">
        <a-button type="text" size="small" class="recovery-action" :disabled="disabled" :aria-label="$t('DeviceAlarm.autoRelieve.title')">
          {{ $t(model.autoRelieve ? 'DeviceAlarm.condition.recovery.action' : 'DeviceAlarm.condition.recovery.off') }}<AIcon type="DownOutlined" />
        </a-button>
        <template #overlay><a-menu class="rule-choice-menu" :selected-keys="[mode]" @click="changeMode(String($event.key))"><a-menu-item v-for="item in options" :key="item.value"><RuleMenuOption compact :icon="item.icon" :title="item.label" :description="$t(`DeviceAlarm.condition.recovery.hint.${item.value}`)" /></a-menu-item></a-menu></template>
      </a-dropdown>
    </span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceAlarmFormModel, ThingModelProperty } from '../types'
import { invertCondition } from '../conditions'
import { formatTriggerText, formatPropertyUnit, isNumberProperty } from '../utils'
import PropertyAlarmCondition from './PropertyAlarmCondition.vue'
import RuleMenuOption from '../../components/PropertyRules/RuleMenuOption.vue'
const props = defineProps<{ model: DeviceAlarmFormModel; property: ThingModelProperty; disabled?: boolean; layout?: 'inline' | 'form' | 'detail' }>()
const { t: $t } = useI18n()
const mode = computed(() => !props.model.autoRelieve ? 'off' : props.model.relieveCondition ? 'custom' : 'inverse')
const options = computed(() => [{ value: 'off', icon: 'StopOutlined' }, { value: 'inverse', icon: 'SwapOutlined' }, { value: 'custom', icon: 'EditOutlined' }]
  .map(item => ({ ...item, label: $t(`DeviceAlarm.condition.recovery.${item.value}`) })))
// 跟随模式只展示推导结果，不提供会误改主触发条件的输入框。
const inferredText = computed(() => [formatTriggerText(invertCondition(props.model), props.property, $t),
  isNumberProperty(props.property) ? formatPropertyUnit(props.property.valueType) : undefined].filter(Boolean).join(' '))
function changeMode(value: string) {
  if (props.disabled || value === mode.value) return
  props.model.autoRelieve = value !== 'off'
  props.model.relieveCondition = value === 'custom' ? invertCondition(props.model) : undefined
}
</script>
<style scoped lang="less">
@import '../../components/PropertyRules/rule-menu.less';
.property-alarm-recovery { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; column-gap: 6px; min-width: 0; font-size: var(--fs-12); line-height: 24px; }
.recovery-icon { display: flex; align-items: center; justify-content: center; height: 24px; color: var(--jet-theme-success, #52c41a); font-size: 14px; }
.recovery-body { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; min-width: 0; color: var(--jet-theme-text); }
.recovery-action { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0; font: inherit; line-height: 24px; }
.recovery-action :deep(.anticon) { font-size: 10px; color: var(--jet-theme-text-secondary); }
.is-off .recovery-icon, .is-off .recovery-body, .is-off .recovery-action { color: var(--jet-theme-text-secondary); }
@media (pointer: coarse) { .recovery-action { min-height: 36px; } }
.property-alarm-recovery.is-form { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); font-size: var(--fs-14); }
.is-form .recovery-body { width: 100%; line-height: 1.6; overflow-wrap: anywhere; }
.is-form .recovery-body > .property-alarm-condition { width: 100%; }
</style>
