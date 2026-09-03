<template>
  <div
    class="message-card"
    :style="style"
  >
    <SectionHeader :title="config.topTitle">
      <template #extra>
        <QuickTimeSelect
          :key="config.defaultType"
          :quickBtn="config.quickBtn"
          :defaultType="config.defaultType"
          @change="updateRange"
        />
      </template>
    </SectionHeader>
    <div class="message-chart">
      <Charts
          class="chart"
          :options="option"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import Charts from '../../../views/device/DashBoard/components/Charts.vue'
import QuickTimeSelect from '../components/QuickTimeSelect.vue'
import SectionHeader from '../components/SectionHeader.vue'
import { useDeviceMessage } from '../hooks/useDeviceMessage'

defineOptions({
  name: 'DeviceMessage'
})

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const infoRef = toRef(props, 'info')
const isEditRef = toRef(props, 'isEdit')
const { config, data, loading, error, updateRange } = useDeviceMessage(infoRef, isEditRef)

const showChart = computed(() => !error.value && data.value.xData.length > 0)
const maxY = computed(() => Math.max(...data.value.yData, 0))
const gridLeft = computed(() => {
  const yLength = String(Math.ceil(maxY.value)).length

  return maxY.value < 900000 ? '60px' : `${yLength * 7.5 + Math.floor(yLength / 3) * 1.2 + 10}px`
})

const option = computed(() => ({
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: data.value.xData
  },
  yAxis: {
    type: 'value'
  },
  tooltip: config.value.hoverTip
    ? {
        trigger: 'axis',
        formatter: `{b0}<br />${config.value.hoverTitle}: {c0}`
      }
    : {
        show: false
      },
  grid: {
    top: '2%',
    bottom: '5%',
    left: gridLeft.value,
    right: '50px'
  },
  series: [
    {
      name: config.value.hoverTitle,
      data: data.value.yData,
      type: 'line',
      smooth: true,
      symbolSize: 0,
      color: config.value.color,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            {
              offset: 0,
              color: config.value.color
            },
            {
              offset: 1,
              color: '#FFFFFF'
            }
          ],
          global: false
        }
      }
    }
  ]
}))
</script>

<style scoped lang="less">
.message-card {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 24px;
  box-sizing: border-box;
  background-color: #fff;
}

.message-chart {
  width: 100%;
  height: calc(100% - 45px);
  min-height: 320px;
}

.chart,
.chart :deep(canvas) {
  width: 100%;
  height: 100%;
}

.chart-status {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.45);
}

.chart-status.error {
  color: #ff4d4f;
}
</style>
