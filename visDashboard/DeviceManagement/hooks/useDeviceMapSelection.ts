import { computed, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { loadDeviceDetail, loadDeviceStates } from '../../../dataCapabilities/deviceInstanceMonitoring.service'
import type { DeviceDetailData, DeviceStateRow } from '../../../dataCapabilities/deviceInstanceMonitoring.types'
import type { DeviceMapPoint } from '../shared'

export interface DeviceMapSelectionView {
  visible: boolean
  count: number
  keyword: string
  page: number
  pageSize: number
  total: number
  rows: Array<DeviceMapPoint & { stateText: string; badge: 'success' | 'default' | 'warning' }>
  loading: boolean
  error: boolean
  detailDevice: DeviceMapPoint | undefined
  detail: DeviceDetailData | undefined
  detailLoading: boolean
  detailError: boolean
  detailFields: Array<{ label: string; value: string }>
}

/** Selection is local to one map instance; only the visible page requests live states. */
export function useDeviceMapSelection() {
  const { t, locale } = useI18n()
  const selected = shallowRef<DeviceMapPoint[]>([])
  const keyword = ref('')
  const page = ref(1)
  const pageSize = 10
  const states = shallowRef<DeviceStateRow[]>([])
  const loading = ref(false)
  const error = ref(false)
  const detailDevice = shallowRef<DeviceMapPoint>()
  const detail = shallowRef<DeviceDetailData>()
  const detailLoading = ref(false)
  const detailError = ref(false)
  let statesController: AbortController | undefined
  let detailController: AbortController | undefined

  const filtered = computed(() => {
    const search = keyword.value.trim().toLocaleLowerCase()
    return search
      ? selected.value.filter((point) => `${point.label}\n${point.deviceId}`.toLocaleLowerCase().includes(search))
      : selected.value
  })
  const pagePoints = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))

  const refreshStates = async () => {
    statesController?.abort()
    states.value = []
    error.value = false
    loading.value = false
    if (!pagePoints.value.length) return
    const controller = new AbortController()
    statesController = controller
    loading.value = true
    try {
      const result = await loadDeviceStates(
        { deviceIds: pagePoints.value.map((point) => point.deviceId) },
        controller.signal
      )
      if (!controller.signal.aborted) states.value = result
    } catch {
      if (!controller.signal.aborted) error.value = true
    } finally {
      // A stale page must not clear a newer request's loading state.
      if (!controller.signal.aborted) loading.value = false
    }
  }

  const refreshDetail = async () => {
    detailController?.abort()
    detail.value = undefined
    detailError.value = false
    detailLoading.value = false
    const device = detailDevice.value
    if (!device) return
    const controller = new AbortController()
    detailController = controller
    detailLoading.value = true
    try {
      const result = await loadDeviceDetail({ deviceId: device.deviceId }, controller.signal)
      if (!controller.signal.aborted) detail.value = result
    } catch {
      if (!controller.signal.aborted) detailError.value = true
    } finally {
      if (!controller.signal.aborted) detailLoading.value = false
    }
  }

  const closeDetail = () => {
    detailDevice.value = undefined
  }
  const close = () => {
    // Abort immediately, before the watch queue runs or the map unmounts.
    statesController?.abort()
    detailController?.abort()
    selected.value = []
    keyword.value = ''
    page.value = 1
    closeDetail()
  }
  const open = (points: DeviceMapPoint[]) => {
    close()
    selected.value = points
    if (points.length === 1) detailDevice.value = points[0]
  }
  const search = (value: string) => {
    page.value = 1
    keyword.value = value
  }
  const selectDevice = (device: DeviceMapPoint) => {
    detailDevice.value = device
  }
  const changePage = (value: number) => {
    page.value = value
  }

  watch([pagePoints, locale], () => {
    void refreshStates()
  })
  watch([detailDevice, locale], () => {
    void refreshDetail()
  })
  onUnmounted(() => {
    statesController?.abort()
    detailController?.abort()
  })

  const view: DeviceMapSelectionView = reactive({
    visible: computed(() => selected.value.length > 0),
    count: computed(() => selected.value.length),
    keyword,
    page,
    pageSize,
    total: computed(() => filtered.value.length),
    rows: computed(() =>
      pagePoints.value.map((point) => {
        const state = states.value.find((item) => item.deviceId === point.deviceId)
        return {
          ...point,
          stateText: state?.stateText || t('components.DeviceMap.unknownState'),
          badge:
            state?.state === 'online'
              ? ('success' as const)
              : state?.state === 'notActive'
              ? ('warning' as const)
              : ('default' as const)
        }
      })
    ),
    loading,
    error,
    detailDevice,
    detail,
    detailLoading,
    detailError,
    detailFields: computed(() => {
      if (!detail.value) return []
      return [
        { label: t('components.DeviceMap.deviceId'), value: detail.value.deviceId },
        {
          label: t('components.DeviceMap.state'),
          value: detail.value.stateText || t('components.DeviceMap.unknownState')
        },
        { label: t('components.DeviceMap.product'), value: detail.value.productName || '—' },
        { label: t('components.DeviceMap.organization'), value: detail.value.organizationName || '—' },
        {
          label: t('components.DeviceMap.lastActive'),
          value:
            detail.value.lastActiveTime == null ? '—' : dayjs(detail.value.lastActiveTime).format('YYYY-MM-DD HH:mm:ss')
        }
      ]
    })
  })
  return { view, open, close, search, changePage, selectDevice, closeDetail, refreshStates, refreshDetail }
}
