<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceDetail.propertyDetail.title')"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <div v-if="row" class="history-detail">
      <div class="history-detail__name">{{ propertyName }}</div>
      <JsonViewer
        v-if="structuredValue"
        :expand-depth="5"
        :value="structuredValue"
      />
      <a-textarea
        v-else-if="isLongText"
        :value="displayValue"
        :rows="4"
        disabled
      />
      <a-input
        v-else
        :value="displayValue"
        disabled
      />
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'

import { parseStructuredPropertyValue } from './iotDevicePropertyDisplay'

interface HistoryDetailRow {
  value: unknown
  raw?: Record<string, unknown>
}

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  row: {
    type: Object as PropType<HistoryDetailRow | null>,
    default: null,
  },
  propertyName: {
    type: String,
    default: '',
  },
  valueType: {
    type: Object as PropType<Record<string, unknown>>,
    default: undefined,
  },
  dataType: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t: $t } = useI18n()
const detailValue = computed(() => {
  const candidates = [props.row?.raw?.formatValue, props.row?.raw?.value, props.row?.value]
  const fallback = candidates.find((item) => item !== undefined && item !== null) ?? ''
  if (props.valueType?.type !== 'object' && props.valueType?.type !== 'array' && props.dataType !== 'object' && props.dataType !== 'array') {
    return fallback
  }
  return candidates.find((item) => parseStructuredPropertyValue(item)) ?? fallback
})
const displayValue = computed(() => String(detailValue.value ?? ''))
const structuredValue = computed(() => {
  if (props.valueType?.type !== 'object' && props.valueType?.type !== 'array' && props.dataType !== 'object' && props.dataType !== 'array') {
    return undefined
  }
  return parseStructuredPropertyValue(detailValue.value)
})
const isLongText = computed(() => displayValue.value.length > 80 || displayValue.value.includes('\n'))
</script>

<style scoped>
.history-detail {
  display: grid;
  gap: 0.75rem;
}

.history-detail__name {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}
</style>
