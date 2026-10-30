<template>
  <span class="rule-invalid-record">
    <a-tag v-if="readonly"><AIcon type="FileSearchOutlined" />{{ $t('PropertyRules.recordInvalid') }}</a-tag>
    <a-checkbox v-else :checked="modelValue" :disabled="disabled" @update:checked="$emit('update:modelValue', $event)">
      <AIcon type="FileSearchOutlined" />{{ $t('PropertyRules.recordInvalid') }}
    </a-checkbox>
    <RuleNotice kind="info" :message="$t('PropertyRules.recordInvalidHint')" />
  </span>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import RuleNotice from './RuleNotice.vue'
defineProps<{ modelValue?: boolean; disabled?: boolean; readonly?: boolean }>()
defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
const { t: $t } = useI18n()
</script>
<style scoped>
.rule-invalid-record { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); line-height: 20px; }
.rule-invalid-record :deep(.ant-checkbox-wrapper) { align-items: center; color: inherit; font-size: inherit; }
.rule-invalid-record :deep(.ant-checkbox + span) { display: inline-flex; align-items: center; gap: var(--space-1); padding-inline-end: 0; }
.rule-invalid-record :deep(.ant-tag) { display: inline-flex; align-items: center; gap: var(--space-1); margin: 0; font-size: inherit; }
</style>
