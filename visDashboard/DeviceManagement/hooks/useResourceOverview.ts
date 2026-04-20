import type { Ref } from 'vue'
import { resourceOverviewCardConfig } from '../ResourceOverviewCard/config'
import { normalizeResourceOverviewItems } from '../ResourceOverviewCard/meta'
import type { DashboardCardInfo, ResourceOverviewConfig } from '../shared'
import { getComponentConfig } from '../shared'

export const useResourceOverview = (info: Ref<DashboardCardInfo | undefined>) => {
  const config = getComponentConfig<ResourceOverviewConfig>(
    info,
    'resourceOverviewCard',
    resourceOverviewCardConfig.componentProps.resourceOverviewCard
  )

  const items = computed(() => normalizeResourceOverviewItems(config.value.items))
  const loading = computed(() => false)
  const error = computed(() => '')

  return {
    config,
    items,
    loading,
    error
  }
}
