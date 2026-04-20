import type { Ref } from 'vue'

interface PollingConfig {
  isAutoRefresh?: boolean
  interval?: number
}

interface UseMetricPollingOptions<T, C extends PollingConfig> {
  config: Ref<C>
  isEdit: Ref<boolean>
  createInitialData: () => T
  fetcher: (config: C) => Promise<T>
}

export const useMetricPolling = <T, C extends PollingConfig>({
  config,
  isEdit,
  createInitialData,
  fetcher
}: UseMetricPollingOptions<T, C>) => {
  const data = ref<T>(createInitialData())
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
      data.value = await fetcher(config.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '数据加载失败'
    } finally {
      loading.value = false
    }
  }

  watch(
    config,
    async (current) => {
      stopTimer()

      if (isEdit.value) {
        data.value = createInitialData()
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
    data,
    loading,
    error,
    refresh
  }
}
