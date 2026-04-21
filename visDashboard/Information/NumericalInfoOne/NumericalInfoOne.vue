<template>
  <div
    class="container"
    :style="containerStyle"
  >
    <div
      v-for="item in dataSourceList"
      :key="item.key"
      class="list-item"
      :style="{ color: config.fontColor }"
    >
      <div class="label">{{ item.name }}</div>
      <div class="value">{{ getDisplayValue(item) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {moduleRegistry} from "@jetlinks-web-core/utils/module-registry";

const { useDashboardData, useGridLayout } = moduleRegistry.getResource('visualization-dashboard-ui', 'hooks')

const props = defineProps({
  info: {
    type: Object,
    default: () => ({})
  },
  style: {
    type: Object,
    default: () => ({})
  }
})

const { dataSourceList, getValue } = useDashboardData(props, 'numericalInfoOne')

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '140px',
  maxWidthForFew: '280px',
  fewThreshold: 3
})

const config = computed(() => {
  return props.info?.componentProps?.numericalInfoOne || {}
})

const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return false
  }

  const trueValue = record.config?.trueValue ?? true
  return value === trueValue || String(value) === String(trueValue)
}

const getDisplayValue = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) return 0

  // 使得开关文本支持也可以被渲染或者作为特殊标记兼容
  if (record.config?.trueValue !== undefined && getCheckedStatus(record)) {
    return '开启' // 这里没有特别为当前配置注入 trueText，先简作模拟。如果有后续扩展可接续更改。
  }
  if (record.config?.falseValue !== undefined && !getCheckedStatus(record)) {
    return '关闭'
  }

  return value
}
</script>

<style scoped lang="less">
.container {
  width: 100%;
  height: 100%;
  display: grid;
  column-gap: 16px;
  row-gap: 24px;
  align-content: center;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;

  .list-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .label {
      font-size: 16px;
      margin-bottom: 8px;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .value {
      font-size: 40px; // 稍微调小一点以适配并排布局
      font-weight: bold;
      line-height: 1.2;
      white-space: nowrap;
    }
  }
}
</style>
