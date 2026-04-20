<template>
  <div
    class="gauge-container"
    ref="containerRef"
    :style="style"
  >
    <div
      class="gauge-grid"
      :style="gridStyle"
    >
      <div
        v-for="item in dataSourceList"
        :key="item.key"
        class="gauge-item"
        :style="itemStyle"
      >
        <slot
          :item="item"
          :cellSize="layoutInfo.cellSize"
        ></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { PropType } from 'vue'
import type { GaugeWidgetProps } from './shared'

interface GaugeItem {
  key: string | number
  name?: string
  value?: number
  isMock?: boolean
  config?: any
  [key: string]: any
}

const props = defineProps({
  dataSourceList: {
    type: Array as PropType<GaugeItem[]>,
    default: () => []
  },
  style: {
    type: [Object, String] as PropType<GaugeWidgetProps['style']>,
    default: () => ({})
  }
})

const containerRef = ref<HTMLElement | null>(null)
const containerSize = reactive({ width: 0, height: 0 })

/** 间距常量 */
const GAP = 12

/**
 * 核心布局算法：
 * 给定 N 个正方形仪表盘和一个 W×H 的容器，
 * 找到最优的列数，使得每个仪表盘占用的面积最大化。
 */
const layoutInfo = computed(() => {
  const count = props.dataSourceList.length
  if (count === 0) return { columns: 1, rows: 1, cellSize: 100 }

  const { width, height } = containerSize
  if (width <= 0 || height <= 0) return { columns: 1, rows: 1, cellSize: 100 }

  let bestCols = 1
  let bestSize = 0

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    // 每个单元格可用的宽度和高度（扣除间距）
    const cellW = (width - GAP * (cols - 1)) / cols
    const cellH = (height - GAP * (rows - 1)) / rows
    // 仪表盘需要正方形区域，取宽高中较小值
    const size = Math.min(cellW, cellH)

    if (size > bestSize) {
      bestSize = size
      bestCols = cols
    }
  }

  const bestRows = Math.ceil(count / bestCols)

  return {
    columns: bestCols,
    rows: bestRows,
    cellSize: Math.max(60, Math.floor(bestSize)) // 最小 60px，保证可读
  }
})

/**
 * Grid 容器样式
 */
const gridStyle = computed(() => {
  const { columns, cellSize } = layoutInfo.value
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
    gridAutoRows: `${cellSize}px`,
    gap: `${GAP}px`,
    justifyContent: 'center',
    alignContent: 'center'
  }
})

/** 每项的固定正方形尺寸 */
const itemStyle = computed(() => {
  const size = layoutInfo.value.cellSize
  return {
    width: `${size}px`,
    height: `${size}px`
  }
})

onMounted(() => {
  if (!containerRef.value) return

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    containerSize.width = width
    containerSize.height = height
  })

  observer.observe(containerRef.value)

  // 初始化尺寸
  containerSize.width = containerRef.value.clientWidth
  containerSize.height = containerRef.value.clientHeight

  onBeforeUnmount(() => observer.disconnect())
})
</script>

<style scoped lang="less">
.gauge-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.gauge-item {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
