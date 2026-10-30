<template>
  <a-dropdown v-if="parts.length || clearLabel" :trigger="['click']" :disabled="disabled">
    <a-button type="text" size="small" class="rule-add-trigger"><AIcon :type="parts.length ? 'PlusOutlined' : 'MoreOutlined'" />{{ $t(parts.length ? 'PropertyRules.addPart' : 'PropertyRules.more') }}</a-button>
    <template #overlay><a-menu class="rule-choice-menu">
      <a-menu-item-group v-for="group in groups" :key="`stage-${group.key}`" :title="$t(`PropertyRules.stage.${group.key}`)">
        <a-menu-item v-for="part in group.parts" :key="part" @click="$emit('add', part)">
          <RuleMenuOption :class="`rule-menu-option-${group.key}`" :icon="labels[part].icon" :title="$t(labels[part].label)" :description="$t(`PropertyRules.partHint.${part}`)" />
        </a-menu-item>
      </a-menu-item-group>
      <a-menu-divider v-if="parts.length && clearLabel" />
      <a-menu-item v-if="clearLabel" key="clear" @click="$emit('clear')"><span class="rule-add-clear"><AIcon type="DeleteOutlined" />{{ clearLabel }}</span></a-menu-item>
    </a-menu></template>
  </a-dropdown>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { RuleAddPart } from './codec'
import RuleMenuOption from './RuleMenuOption.vue'
const props = defineProps<{ parts: RuleAddPart[]; disabled?: boolean; clearLabel?: string }>()
defineEmits<{ (e: 'add', part: RuleAddPart): void; (e: 'clear'): void }>()
const { t: $t } = useI18n()
const labels: Record<RuleAddPart, { icon: string; label: string }> = {
  values: { icon: 'StopOutlined', label: 'PropertyRules.valueFilter' },
  range: { icon: 'SafetyOutlined', label: 'PropertyRules.validRange' },
  step: { icon: 'LineChartOutlined', label: 'PropertyRules.part.step' },
  scale: { icon: 'CalculatorOutlined', label: 'PropertyRules.part.scale' },
  fallback: { icon: 'HistoryOutlined', label: 'PropertyRules.part.fallback' },
  file: { icon: 'FileOutlined', label: 'PropertyRules.part.file' },
  alarm: { icon: 'AlertOutlined', label: 'PropertyRules.alarm' },
  sampling: { icon: 'FilterOutlined', label: 'PropertyRules.sampling' },
  interval: { icon: 'ClockCircleOutlined', label: 'PropertyRules.interval' },
  change: { icon: 'SwapOutlined', label: 'PropertyRules.change' },
}
const groups = computed(() => {
  const result = [
  { key: 'cleaning', parts: props.parts.filter(part => ['values', 'range', 'step'].includes(part)) },
  { key: 'processing', parts: props.parts.filter(part => part === 'scale' || part === 'fallback' || part === 'file') },
  { key: 'alarm', parts: props.parts.filter(part => part === 'alarm') },
  { key: 'sampling', parts: props.parts.filter(part => ['sampling', 'interval', 'change'].includes(part)) },
  ].filter(group => group.parts.length)
  return props.parts.includes('file') ? [...result.filter(group => group.key !== 'processing'), ...result.filter(group => group.key === 'processing')] : result
})
</script>
<style scoped lang="less">
@import './rule-menu.less';
.rule-add-trigger { color: var(--jet-theme-text-secondary); padding-inline: var(--space-1); }
.rule-add-trigger:not(:disabled):hover, .rule-add-trigger:focus-visible { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.rule-add-trigger:focus-visible { outline: 1px solid var(--jet-theme-primary); }
.rule-add-clear { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-14); line-height: 24px; }
.rule-add-clear :deep(.anticon) { width: 24px; font-size: 16px; color: var(--jet-theme-text-secondary); }
@media (pointer: coarse) { .rule-add-trigger { min-height: 40px; } }
</style>
