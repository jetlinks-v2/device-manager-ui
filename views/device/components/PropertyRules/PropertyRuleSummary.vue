<template>
  <div class="rule-summary" :class="{ 'rule-set-has-alarm': rows.some(row => row.key === 'alarm') }">
    <PropertyRuleStage v-for="group in groups" :key="group.section" :section="group.section" :caption="groups.length > 1">
      <template v-if="group.rows.some(row => row.recordInvalid)" #extra><RuleInvalidRecord readonly /></template>
      <template v-for="row in group.rows" :key="row.key">
        <a-button v-if="interactive" type="text" size="small" class="rule-summary-button" @click="$emit('edit')">
          <PropertyRuleSummaryLine :row="row" :levels="levels" />
        </a-button>
        <PropertyRuleSummaryLine v-else :row="row" :levels="levels" />
      </template>
    </PropertyRuleStage>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ruleStageOf, type RuleRowSummary, type RuleSection } from './summary'
import type { AlarmLevelOption } from '../../alarm/types'
import PropertyRuleSummaryLine from './PropertyRuleSummaryLine.vue'
import PropertyRuleStage from './PropertyRuleStage.vue'
import RuleInvalidRecord from './RuleInvalidRecord.vue'
const props = defineProps<{ rows: RuleRowSummary[]; interactive?: boolean; levels?: AlarmLevelOption[] }>()
defineEmits<{ (e: 'edit'): void }>()
const groups = computed(() => props.rows.reduce<{ section: RuleSection; rows: RuleRowSummary[] }[]>((result, row) => {
  const section = ruleStageOf(row.key)
  const previous = result[result.length - 1]
  if (previous?.section === section) previous.rows.push(row)
  else result.push({ section, rows: [row] })
  return result
}, []))
</script>
<style scoped>
.rule-summary { container: rule-fields / inline-size; display: flex; flex-direction: column; width: 700px; max-width: 100%; }
.rule-summary :deep(.rule-line-alarm > .rule-kind .ant-tag) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rule-summary-button { display: block; width: 100%; height: auto; padding: 0; text-align: left; white-space: normal; }
</style>
