<template>
  <a-spin :spinning="loading">
    <div class="property-history-chart">
      <div class="property-history-chart__toolbar">
        <span>{{ $t('IotDeviceDetail.propertyChart.period') }}</span>
        <a-select
          v-model:value="cycle"
          class="property-history-chart__select"
          :options="periodOptions"
          @change="queryCharts"
        />
        <template v-if="cycle !== '*' && isNumericProperty">
          <span>{{ $t('IotDeviceDetail.propertyChart.aggregation') }}</span>
          <a-select
            v-model:value="agg"
            class="property-history-chart__select"
            @change="queryCharts"
          >
            <a-select-option value="AVG">{{ $t('IotDeviceDetail.propertyChart.agg.avg') }}</a-select-option>
            <a-select-option value="MAX">{{ $t('IotDeviceDetail.propertyChart.agg.max') }}</a-select-option>
            <a-select-option value="MIN">{{ $t('IotDeviceDetail.propertyChart.agg.min') }}</a-select-option>
            <a-select-option value="COUNT">{{ $t('IotDeviceDetail.propertyChart.agg.count') }}</a-select-option>
          </a-select>
        </template>
      </div>

      <div class="property-history-chart__body">
        <JEcharts v-if="chartsList.length" class="property-history-chart__chart" :option="chartOption" />
        <CloudEmpty v-else class="property-history-chart__empty" :description="$t('IotDeviceDetail.propertyDetail.emptyChart')" />
      </div>
    </div>
  </a-spin>
</template>

<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs'
import { computed, type PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

type TimeRange = [Dayjs, Dayjs] | undefined

const props = defineProps({
  deviceId: { type: String, required: true },
  property: { type: Object as PropType<RealtimePropertyRow | null>, default: null },
  timeRange: { type: Array as PropType<TimeRange>, default: undefined },
})

const { t: $t } = useI18n()
const cycle = ref('')
const agg = ref('AVG')
const loading = ref(false)
const chartsList = ref<Array<{ year: number | string; value: number | string | undefined; type: string }>>([])
const periodOptions = ref<Array<{ label: string; value: string }>>([])

const isNumericProperty = computed(() => ['int', 'float', 'double', 'long'].includes(props.property?.valueType?.type || ''))
const timeValues = computed<[number, number] | undefined>(() => {
  if (!props.timeRange?.[0] || !props.timeRange?.[1]) return undefined
  return [props.timeRange[0].valueOf(), props.timeRange[1].valueOf()]
})

function updatePeriodOptions() {
  const times = timeValues.value
  if (!times) return
  const diffInMinutes = dayjs(times[1]).diff(dayjs(times[0]), 'minute')
  if (diffInMinutes < 60) {
    periodOptions.value = isNumericProperty.value
      ? [{ label: $t('IotDeviceDetail.propertyChart.rawData'), value: '*' }, { label: $t('IotDeviceDetail.propertyChart.minute'), value: '1m' }]
      : [{ label: $t('IotDeviceDetail.propertyChart.minute'), value: '1m' }]
    cycle.value = isNumericProperty.value ? '*' : '1m'
  } else if (diffInMinutes < 1440) {
    periodOptions.value = isNumericProperty.value
      ? [{ label: $t('IotDeviceDetail.propertyChart.rawData'), value: '*' }, { label: $t('IotDeviceDetail.propertyChart.minute'), value: '1m' }, { label: $t('IotDeviceDetail.propertyChart.hour'), value: '1h' }]
      : [{ label: $t('IotDeviceDetail.propertyChart.minute'), value: '1m' }, { label: $t('IotDeviceDetail.propertyChart.hour'), value: '1h' }]
    cycle.value = isNumericProperty.value ? '*' : '1m'
  } else if (diffInMinutes < 43200) {
    periodOptions.value = [{ label: $t('IotDeviceDetail.propertyChart.hour'), value: '1h' }, { label: $t('IotDeviceDetail.propertyChart.day'), value: '1d' }]
    cycle.value = '1h'
  } else {
    periodOptions.value = [{ label: $t('IotDeviceDetail.propertyChart.day'), value: '1d' }, { label: $t('IotDeviceDetail.propertyChart.week'), value: '1w' }]
    cycle.value = '1d'
  }
}

async function queryCharts() {
  if (!props.deviceId || !props.property?.identifier || !timeValues.value || !cycle.value) {
    chartsList.value = []
    return
  }
  if (cycle.value === '*' && isNumericProperty.value) {
    await queryRawCharts()
  } else {
    await queryAggCharts()
  }
}

async function queryAggCharts() {
  const property = props.property
  const times = timeValues.value
  if (!property || !times) return
  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryPropertyAggregation(props.deviceId, {
      columns: [{
        property: property.identifier,
        alias: property.identifier,
        agg: isNumericProperty.value ? agg.value : 'COUNT',
      }],
      query: {
        interval: cycle.value,
        format: cycle.value === '1d' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss',
        from: times[0],
        to: times[1],
      },
    })
    const rows = extractRows(resp?.result).map((item: any) => {
      const value = getAggregationValue(item, property.identifier)
      return {
        ...item,
        year: item.time,
        value: value === undefined || value === null || value === '' ? undefined : Number(value),
        type: property.name || property.identifier,
      }
    }).reverse()
    chartsList.value = withBoundaryRows(rows, property, times)
  } finally {
    loading.value = false
  }
}

async function queryRawCharts() {
  const property = props.property
  const times = timeValues.value
  if (!property || !times) return
  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryPropertyNoPaging(props.deviceId, property.identifier, {
      paging: false,
      terms: [{
        column: 'timestamp$BTW',
        value: times,
        type: 'and',
      }],
      sorts: [{ name: 'timestamp', order: 'asc' }],
    })
    const rows = extractRows(resp?.result).map((item: any) => ({
      ...item,
      year: item.timestamp,
      value: item.value ?? undefined,
      type: property.name || property.identifier,
    }))
    chartsList.value = withBoundaryRows(rows, property, times)
  } finally {
    loading.value = false
  }
}

function withBoundaryRows(
  rows: Array<{ year: number | string; value: number | string | undefined; type: string }>,
  property: RealtimePropertyRow,
  times: [number, number],
) {
  const nextRows = [...rows]
  const beginTime = cycle.value === '*'
    ? times[0]
    : cycle.value === '1d'
    ? dayjs(times[0]).format('YYYY-MM-DD')
    : dayjs(times[0]).format('YYYY-MM-DD HH:mm:ss')
  const endTime = cycle.value === '*'
    ? times[1]
    : cycle.value === '1d'
    ? dayjs(times[1]).format('YYYY-MM-DD')
    : dayjs(times[1]).format('YYYY-MM-DD HH:mm:ss')

  if (!nextRows[0]?.year || !isSameChartTime(nextRows[0].year, beginTime)) {
    nextRows.unshift({ year: beginTime, value: undefined, type: property.name || property.identifier })
  }
  const last = nextRows[nextRows.length - 1]
  if (!last?.year || !isSameChartTime(last.year, endTime)) {
    nextRows.push({ year: endTime, value: undefined, type: property.name || property.identifier })
  }
  return nextRows
}

function isSameChartTime(value: number | string, target: number | string) {
  if (typeof value === 'number' && typeof target === 'number') return value === target
  return String(value) === String(target)
}

const chartOption = computed(() => ({
  grid: { top: 48, right: 48, bottom: 72, left: 56 },
  xAxis: {
    type: 'category',
    data: chartsList.value.map((item) => formatChartTime(item.year)),
    name: $t('IotDeviceDetail.runtime.time'),
    boundaryGap: true,
  },
  yAxis: {
    type: 'value',
    name: chartsList.value[0]?.type,
  },
  dataZoom: [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100 }],
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value: unknown) => formatChartValue(value),
  },
  series: [{
    data: chartsList.value.map((item) => normalizeSeriesValue(item.value)),
    type: 'line',
    symbol: 'circle',
    showSymbol: true,
    showAllSymbol: true,
    symbolSize: 7,
    connectNulls: false,
    areaStyle: {},
  }],
}))

function getAggregationValue(item: any, property: string) {
  const candidates = [
    property,
    `${property}_${agg.value}`,
    `${property}$${agg.value}`,
    `${property}_${agg.value.toLowerCase()}`,
    `${property}$${agg.value.toLowerCase()}`,
    agg.value,
    agg.value.toLowerCase(),
    'value',
    'numberValue',
  ]
  for (const key of candidates) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function normalizeSeriesValue(value: number | string | undefined) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isNaN(value) ? null : Number(value.toFixed(2))
  const numberValue = Number(value)
  return Number.isNaN(numberValue) ? value : Number(numberValue.toFixed(2))
}

function formatChartValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

function formatChartTime(value: number | string) {
  const date = dayjs(value)
  if (!date.isValid()) return String(value)
  return date.format(cycle.value === '1d' ? 'YYYY-MM-DD' : 'YYYY-MM-DD\nHH:mm:ss')
}

watch(
  () => [props.property?.identifier, props.property?.valueType?.type, timeValues.value?.[0], timeValues.value?.[1]],
  async () => {
    updatePeriodOptions()
    await queryCharts()
  },
  { immediate: true },
)
</script>

<style scoped>
.property-history-chart {
  display: grid;
  gap: var(--space-3);
}

.property-history-chart__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.property-history-chart__select {
  width: 7.5rem;
}

.property-history-chart__body {
  width: 100%;
  height: 26.25rem;
}

.property-history-chart__chart {
  width: 100%;
  height: 100%;
}

.property-history-chart__empty {
  display: grid;
  place-items: center;
  height: 100%;
  border: 0.0625rem dashed var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-text-disabled);
  background: var(--jet-theme-primary-soft);
  font-size: var(--fs-14);
}
</style>
