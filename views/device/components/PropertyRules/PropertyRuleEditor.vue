<template>
  <JlDrawerShell :open="open" :width="640" icon="FilterOutlined" :title="$t('PropertyRules.editTitle', { name: propertyNameOf(property) })" :sub="propertyIdOf(property)" @update:open="editor.requestClose">
    <PropertyRuleFields :editor="editor" :scope="scope" :property="property" />
    <template #foot><a-button :disabled="editor.saving" @click="editor.requestClose">{{ $t('DeviceAlarm.action.cancel') }}</a-button></template>
  </JlDrawerShell>
</template>
<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { propertyIdOf, propertyNameOf } from '../../alarm/utils'
import type { ThingModelProperty } from '../../alarm/types'
import type { RuleScope } from './service'
import { usePropertyRuleEditor } from './usePropertyRuleEditor'
import PropertyRuleFields from './PropertyRuleFields.vue'
const props = defineProps<{ open: boolean; scope: RuleScope; property: ThingModelProperty }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'changed'): void }>()
const { t: $t } = useI18n()
const editor = reactive(usePropertyRuleEditor(props, () => emit('update:open', false), () => emit('changed')))
</script>
