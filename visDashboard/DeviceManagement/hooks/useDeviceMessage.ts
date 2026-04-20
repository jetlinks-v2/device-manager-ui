import type { Ref } from 'vue'
import { deviceMessageConfig } from '../DeviceMessage/config'
import { fetchDeviceMessageChartData, getShortcutRange } from '../services/dashboardMetrics'
import type { DashboardCardInfo, DeviceMessageChartData, TimeRangePayload } from '../shared.ts'
import { getComponentConfig } from '../shared.ts'

const createMessageData = (): DeviceMessageChartData => ({
  xData: [],
  yData: []
})

export const useDeviceMessage = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'deviceMessage', deviceMessageConfig.componentProps.deviceMessage)
  const range = ref<TimeRangePayload>(getShortcutRange(config.value.defaultType))
  const data = ref<DeviceMessageChartData>(createMessageData())
  const loading = ref(false)
  const error = ref('')

  let timer: ReturnType<typeof setInterval> | undefined

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }

  const refresh = async () => {
    if (isEdit.value) {
      return
    }

    loading.value = true
    error.value = ''

    try {
      data.value = await fetchDeviceMessageChartData(range.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '数据加载失败'
    } finally {
      loading.value = false
    }
  }

  const updateRange = async (nextRange: TimeRangePayload) => {
    range.value = nextRange
    await refresh()
  }

  watch(
    config,
    async (current) => {
      stopTimer()
      range.value = getShortcutRange(current.defaultType)

      if (isEdit.value) {
        data.value = createMessageData()
        return
      }

      await refresh()

      if (current.isAutoRefresh && Number(current.interval) > 0) {
        timer = setInterval(() => {
          void refresh()
        }, Number(current.interval) * 1000)
      }
    },
    { immediate: true, deep: true }
  )

  watch(isEdit, (current) => {
    if (current) {
      stopTimer()
    } else {
      void refresh()
    }
  })

  onUnmounted(() => {
    stopTimer()
  })

  return {
    config,
    range,
    data,
    loading,
    error,
    refresh,
    updateRange
  }
}
