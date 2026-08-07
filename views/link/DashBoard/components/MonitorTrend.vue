<template>
  <a-spin :spinning="loading">
    <section class="monitor-trend">
      <header class="monitor-trend__header">
        <div class="monitor-trend__title-group">
          <h3>{{ title }}</h3>
          <a-segmented
            v-model:value="activeMetric"
            size="small"
            :options="metricOptions"
          />
        </div>
        <div class="monitor-trend__actions">
          <a-range-picker
            v-model:value="timeRange"
            :allow-clear="false"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
            @change="onRangeChange"
          >
            <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
            <template #renderExtraFooter>
              <a-radio-group v-model:value="shortcut" button-style="solid" size="small">
                <a-radio-button value="hour">{{ $t('components.MonitorTrend.lastHour') }}</a-radio-button>
                <a-radio-button value="day">{{ $t('components.MonitorTrend.lastDay') }}</a-radio-button>
                <a-radio-button value="week">{{ $t('components.MonitorTrend.lastWeek') }}</a-radio-button>
              </a-radio-group>
            </template>
          </a-range-picker>
          <a-tooltip :title="$t('components.MonitorRefresh.button')">
            <a-button type="text" :loading="loading" @click="refresh">
              <template #icon><AIcon type="ReloadOutlined" /></template>
            </a-button>
          </a-tooltip>
        </div>
      </header>

      <j-empty v-if="!loading && !series.length" class="monitor-trend__empty" />
      <template v-else>
        <div class="monitor-trend__chart">
          <JEcharts :option="chartOptions" not-merge />
        </div>
        <NodeFocusSelector
          v-if="nodeOptions.length > 1"
          :value="selectedNodes"
          :options="nodeOptions"
          @update:value="updateSelectedNodes"
          @reset="resetFocusedNodes"
        />
      </template>
    </section>
  </a-spin>
</template>

<script lang="ts" setup name="MonitorTrend">
import type { PropType } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { dashboard } from '../../../../api/link/dashboard'
import NodeFocusSelector from './NodeFocusSelector.vue'
import { defaultParamsData, getTimeByType } from './tool'
import {
  formatMemorySize,
  nodeColor,
  nodeSeriesVisual,
  normalizeMonitorHistory,
  sortMonitorTooltipItems,
  type MonitorHistoryResponseItem,
  type MonitorMetric,
  type MonitorNodeSeries,
} from './monitorData'

interface MetricOption {
  label: string
  value: MonitorMetric
}

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  metrics: {
    type: Array as PropType<MetricOption[]>,
    required: true,
  },
  refreshVersion: {
    type: Number,
    default: 0,
  },
  selectedNodes: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  defaultNodes: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
})
const emit = defineEmits(['update:selectedNodes'])

const activeMetric = ref<MonitorMetric>(props.metrics[0].value)
const shortcut = ref<'hour' | 'day' | 'week' | undefined>('hour')
const timeRange = ref<[Dayjs, Dayjs]>([dayjs(getTimeByType('hour')), dayjs()])
const series = ref<MonitorNodeSeries[]>([])
const loading = ref(false)
let requestSequence = 0

const metricOptions = computed(() => props.metrics.map(item => ({ ...item })))
const isMemoryMetric = computed(() => activeMetric.value.startsWith('memory'))
const nodeOptions = computed(() => series.value.map(item => ({
  label: item.nodeId === 'undefined' ? '--' : item.nodeId,
  value: item.nodeId,
  color: nodeColor(item.nodeId),
  metric: item.latest ? `${item.latest.percent.toFixed(1)}%` : undefined,
  detail: isMemoryMetric.value && item.latest
    ? `${formatMemorySize(item.latest.used)} / ${formatMemorySize(item.latest.total)}`
    : undefined,
})))
const selectedNodes = computed(() => props.selectedNodes)
const updateSelectedNodes = (value: string[]) => {
  emit('update:selectedNodes', value)
}

const resetFocusedNodes = () => {
  emit('update:selectedNodes', props.defaultNodes)
}

const loadHistory = async () => {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const response = await dashboard(defaultParamsData(activeMetric.value, { time: timeRange.value })) as {
      success?: boolean
      result?: unknown[]
    }
    if (sequence !== requestSequence) return
    series.value = response.success
      ? normalizeMonitorHistory(response.result as MonitorHistoryResponseItem[], activeMetric.value)
      : []
  } catch {
    if (sequence === requestSequence) {
      series.value = []
    }
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

const onRangeChange = () => {
  shortcut.value = undefined
  loadHistory()
}

const refresh = () => {
  if (shortcut.value) {
    timeRange.value = [dayjs(getTimeByType(shortcut.value)), dayjs()]
  }
  loadHistory()
}

const visibleSeries = computed(() => {
  const selected = new Set(selectedNodes.value)
  return series.value.filter(item => selected.has(item.nodeId))
})

const chartOptions = computed(() => ({
  animationDuration: 240,
  color: visibleSeries.value.map(item => nodeColor(item.nodeId)),
  grid: { left: 52, right: 24, top: 26, bottom: 46 },
  xAxis: {
    type: 'time',
    boundaryGap: false,
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 100,
    axisLabel: { formatter: '{value}%' },
  },
  dataZoom: [
    { type: 'inside', start: shortcut.value === 'hour' ? 0 : 70, end: 100 },
    { type: 'slider', height: 20, bottom: 4, start: shortcut.value === 'hour' ? 0 : 70, end: 100 },
  ],
  tooltip: {
    trigger: 'axis',
    formatter: (items: Array<{ seriesName: string; marker: string; data: MonitorPointTuple }>) => {
      if (!items.length) return ''
      const timestamp = dayjs(items[0].data[0]).format('YYYY-MM-DD HH:mm:ss')
      // Hover 用于同一时刻的横向比较，按使用率降序让高负载节点优先进入视线。
      const values = sortMonitorTooltipItems(items).map((item) => {
        const [, percent, used, total] = item.data
        const size = isMemoryMetric.value
          ? `<span class="monitor-tooltip__detail">${formatMemorySize(used)} / ${formatMemorySize(total)}</span>`
          : ''
        return `${item.marker}${item.seriesName}<span class="monitor-tooltip__value">${percent.toFixed(2)}%</span>${size}`
      })
      return `<div class="monitor-tooltip"><div class="monitor-tooltip__time">${timestamp}</div>${values.map(value => `<div class="monitor-tooltip__row">${value}</div>`).join('')}</div>`
    },
  },
  series: visibleSeries.value.map(item => ({
    name: item.nodeId === 'undefined' ? '' : item.nodeId,
    type: 'line',
    smooth: true,
    showSymbol: false,
    ...nodeSeriesVisual(item.nodeId),
    data: item.points.map(point => [point.timestamp, point.percent, point.used, point.total]),
  })),
}))

type MonitorPointTuple = [number, number, number | undefined, number | undefined]

watch(shortcut, (value) => {
  if (!value) return
  timeRange.value = [dayjs(getTimeByType(value)), dayjs()]
  loadHistory()
}, { immediate: true })

watch(activeMetric, () => {
  loadHistory()
})

watch(() => props.refreshVersion, () => {
  if (shortcut.value) {
    timeRange.value = [dayjs(getTimeByType(shortcut.value)), dayjs()]
  }
  loadHistory()
})

</script>

<style lang="less" scoped>
.monitor-trend {
  display: flex;
  flex-direction: column;
  min-height: 30rem;
  padding: var(--space-6, 1.5rem);
  background: var(--bg, #fff);
  border-radius: 0.25rem;
}

.monitor-trend__header,
.monitor-trend__title-group,
.monitor-trend__actions {
  display: flex;
  align-items: center;
}

.monitor-trend__header {
  justify-content: space-between;
  gap: var(--space-4, 1rem);
}

.monitor-trend__actions {
  gap: var(--space-2, 0.5rem);
}

.monitor-trend__title-group {
  gap: var(--space-3, 0.75rem);

  h3 {
    margin: 0;
    white-space: nowrap;
  }
}

.monitor-trend__chart {
  height: 20rem;
  margin-top: var(--space-4, 1rem);
}

.monitor-trend__empty {
  height: 22rem;
}
@media (max-width: 90rem) {
  .monitor-trend__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

<style lang="less" src="./monitorTooltip.less"></style>
