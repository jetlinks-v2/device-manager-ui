<template>
  <GaugeLayout
    :dataSourceList="dataSourceList"
    :style="style"
  >
    <template #default="{ item, cellSize }">
      <div class="gauge-grid-item">
        <slot
          :item="item"
          :cellSize="cellSize"
        />
      </div>
    </template>
  </GaugeLayout>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { GaugeDataItem, GaugeWidgetProps } from '../shared'
import GaugeLayout from '../GaugeLayout.vue'

defineProps({
  dataSourceList: {
    type: Array as PropType<GaugeDataItem[]>,
    default: () => []
  },
  style: {
    type: [Object, String] as PropType<GaugeWidgetProps['style']>,
    default: () => ({})
  }
})
</script>

<style scoped lang="less">
.gauge-grid-item {
  position: relative;
  width: 100%;
  height: 100%;
}

.mock-badge {
  position: absolute;
  right: 8px;
  top: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0.04em;
}
</style>
