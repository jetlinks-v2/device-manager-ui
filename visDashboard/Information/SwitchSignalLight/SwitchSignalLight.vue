<template>
  <div
    class="container"
    :style="containerStyle"
  >
    <div
      v-for="item in dataSourceList"
      :key="item.key"
      class="list-item"
    >
      <div
        class="light"
        :style="getLightStyle(getCheckedStatus(item))"
      ></div>
      <div class="light-label">{{ item.name }}</div>
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

const { dataSourceList, getValue } = useDashboardData(props, 'switchSignalLight')

const { containerStyle } = useGridLayout(dataSourceList, () => props.style, {
  minWidth: '90px',
  maxWidthForFew: '180px',
  fewThreshold: 3
})

const lightConfig = computed(() => {
  return props.info?.componentProps?.switchSignalLight || {}
})

const getCheckedStatus = (record: any) => {
  const value = record.isMock ? record.value : getValue(record)
  if (value === undefined || value === null) {
    return !!record.value
  }

  const trueValue = record.config?.trueValue ?? true
  return value === trueValue || String(value) === String(trueValue)
}

const getLightStyle = (activeValue: boolean) => {
  const { onColor, offColor, autoSize, size, showGlow } = lightConfig.value

  const currentColor = activeValue ? onColor || '#52c41a' : offColor || '#bfbfbf'
  const finalSize = autoSize ? '40px' : `${size || 32}px`

  const style: any = {
    width: finalSize,
    height: finalSize,
    borderRadius: '50%',
    backgroundColor: currentColor,
    transition: 'all 0.3s ease'
  }

  if (showGlow) {
    // 增加多层阴影以增强大屏场景下的外发光效果
    style.boxShadow = `0 0 12px ${currentColor}, 0 0 6px ${currentColor} inset`
  }

  return style
}
</script>

<style scoped lang="less">
.container {
  width: 100%;
  height: 100%;
  display: grid;
  column-gap: 16px;
  row-gap: 16px;
  align-content: center;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;

  .list-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .light {
      flex-shrink: 0;
    }

    .light-label {
      color: inherit;
      text-align: center;
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90px;
    }
  }
}
</style>
