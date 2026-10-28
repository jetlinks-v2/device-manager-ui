<template>
  <div class="rule-stage" :class="{ 'rule-stage-caption': caption }">
    <span v-if="caption" class="rule-stage-title"><AIcon :type="icons[section]" />{{ $t(`PropertyRules.stage.${section}`) }}</span>
    <div class="rule-stage-lines"><slot /></div>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RuleSection } from './summary'
defineProps<{ section: RuleSection; caption?: boolean }>()
const { t: $t } = useI18n()
const icons: Record<RuleSection, string> = { cleaning: 'ClearOutlined', processing: 'CalculatorOutlined', alarm: 'AlertOutlined', sampling: 'FilterOutlined' }
</script>
<style scoped>
.rule-stage { min-width: 0; }
.rule-stage + .rule-stage { margin-top: var(--space-1); }
.rule-stage-title { display: flex; align-items: center; gap: var(--space-1); min-height: 16px; margin-bottom: 2px; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); line-height: 16px; white-space: nowrap; }
.rule-stage-title::after { content: ''; flex: 1; border-top: 1px solid var(--line); }
.rule-stage-lines { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
</style>
