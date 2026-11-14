<template>
  <a-modal
    :open="open"
    :title="$t('IotDeviceDetail.propertyDetail.title')"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <div v-if="row" class="history-detail">
      <div class="history-detail__name">{{ propertyName }}</div>
      <IotDeviceHistoryValue :value="detailValue" :value-type="valueType" :data-type="dataType" />
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import IotDeviceHistoryValue from './IotDeviceHistoryValue.vue'

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
// 保持原有格式化值优先级，结构化值交给属性与事件共用的只读展示组件。
const detailValue = computed(() => {
  const candidates = [props.row?.raw?.formatValue, props.row?.raw?.value, props.row?.value]
  const fallback = candidates.find((item) => item !== undefined && item !== null) ?? ''
  if (props.valueType?.type !== 'object' && props.valueType?.type !== 'array' && props.dataType !== 'object' && props.dataType !== 'array') {
    return fallback
  }
  return candidates.find((item) => parseStructuredPropertyValue(item)) ?? fallback
})
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
