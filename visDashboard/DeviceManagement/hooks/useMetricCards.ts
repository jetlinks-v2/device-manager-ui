import type { Ref } from 'vue'
import type { DashboardCardInfo, ImageMetricData, TrendMetricData } from '../shared.ts'
import {
  fetchDeviceCountCardData,
  fetchMessageVolumeCardData,
  fetchOnlineCountCardData,
  fetchOnlineRateCardData,
  fetchProductCountCardData
} from '../services/dashboardMetrics'
import { deviceCountCardConfig } from '../DeviceCountCard/config'
import { messageVolumeCardConfig } from '../MessageVolumeCard/config'
import { onlineCountCardConfig } from '../OnlineCountCard/config'
import { onlineRateCardConfig } from '../OnlineRateCard/config'
import { productCountCardConfig } from '../ProductCountCard/config'
import { getComponentConfig } from '../shared.ts'
import { useMetricPolling } from './useMetricPolling'

const createImageData = (): ImageMetricData => ({
  primary: '--',
  secondary: '--',
  tertiary: '--'
})

const createTrendData = (): TrendMetricData => ({
  primary: '--',
  secondary: '--',
  xData: [],
  yData: []
})

export const useProductCountCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'productCountCard', productCountCardConfig.componentProps.productCountCard)

  const state = useMetricPolling({
    config,
    isEdit,
    createInitialData: createImageData,
    fetcher: (currentConfig) => fetchProductCountCardData((currentConfig.type || 'all') as 'all' | 'normal' | 'disabled')
  })

  return {
    config,
    showFooter: computed(() => config.value.type === 'all'),
    ...state
  }
}

export const useDeviceCountCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'deviceCountCard', deviceCountCardConfig.componentProps.deviceCountCard)

  const state = useMetricPolling({
    config,
    isEdit,
    createInitialData: createImageData,
    fetcher: (currentConfig) => fetchDeviceCountCardData((currentConfig.type || 'all') as 'all' | 'online' | 'offline')
  })

  return {
    config,
    showFooter: computed(() => config.value.type === 'all'),
    ...state
  }
}

export const useOnlineCountCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'onlineCountCard', onlineCountCardConfig.componentProps.onlineCountCard)

  const state = useMetricPolling({
    config,
    isEdit,
    createInitialData: createTrendData,
    fetcher: (currentConfig) => fetchOnlineCountCardData((currentConfig.type || 'all') as 'all' | 'current')
  })

  return {
    config,
    showFooter: computed(() => config.value.type === 'all'),
    ...state
  }
}

export const useMessageVolumeCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'messageVolumeCard', messageVolumeCardConfig.componentProps.messageVolumeCard)

  const state = useMetricPolling({
    config,
    isEdit,
    createInitialData: createTrendData,
    fetcher: (currentConfig) => fetchMessageVolumeCardData((currentConfig.type || 'all') as 'all' | 'today')
  })

  return {
    config,
    showFooter: computed(() => config.value.type === 'all'),
    ...state
  }
}

export const useOnlineRateCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const config = getComponentConfig(info, 'onlineRateCard', onlineRateCardConfig.componentProps.onlineRateCard)

  const state = useMetricPolling({
    config,
    isEdit,
    createInitialData: createTrendData,
    fetcher: () => fetchOnlineRateCardData()
  })

  return {
    config,
    showFooter: computed(() => true),
    ...state
  }
}
