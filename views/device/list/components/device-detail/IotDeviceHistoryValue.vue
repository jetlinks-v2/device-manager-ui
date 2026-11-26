<template>
  <div v-if="structuredValue" class="history-value history-value--json">
    <JsonViewer :expand-depth="5" :value="structuredValue" :copyable="false" />
  </div>
  <a-textarea v-else-if="isLongText" class="history-value" :value="displayValue" :rows="4" readonly />
  <a-input v-else :value="displayValue" readonly />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import { parseStructuredPropertyValue } from './iotDevicePropertyDisplay'

const props = defineProps<{
  value: unknown
  valueType?: Record<string, unknown>
  dataType?: string
}>()

// 属性和事件历史共用相同的只读展示，不从文件编码或 URL 推断预览类型。
const structuredValue = computed(() => {
  const type = props.valueType?.type || props.dataType
  return ['object', 'array', 'geoPoint'].includes(String(type)) || (props.value !== null && typeof props.value === 'object')
    ? parseStructuredPropertyValue(props.value)
    : undefined
})
const displayValue = computed(() => props.value === null ? 'null' : String(props.value ?? ''))
const isLongText = computed(() => displayValue.value.length > 80 || /[\r\n]/u.test(displayValue.value))
</script>

<style scoped>
.history-value {
  width: 100%;
  max-height: 16rem;
  overflow: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.history-value--json {
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
}

.history-value--json :deep(.jv-container),
.history-value--json :deep(.jv-code) {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
