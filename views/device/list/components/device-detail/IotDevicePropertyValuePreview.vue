<template>
  <j-ellipsis v-if="raw" class="property-value-preview property-value-preview--text">
    {{ rawText }}
  </j-ellipsis>
  <a-tooltip v-else-if="structuredValue" :title="$t('IotDeviceDetail.propertyDetail.viewDetail')">
    <button
      type="button"
      class="property-value-preview property-value-preview--object"
      :aria-label="$t('IotDeviceDetail.propertyDetail.viewDetail')"
      @click="detailOpen = true"
    >
      <AIcon type="FileTextOutlined" aria-hidden="true" />
    </button>
  </a-tooltip>
  <a-image
    v-else-if="imageSource"
    :src="imageSource"
    :alt="name"
    :width="thumbnailSize"
    :height="thumbnailSize"
    class="property-value-preview property-value-preview--image"
  />
  <j-ellipsis v-else class="property-value-preview property-value-preview--text">
    {{ displayValue }}
  </j-ellipsis>

  <a-modal
    v-model:open="detailOpen"
    :title="name || $t('IotDeviceDetail.propertyDetail.title')"
    :footer="null"
  >
    <JsonViewer v-if="structuredValue" :expand-depth="5" :value="structuredValue" />
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'

import {
  getImageFileSource,
  isStructuredPropertyType,
  parseStructuredPropertyValue,
} from './iotDevicePropertyDisplay'

const props = withDefaults(defineProps<{
  value: unknown
  valueType?: Record<string, unknown>
  dataType?: string
  name?: string
  raw?: boolean
  thumbnailSize?: number
}>(), {
  valueType: undefined,
  dataType: '',
  name: '',
  raw: false,
  thumbnailSize: 52,
})

const { t: $t } = useI18n()
const detailOpen = ref(false)
const structuredValue = computed(() => (
  isStructuredPropertyType(props.valueType, props.dataType)
    ? parseStructuredPropertyValue(props.value)
    : undefined
))
const imageSource = computed(() => getImageFileSource(props.value, props.valueType, props.dataType))
const displayValue = computed(() => String(props.value ?? '--'))
const rawText = computed(() => {
  if (typeof props.value === 'string') return props.value
  if (props.value === undefined || props.value === null) return '--'
  try {
    return JSON.stringify(props.value)
  } catch {
    return String(props.value)
  }
})
</script>

<style scoped>
.property-value-preview {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.property-value-preview--object {
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
  cursor: pointer;
  font-size: var(--fs-20);
}

.property-value-preview--image :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
  border-radius: var(--jet-theme-radius);
  object-fit: cover;
}

.property-value-preview--text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
