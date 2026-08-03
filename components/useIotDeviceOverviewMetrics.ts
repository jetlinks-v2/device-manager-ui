import { computed, ref } from 'vue'

import { countDevice_api } from '../api/device'
import {
  getDeviceSummary_api,
  queryAllDeviceTrend_api,
  type DeviceGroupSummary,
  type DeviceGroupTrendPoint,
  type DeviceGroupTrendRange,
} from '../api/deviceGroup'

const emptySummary = (): DeviceGroupSummary => ({
  deviceCount: 0,
  total: 0,
  watch: 0,
  normal: 0,
  online: 0,
  offline: 0,
  noData: 0,
  onlineRate: 0,
})

const roundPercent = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded : Number(rounded.toFixed(1))
}

/**
 * Loads permission-scoped runtime metrics for the device overview.
 *
 * The overview intentionally uses aggregate APIs instead of local list rows, so
 * page filters do not narrow the headline counts.
 */
export function useIotDeviceOverviewMetrics() {
  const loading = ref(false)
  const deviceSummary = ref<DeviceGroupSummary>(emptySummary())
  const totalCount = ref(0)
  const disabledCount = ref(0)
  const onlineRateTrend = ref<DeviceGroupTrendPoint[]>([])
  const messageTrend = ref<DeviceGroupTrendPoint[]>([])
  let summaryRequestId = 0
  let messageTrendRequestId = 0
  let onlineRateTrendRequestId = 0

  const onlineCount = computed(() => Number(deviceSummary.value.online ?? 0))
  const offlineCount = computed(() => Number(deviceSummary.value.offline ?? 0))
  const onlineRate = computed(() => {
    const summaryRate = Number(deviceSummary.value.onlineRate ?? 0)
    if (Number.isFinite(summaryRate) && summaryRate > 0) return roundPercent(summaryRate)
    if (!totalCount.value) return 0
    return roundPercent((onlineCount.value / totalCount.value) * 100)
  })
  const messageValues = computed(() => messageTrend.value.map((point) => Number(point.value ?? 0)))
  const messageTotal = computed(() => messageValues.value.reduce((sum, value) => sum + value, 0))
  const messagePeak = computed(() => Math.max(...messageValues.value, 0))
  const messageAverage = computed(() => {
    if (!messageValues.value.length) return 0
    return Math.round(messageTotal.value / messageValues.value.length)
  })

  async function loadSummary() {
    const currentRequest = ++summaryRequestId
    loading.value = true
    const [totalResult, disabledResult, summaryResult] = await Promise.allSettled([
      countDevice_api(),
      countDevice_api({ terms: [{ column: 'state', termType: 'eq', value: 'notActive' }] }),
      getDeviceSummary_api(),
    ])

    if (currentRequest !== summaryRequestId) return

    if (totalResult.status === 'fulfilled') totalCount.value = Number(totalResult.value ?? 0)
    if (disabledResult.status === 'fulfilled') disabledCount.value = Number(disabledResult.value ?? 0)
    if (summaryResult.status === 'fulfilled') deviceSummary.value = summaryResult.value

    loading.value = false
  }

  async function loadMessageTrend(range: DeviceGroupTrendRange = '24h') {
    const currentRequest = ++messageTrendRequestId
    const trendResult = await queryAllDeviceTrend_api(range)
    if (currentRequest !== messageTrendRequestId) return
    messageTrend.value = trendResult.find((item) => item.key === 'uplink')?.points ?? []
  }

  async function loadOnlineRateTrend(range: DeviceGroupTrendRange = '24h') {
    const currentRequest = ++onlineRateTrendRequestId
    const trendResult = await queryAllDeviceTrend_api(range)
    if (currentRequest !== onlineRateTrendRequestId) return
    onlineRateTrend.value = trendResult.find((item) => item.key === 'onlineRate')?.points ?? []
  }

  async function load(
    messageRange: DeviceGroupTrendRange = '24h',
    onlineRateRange: DeviceGroupTrendRange = messageRange,
  ) {
    if (messageRange === onlineRateRange) {
      const currentMessageRequest = ++messageTrendRequestId
      const currentOnlineRateRequest = ++onlineRateTrendRequestId
      const trendTask = queryAllDeviceTrend_api(messageRange).then((trendResult) => {
        if (currentMessageRequest === messageTrendRequestId) {
          messageTrend.value = trendResult.find((item) => item.key === 'uplink')?.points ?? []
        }
        if (currentOnlineRateRequest === onlineRateTrendRequestId) {
          onlineRateTrend.value = trendResult.find((item) => item.key === 'onlineRate')?.points ?? []
        }
      })
      await Promise.all([loadSummary(), trendTask])
      return
    }

    await Promise.all([
      loadSummary(),
      loadMessageTrend(messageRange),
      loadOnlineRateTrend(onlineRateRange),
    ])
  }

  return {
    loading,
    totalCount,
    disabledCount,
    onlineCount,
    offlineCount,
    onlineRate,
    onlineRateTrend,
    messageTrend,
    messageValues,
    messageTotal,
    messagePeak,
    messageAverage,
    load,
    loadMessageTrend,
    loadOnlineRateTrend,
  }
}
