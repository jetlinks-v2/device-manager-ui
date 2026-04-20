<template>
  <div
    class="top-card"
    :style="style"
  >
    <div class="top-card-content">
      <div class="content-left">
        <div class="content-left-title">
          <a-space size="small">
            <span>{{ config.topTitle }}</span>
            <a-tooltip
              v-if="config.tooltip"
              placement="top"
            >
              <template #title>
                <span>{{ config.tooltip }}</span>
              </template>
              <AIcon type="QuestionCircleOutlined" />
            </a-tooltip>
          </a-space>
        </div>
        <div class="content-left-value">{{ data.primary }}</div>
        <div
          v-if="error"
          class="chart-status error"
        >
          {{ error }}
        </div>
      </div>
      <div class="content-right">
        <a-spin
          :spinning="loading"
          class="chart-spin"
        >
          <v-chart
            v-if="showChart"
            class="chart"
            :option="option"
            autoresize
          />
          <div
            v-else
            class="chart-status"
            :class="{ error: !!error }"
          >
            {{ error || '暂无数据' }}
          </div>
        </a-spin>
      </div>
    </div>
    <div
      v-if="showFooter"
      class="top-card-footer"
    >
      <span>{{ config.bottomTitle }}</span>
      <div class="footer-item-value">{{ data.secondary }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { DashboardCardStyle, TrendMetricConfig, TrendMetricData } from '../shared'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = withDefaults(
  defineProps<{
    config: TrendMetricConfig
    data: TrendMetricData
    loading?: boolean
    error?: string
    showFooter?: boolean
    style?: DashboardCardStyle
  }>(),
  {
    loading: false,
    error: '',
    showFooter: true,
    style: () => ({})
  }
)

const showChart = computed(() => !props.error && props.data.xData.length > 0)

const option = computed(() => ({
  xAxis: {
    type: 'category',
    data: props.data.xData,
    show: false
  },
  yAxis: {
    type: 'value',
    show: false
  },
  grid: {
    top: '5%',
    bottom: 0,
    left: 0,
    right: 0
  },
  tooltip: {
    trigger: 'axis',
    show: props.config.hoverTip,
    axisPointer: {
      type: 'shadow'
    }
  },
  series: [
    {
      name: props.config.hoverTitle || '',
      data: props.data.yData,
      type: 'line',
      smooth: true,
      symbolSize: 0,
      color: props.config.color || '#D3ADF7',
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
              color: props.config.color || '#D3ADF7'
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
.top-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
}

.top-card-content {
  display: flex;
  justify-content: space-between;
  flex: 1;
  min-height: 0;
}

.content-left {
  flex: 1;
  min-width: 0;
}

.content-left-title {
  color: rgba(0, 0, 0, 0.64);
}

.content-left-value {
  padding: 12px 0;
  color: #323130;
  font-weight: 700;
  font-size: 36px;
  line-height: 1.2;
}

.content-right {
  flex: 1;
  min-width: 120px;
  min-height: 92px;
}

.chart-spin,
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
  font-size: 12px;
}

.chart-status.error {
  justify-content: flex-start;
  color: #ff4d4f;
}

.top-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.footer-item-value {
  color: #323130;
  font-weight: 700;
  font-size: 16px;
}
</style>
