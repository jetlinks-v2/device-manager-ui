<template>
  <PropertyRuleLine :icon="mode.icon" :title="$t(mode.title)" color="cyan">
    <template #label>
      <a-dropdown v-model:open="menuOpen" :trigger="['click']" :disabled="!editor.editable">
        <a-button type="text" size="small" class="sampling-kind" :aria-label="$t('PropertyRules.strategy')">
          <a-tooltip :open="menuOpen ? false : undefined" :title="draft.samplingMode === 'ratio' ? $t('PropertyRules.samplingHint') : undefined"><a-tag color="cyan"><AIcon :type="mode.icon" />{{ $t(mode.title) }}<RuleNotice v-if="draft.samplingMode !== 'ratio'" :message="`${$t(draft.samplingMode === 'interval' ? 'PropertyRules.intervalHint' : 'PropertyRules.deadbandHint')} ${$t('PropertyRules.statefulHint')}`" /><AIcon type="DownOutlined" /></a-tag></a-tooltip>
        </a-button>
        <template #overlay><a-menu class="rule-choice-menu" :selected-keys="[draft.samplingMode]">
          <a-menu-item v-for="option in modes" :key="option.value" @click="draft.samplingMode = option.value; menuOpen = false"><RuleMenuOption :icon="option.icon" :title="$t(option.label)" :description="$t(option.description)" /></a-menu-item>
        </a-menu></template>
      </a-dropdown>
    </template>
    <template v-if="draft.samplingMode === 'ratio'">
      <span>{{ $t('PropertyRules.sentence.sample') }}</span><span class="rule-phrase"><a-input-number v-model:value="draft.percent" size="small" :min="0" :max="100" :controls="false" :aria-label="$t('PropertyRules.keepPercent')" />%</span>
    </template>
    <template v-else-if="draft.samplingMode === 'interval'">
      <I18nT keypath="PropertyRules.sentence.intervalRule" scope="global" tag="span" class="rule-clause"><template #interval><span class="rule-phrase"><a-input-number v-model:value="draft.interval" size="small" :min="1 / draft.intervalUnit" :controls="false" :aria-label="$t('PropertyRules.intervalAmount')" /><a-select v-model:value="draft.intervalUnit" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('PropertyRules.intervalUnit')" :options="units" /></span></template></I18nT>
    </template>
    <template v-else-if="editor.numeric">
      <I18nT keypath="PropertyRules.sentence.changeRule" scope="global" tag="span" class="rule-clause"><template #kind><a-tooltip :title="$t('PropertyRules.deadbandHint')"><a-select v-model:value="draft.deadbandType" size="small" :bordered="false" :dropdown-match-select-width="false" :aria-label="$t('PropertyRules.deadbandType')" :options="deadbandTypes" /></a-tooltip></template><template #operator>{{ Number(draft.deadband) === 0 ? '>' : '≥' }}</template><template #threshold><span class="rule-phrase"><a-input-number v-model:value="draft.deadband" size="small" :min="0" :controls="false" :aria-label="$t('PropertyRules.deadband')" />{{ draft.deadbandType === 'percent' ? '%' : editor.unit }}</span></template></I18nT>
    </template>
    <span v-else>{{ $t('PropertyRules.sentence.changeScalar') }}</span>
    <span v-if="draft.samplingMode === 'change'" class="rule-phrase rule-optional">
      <a-checkbox :checked="draft.maxSilence != null" :aria-label="$t('PropertyRules.maxSilence')" @update:checked="draft.maxSilence = $event ? 60000 : null">{{ $t(draft.maxSilence == null ? 'PropertyRules.maxSilence' : 'PropertyRules.sentence.orInterval') }}</a-checkbox>
      <template v-if="draft.maxSilence != null"><a-input-number :value="draft.maxSilence / 1000" :min="0.001" size="small" :controls="false" :aria-label="$t('PropertyRules.maxSilence')" @update:value="draft.maxSilence = $event == null ? 0 : Number($event) * 1000" /><span>{{ $t('PropertyRules.timeUnit.s') }}</span><RuleNotice :message="$t('PropertyRules.maxSilenceHint')" /></template>
    </span>
    <template #action><a-button type="text" size="small" :aria-label="$t('PropertyRules.removePart', { name: $t('PropertyRules.stage.sampling') })" @click="draft.samplingEnabled = false"><AIcon type="CloseOutlined" /></a-button></template>
  </PropertyRuleLine>
</template>
<script setup lang="ts">
import { computed, ref, type UnwrapNestedRefs } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import type { usePropertyRuleEditor } from './usePropertyRuleEditor'
import type { SamplingMode } from './sampling'
import PropertyRuleLine from './PropertyRuleLine.vue'
import RuleMenuOption from './RuleMenuOption.vue'
import RuleNotice from './RuleNotice.vue'
const props = defineProps<{ editor: UnwrapNestedRefs<ReturnType<typeof usePropertyRuleEditor>> }>()
const { t: $t } = useI18n()
const menuOpen = ref(false)
const draft = computed(() => props.editor.draft!)
const modes = computed(() => ([
  { value: 'ratio', title: 'PropertyRules.part.sampling', label: 'PropertyRules.sampling', description: 'PropertyRules.partHint.sampling', icon: 'FilterOutlined' },
  { value: 'interval', title: 'PropertyRules.part.interval', label: 'PropertyRules.interval', description: 'PropertyRules.partHint.interval', icon: 'ClockCircleOutlined' },
  { value: 'change', title: 'PropertyRules.part.change', label: 'PropertyRules.change', description: 'PropertyRules.partHint.change', icon: 'SwapOutlined' },
] satisfies { value: SamplingMode; title: string; label: string; description: string; icon: string }[]).filter(item => item.value !== 'change' || props.editor.scalar))
const mode = computed(() => modes.value.find(item => item.value === draft.value.samplingMode) ?? modes.value[0])
const units = computed(() => [1, 1000, 60000].map((value, index) => ({ value, label: $t(`PropertyRules.timeUnit.${['ms', 's', 'min'][index]}`) })))
const deadbandTypes = computed(() => ['absolute', 'percent'].map(value => ({ value, label: $t(value === 'absolute' ? 'PropertyRules.deadbandType.absolute' : 'PropertyRules.sentence.relativeChange') })))
</script>
<style scoped lang="less">
@import './rule-menu.less';
.sampling-kind { padding: 0; height: auto; }
.rule-optional { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.rule-optional :deep(.ant-checkbox-wrapper) { color: inherit; font-size: inherit; }
</style>
