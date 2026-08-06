<template>
  <a-spin :spinning="loading">
    <section class="network-trend">
      <header class="network-trend__header">
        <h3>{{ $t('DeviceAccess.index.594346-33') }}</h3>
        <div class="network-trend__actions">
          <a-radio-group v-model:value="timeType" button-style="solid" size="small">
            <a-radio-button value="hour">{{ $t('DashBoard.index.954313-5') }}</a-radio-button>
            <a-radio-button value="day">{{ $t('DashBoard.index.954313-6') }}</a-radio-button>
            <a-radio-button value="week">{{ $t('DashBoard.index.954313-7') }}</a-radio-button>
          </a-radio-group>
          <a-range-picker
            v-model:value="timeRange"
            :allow-clear="false"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
            @change="onRangeChange"
          >
            <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
          </a-range-picker>
          <a-tooltip :title="$t('components.MonitorRefresh.button')">
            <a-button type="text" :loading="loading" @click="refresh">
              <template #icon><AIcon type="ReloadOutlined" /></template>
            </a-button>
          </a-tooltip>
        </div>
      </header>

      <div class="network-trend__legend">
        <span><i class="network-trend__line" />{{ $t('DeviceAccess.index.594346-26') }}</span>
        <span><i class="network-trend__line network-trend__line--sent" />{{ $t('DeviceAccess.index.594346-27') }}</span>
      </div>

      <j-empty v-if="!loading && !serverOptions.length" class="network-trend__empty" />
      <template v-else>
        <div class="network-trend__chart">
          <JEcharts :option="chartOptions" not-merge />
        </div>
        <NodeFocusSelector
          v-if="serverOptions.length > 1"
          :value="selectedNodes"
          :options="nodeOptions"
          @update:value="updateSelectedNodes"
          @reset="resetFocusedNodes"
        />
      </template>
    </section>
  </a-spin>
</template>

<script lang="ts" setup name="Network">
import type { PropType } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { useI18n } from 'vue-i18n'
import { dashboard } from '../../../../api/link/dashboard'
import { getTimeByType, networkParams, typeDataLine } from './tool'
import NodeFocusSelector from './NodeFocusSelector.vue'
import { nodeColor, nodeSeriesVisual } from './monitorData'
import {
  formatNetworkSize,
  latestNetworkValue,
  renderNetworkTooltip,
  resolveAvailableNetworkNodes,
  type NetworkSeriesMap,
} from './networkData'

type NetworkType = 'bytesRead' | 'bytesSent'

const props = defineProps({
  selectedNodes: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  defaultNodes: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  refreshVersion: {
    type: Number,
    default: 0,
  },
})
const emit = defineEmits(['update:selectedNodes'])
const { t } = useI18n()

const loading = ref(false)
const timeType = ref<'hour' | 'day' | 'week' | undefined>('hour')
const timeRange = ref<[Dayjs, Dayjs]>([dayjs(getTimeByType('hour')), dayjs()])
const serverOptions = ref<string[]>([])
const serverData = reactive<Record<NetworkType, NetworkSeriesMap>>({
  bytesRead: {},
  bytesSent: {},
})
const xAxis = ref<string[]>([])
let requestSequence = 0

const latestTraffic = (nodeId: string) => Math.max(
  latestNetworkValue(nodeId, serverData.bytesRead) ?? -1,
  latestNetworkValue(nodeId, serverData.bytesSent) ?? -1,
)
const nodeOptions = computed(() => serverOptions.value.map(nodeId => ({
  label: nodeId,
  value: nodeId,
  color: nodeColor(nodeId),
  metric: formatNetworkSize(latestTraffic(nodeId)),
})))
const selectedNodes = computed(() => props.selectedNodes)

const updateSelectedNodes = (value: string[]) => emit('update:selectedNodes', value)
const resetFocusedNodes = () => emit('update:selectedNodes', props.defaultNodes)

const normalizeResponse = (items: any[]) => {
  const timestamps = new Map<string, number>()
  const raw: Record<NetworkType, Record<string, Record<string, unknown>>> = {
    bytesRead: {},
    bytesSent: {},
  }
  items.forEach((item) => {
    const type = item.group as NetworkType
    if (type !== 'bytesRead' && type !== 'bytesSent') return
    const nodeId = item.data?.clusterNodeId
    if (!nodeId) return
    raw[type][nodeId] ||= {}
    ;(item.data?.value || []).forEach((point: any) => {
      raw[type][nodeId][point.timeString] = point.value
      timestamps.set(point.timeString, Number(point.timestamp))
    })
  })
  const orderedTimes = [...timestamps.entries()]
    .sort((left, right) => left[1] - right[1])
    .map(item => item[0])
  const nodes = [...new Set(Object.values(raw).flatMap(group => Object.keys(group)))]

  ;(['bytesRead', 'bytesSent'] as NetworkType[]).forEach((type) => {
    serverData[type] = Object.fromEntries(nodes.map(nodeId => [nodeId, {
      _data: orderedTimes.map(time => raw[type][nodeId]?.[time] ?? null),
    }]))
  })
  xAxis.value = orderedTimes
  serverOptions.value = nodes
  const nextSelectedNodes = resolveAvailableNetworkNodes(
    nodes,
    props.selectedNodes,
    props.defaultNodes,
    serverData.bytesRead,
  )
  if (nextSelectedNodes.length !== props.selectedNodes.length
    || nextSelectedNodes.some((nodeId, index) => nodeId !== props.selectedNodes[index])) {
    emit('update:selectedNodes', nextSelectedNodes)
  }
}

const loadNetwork = async () => {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const response = await dashboard(networkParams({ time: { time: timeRange.value } })) as {
      success?: boolean
      result?: any[]
    }
    if (sequence !== requestSequence) return
    normalizeResponse(response.success ? response.result || [] : [])
  } catch {
    if (sequence === requestSequence) normalizeResponse([])
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

const onRangeChange = () => {
  timeType.value = undefined
  loadNetwork()
}
const refresh = () => {
  if (timeType.value) timeRange.value = [dayjs(getTimeByType(timeType.value)), dayjs()]
  loadNetwork()
}

const chartOptions = computed(() => ({
  xAxis: { type: 'category', boundaryGap: false, data: xAxis.value },
  yAxis: { type: 'value', axisLabel: { formatter: formatNetworkSize } },
  grid: { left: 70, right: 24, bottom: 44, top: 24 },
  tooltip: {
    trigger: 'axis',
    formatter: (items: any[]) => renderNetworkTooltip(items, {
      up: t('DeviceAccess.index.594346-26'),
      down: t('DeviceAccess.index.594346-27'),
    }),
  },
  dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 4 }],
  series: selectedNodes.value.flatMap(nodeId => (['bytesRead', 'bytesSent'] as NetworkType[]).map((type) => {
    const visual = nodeSeriesVisual(nodeId)
    return {
      name: `${nodeId} · ${type === 'bytesRead' ? '↑' : '↓'}`,
      type: 'line',
      smooth: true,
      showSymbol: false,
      data: serverData[type][nodeId]?._data || [],
      ...visual,
      lineStyle: {
        ...visual.lineStyle,
        type: type === 'bytesRead' ? 'solid' : 'dashed',
      },
    }
  })) || typeDataLine,
}))

watch(timeType, (value) => {
  if (!value) return
  timeRange.value = [dayjs(getTimeByType(value)), dayjs()]
  loadNetwork()
}, { immediate: true })

watch(() => props.refreshVersion, () => {
  if (timeType.value) timeRange.value = [dayjs(getTimeByType(timeType.value)), dayjs()]
  loadNetwork()
})
</script>

<style lang="less" scoped>
.network-trend {
  min-height: 30rem;
  padding: var(--space-6, 1.5rem);
  background: var(--bg, #fff);
  border-radius: 0.25rem;
}

.network-trend__header,
.network-trend__actions,
.network-trend__legend,
.network-trend__legend span {
  display: flex;
  align-items: center;
}

.network-trend__header {
  justify-content: space-between;
  gap: var(--space-4, 1rem);

  h3 { margin: 0; }
}

.network-trend__actions,
.network-trend__legend { gap: var(--space-3, 0.75rem); }
.network-trend__legend { margin-top: var(--space-3, 0.75rem); color: rgba(0, 0, 0, 0.45); }
.network-trend__legend span { gap: 0.375rem; }
.network-trend__line { width: 1.25rem; border-top: 2px solid currentColor; }
.network-trend__line--sent { border-top-style: dashed; }
.network-trend__chart { height: 20rem; margin-top: var(--space-2, 0.5rem); }
.network-trend__empty { height: 22rem; }

@media (max-width: 70rem) {
  .network-trend__header { align-items: flex-start; flex-direction: column; }
}
</style>

<style lang="less" src="./monitorTooltip.less"></style>
