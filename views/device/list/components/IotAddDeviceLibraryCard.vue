<template>
  <CardSummary
    :data="cardData"
    :active="selected"
    :disabled="disabled"
    class="iot-add-device-card"
    @click="emit('select', template.id)"
  >
    <template #title>
      <a-tooltip :title="cardData.title">{{ cardData.title }}</a-tooltip>
    </template>
    <template #description>
      <a-tooltip :title="cardData.description">{{ cardData.description }}</a-tooltip>
    </template>
    <template v-if="visibleTags.length" #tags>
      <div class="add-device-library__template-tags">
        <a-tooltip v-for="tag in visibleTags" :key="tag" :title="tag">
          <a-tag>{{ tag }}</a-tag>
        </a-tooltip>
        <a-tooltip v-if="hiddenTagCount" :title="tagTooltip">
          <a-tag>+{{ hiddenTagCount }}</a-tag>
        </a-tooltip>
      </div>
    </template>
  </CardSummary>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import { CardSummary } from '@jetlinks-web-core/components'
import { useDeviceLibraryCard } from '../hooks/device-library/useDeviceLibraryCard'

const props = defineProps({
  template: { type: Object as PropType<IotDeviceProductTemplate>, required: true },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'select', templateId: string): void
}>()

// 展示与事件转发留在组件，禁用点击和键盘行为由 CardSummary 统一处理。
const { cardData, visibleTags, hiddenTagCount, tagTooltip } = useDeviceLibraryCard(props)
</script>

<style scoped src="./IotAddDeviceDrawer.css" lang="less">
.iot-add-device-card {
  border: 1px solid var(--color-jet-border) !important;
  padding: var(--space-2);
}
</style>
