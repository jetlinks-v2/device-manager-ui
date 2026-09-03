import type { Ref } from 'vue'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { useProductStore } from '@device-manager-ui/store/product'
import { eventShowCardConfig } from '@device-manager-ui/visDashboard/MetadataManagement/EventShowCard/config'
import type { DashboardCardInfo, DashboardEventMetadata, EventShowCardConfig } from '../shared'
import { getComponentConfig } from '../shared'

const parseMetadataEvents = (metadata: string | undefined): DashboardEventMetadata[] => {
  try {
    const parsed = JSON.parse(metadata || '{}')
    return Array.isArray(parsed.events) ? parsed.events : []
  } catch (error) {
    return []
  }
}

const mergeEvents = (baseEvents: DashboardEventMetadata[], targetEvents: DashboardEventMetadata[]) => {
  const eventMap = new Map<string, DashboardEventMetadata>()

  baseEvents.forEach((item) => {
    eventMap.set(item.id, item)
  })

  targetEvents.forEach((item) => {
    eventMap.set(item.id, item)
  })

  return eventMap
}

export const useEventShowCard = (info: Ref<DashboardCardInfo | undefined>, isEdit: Ref<boolean>) => {
  const route = useRoute()
  const instanceStore = useInstanceStore()
  const productStore = useProductStore()

  const config = getComponentConfig<EventShowCardConfig>(
    info,
    'eventShowCard',
    eventShowCardConfig.componentProps.eventShowCard
  )

  const isProduct = computed(() => route.name === 'device/Product/Detail')
  const isPreview = computed(() => isEdit.value)
  const deviceId = computed(() =>
    isProduct.value ? String(config.value.targetId || '') : String(instanceStore.current.id || '')
  )

  const eventMap = computed(() => {
    const baseMetadata = isProduct.value ? productStore.detail.metadata : instanceStore.current.metadata
    const baseEvents = parseMetadataEvents(baseMetadata)

    if (!isProduct.value) {
      return mergeEvents(baseEvents, [])
    }

    if (!config.value.targetId) {
      return new Map<string, DashboardEventMetadata>()
    }

    return mergeEvents(baseEvents, parseMetadataEvents(config.value.targetMetadata))
  })

  const selectedEvents = computed(() => {
    const current = eventMap.value.get(String(config.value.value || ''))
    return current ? [current] : []
  })

  const emptyText = computed(() => {
    if (isProduct.value && !config.value.targetId) {
      return '请选择设备'
    }

    return '请选择事件'
  })

  return {
    config,
    selectedEvents,
    deviceId,
    isPreview,
    emptyText
  }
}
