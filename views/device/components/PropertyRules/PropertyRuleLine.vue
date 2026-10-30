<template>
  <span class="rule-line">
    <span class="rule-kind"><slot name="label"><a-tag :color="color"><AIcon :type="icon" /> {{ title }}<RuleNotice v-if="notice" :message="notice" /></a-tag></slot></span>
    <span class="rule-sentence"><slot name="sentence"><slot /></slot><span v-if="$slots.extra" class="rule-sentence-extra"><slot name="extra" /></span></span>
    <span class="rule-line-action"><slot name="action" /></span>
    <span v-if="$slots.details" class="rule-line-details"><slot name="details" /></span>
  </span>
</template>
<script setup lang="ts">
import RuleNotice from './RuleNotice.vue'
defineProps<{ icon: string; title: string; color: string; notice?: string }>()
</script>
<style scoped>
.rule-line { --rule-control-height: 24px; --rule-row-height: 30px; display: grid; grid-template-columns: var(--rule-kind-width, 100px) minmax(0, 1fr) 24px; align-items: start; column-gap: 8px; min-height: var(--rule-row-height); width: 100%; max-width: 100%; font-size: var(--fs-12); font-weight: 400; }
/* Align the sentence start and remove action; each sentence wraps in semantic groups. */
:global(.rule-set-has-alarm) .rule-line { --rule-kind-width: 166px; --rule-kind-compact-width: 132px; }
.rule-kind { display: flex; align-items: center; min-width: 0; min-height: var(--rule-row-height); }
.rule-kind :deep(.ant-tag) { display: inline-flex; align-items: center; gap: var(--space-1); height: 22px; max-width: 100%; margin: 0; padding-inline: var(--space-1); font-size: inherit; line-height: 20px; white-space: nowrap; }
.rule-kind > :deep(.ant-btn) { display: inline-flex; align-items: center; height: 22px; padding: 0; border: 0; font: inherit; line-height: 20px; }
.rule-kind :deep(.ant-tag > .anticon) { flex-shrink: 0; }
.rule-sentence { display: flex; align-items: flex-start; flex-wrap: wrap; gap: 4px 8px; min-width: 0; min-height: var(--rule-row-height); padding-block: 3px; font-size: inherit; line-height: var(--rule-control-height); }
/* Ant small controls have different default line boxes; share metrics with the surrounding sentence. */
.rule-sentence :deep(.ant-select), .rule-sentence :deep(.ant-select-selector), .rule-sentence :deep(.ant-select-selection-item), .rule-sentence :deep(.ant-select-selection-placeholder), .rule-sentence :deep(input), .rule-sentence :deep(.ant-btn), .rule-sentence :deep(.ant-checkbox-group), .rule-sentence :deep(.ant-checkbox-wrapper) { font-family: inherit; font-size: inherit; font-weight: inherit; }
.rule-sentence :deep(.ant-btn) { display: inline-flex; align-items: center; justify-content: center; height: var(--rule-control-height); padding-block: 0; border: 0; line-height: var(--rule-control-height); }
.rule-sentence :deep(.ant-checkbox-wrapper) { display: inline-flex; align-items: center; line-height: var(--rule-control-height); }
.rule-sentence :deep(.ant-checkbox) { top: 0; }
.rule-sentence :deep(.rule-clause) { display: contents; }
.rule-sentence :deep(.rule-phrase) { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; white-space: nowrap; }
.rule-sentence :deep(.ant-select.ant-select-single) { width: fit-content; max-width: 100%; height: var(--rule-control-height); line-height: var(--rule-control-height); }
.rule-line :deep(.ant-select.ant-select-single .ant-select-selector) { display: flex; align-items: center; height: var(--rule-control-height); padding-inline: 0; border: 0; background: transparent; border-radius: 3px; box-shadow: none; line-height: var(--rule-control-height); }
.rule-line :deep(.ant-select-single:not(.ant-select-disabled):hover .ant-select-selector) { background: var(--bg-sunken); }
.rule-line :deep(.ant-select-focused:not(.ant-select-disabled) .ant-select-selector) { background: var(--jet-theme-primary-soft); outline: 1px solid var(--jet-theme-primary); }
.rule-line :deep(.ant-select.ant-select-single .ant-select-selection-item), .rule-line :deep(.ant-select.ant-select-single .ant-select-selection-placeholder) { padding-inline-end: 14px; line-height: var(--rule-control-height); }
.rule-line :deep(.ant-select.ant-select-single .ant-select-selection-search) { inset-inline-start: 0; inset-inline-end: 14px; }
.rule-line :deep(.ant-select-single .ant-select-arrow) { inset-inline-end: 0; font-size: 10px; color: var(--jet-theme-text-secondary); }
.rule-sentence :deep(.ant-input-number), .rule-sentence :deep(.ant-input) { flex: 0 0 auto; height: var(--rule-control-height); min-width: 0; padding-block: 0; border: 0; border-radius: 3px 3px 0 0; background: var(--bg-sunken); box-shadow: inset 0 -1px 0 var(--line); line-height: var(--rule-control-height); font-variant-numeric: tabular-nums; }
.rule-sentence :deep(.ant-input-number) { width: 64px; font-size: inherit; }
.rule-sentence :deep(.ant-input-number:not(.ant-input-number-disabled):hover), .rule-sentence :deep(.ant-input:not(:disabled):hover) { box-shadow: inset 0 -1px 0 var(--jet-theme-text-secondary); }
.rule-sentence :deep(.ant-input-number-focused), .rule-sentence :deep(.ant-input:focus) { box-shadow: inset 0 -1px 0 var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.rule-sentence :deep(.ant-input-number-input) { height: var(--rule-control-height); padding-inline: var(--space-1); line-height: var(--rule-control-height); text-align: center; }
.rule-sentence :deep(input::placeholder), .rule-sentence :deep(.ant-select-selection-placeholder) { color: var(--jet-theme-text-secondary); }
.rule-sentence :deep(.rule-value-entry.ant-input), .rule-sentence :deep(.rule-value-entry.ant-select) { width: 96px; }
.rule-sentence :deep(.rule-value-list) { width: max-content; min-width: 80px; max-width: min(260px, 100%); }
.rule-sentence :deep(.ant-select-selection-placeholder) { inset-inline-end: 7px; max-width: calc(100% - 14px); overflow: hidden; text-overflow: ellipsis; }
.rule-sentence :deep(.ant-select-selection-search-input) { max-width: 100%; height: var(--rule-control-height); line-height: var(--rule-control-height); }
.rule-sentence :deep(.ant-select-multiple .ant-select-selector) { min-height: var(--rule-control-height); padding: 0 4px; border-radius: 3px; cursor: text; }
.rule-sentence :deep(.ant-select-multiple:not(.ant-select-disabled):hover .ant-select-selector) { border-color: var(--jet-theme-primary); }
.rule-sentence :deep(.ant-select-multiple.ant-select-focused .ant-select-selector) { border-color: var(--jet-theme-primary); outline: 0; background: var(--jet-theme-primary-soft); box-shadow: 0 0 0 2px var(--jet-theme-primary-soft); }
.rule-sentence :deep(.ant-select-multiple .ant-select-selection-search) { min-width: 28px; }
.rule-sentence :deep(.ant-select-multiple .ant-select-selection-search-input) { height: calc(var(--rule-control-height) - 2px); line-height: calc(var(--rule-control-height) - 2px); }
.rule-sentence :deep(.ant-select-multiple .ant-select-selection-item) { height: 20px; margin-block: 1px; margin-inline-end: 3px; background: var(--bg-sunken); border: 0; line-height: 20px; }
.rule-sentence-extra { display: inline-flex; align-items: center; min-width: 0; }
.rule-line-details { grid-column: 2; grid-row: 2; display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; padding-block: 0 3px; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); line-height: 24px; }
.rule-line-details :deep(.ant-input-number) { width: 80px; border: 0; border-bottom: 1px solid var(--line); border-radius: 3px 3px 0 0; background: var(--bg-sunken); box-shadow: none; }
.rule-line-details :deep(.ant-input-number-input) { padding-inline: var(--space-1); text-align: center; }
.rule-line-details :deep(.ant-input-number-focused) { border-bottom-color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.rule-line-details :deep(.ant-checkbox-wrapper) { font-size: var(--fs-12); }
.rule-line-action { grid-column: 3; grid-row: 1; display: flex; align-items: center; justify-content: flex-end; min-height: var(--rule-row-height); }
@container rule-fields (max-width: 600px) {
  .rule-line { grid-template-columns: var(--rule-kind-compact-width, 100px) minmax(0, 1fr) 24px; }
}
@container rule-fields (max-width: 420px) { .rule-line { column-gap: 4px; } .rule-sentence :deep(.ant-input-number) { width: 56px; } }
.rule-line-action :deep(.ant-btn) { padding: 0; width: 24px; color: var(--jet-theme-text-secondary); opacity: .5; }
.rule-line:hover .rule-line-action :deep(.ant-btn), .rule-line:focus-within .rule-line-action :deep(.ant-btn) { opacity: 1; }
.rule-line-action :deep(.ant-btn:not(:disabled):hover) { color: var(--jet-theme-error, #ff4d4f); }
.rule-line :deep(.ant-btn:focus-visible) { outline: 1px solid var(--jet-theme-primary); outline-offset: 1px; }
@media (pointer: coarse) { .rule-line { --rule-control-height: 36px; --rule-row-height: 44px; } .rule-kind :deep(.ant-btn), .rule-line-action :deep(.ant-btn) { min-height: 40px; opacity: 1; } }
</style>
