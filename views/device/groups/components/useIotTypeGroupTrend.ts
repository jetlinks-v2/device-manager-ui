import { computed, ref, watch, type Ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'

import {
  queryDeviceGroupTrend_api,
  querySpaceGroupTrend_api,
  type DeviceGroupTrendMetric,
  type DeviceGroupTrendRange,
} from '@device-manager-ui/api/deviceGroup'

import type { GroupDashboardTrendSeries } from './groupDetailDashboard.types'
import type { GroupItem, GroupOverviewModel } from './iotDeviceGroupsPage.types'

const $t = i18n.global.t

export function useIotTypeGroupTrend(
  overview: () => GroupOverviewModel,
  selectedGroup: () => GroupItem | undefined,
  activeRange: Ref<DeviceGroupTrendRange>,
) {
  const loading = ref(false)
  const runtimeSeries = ref<GroupDashboardTrendSeries[] | null>(null)
  let requestId = 0

  const trendSeries = computed(() => {
    if (isRuntimeTrendGroup()) return runtimeSeries.value ?? []
    return overview().trendSeries
  })

  watch(
    () => [
      selectedGroup()?.view,
      selectedGroup()?.sourceId,
      selectedGroup()?.areaScopeIds?.join(',') ?? '',
      activeRange.value,
    ] as const,
    () => { void loadTrend() },
    { immediate: true },
  )

  async function loadTrend() {
    if (!isRuntimeTrendGroup()) {
      requestId += 1
      runtimeSeries.value = null
      loading.value = false
      return
    }

    const group = selectedGroup()
    const scope = resolveTrendScope(group)
    if (!scope) {
      requestId += 1
      runtimeSeries.value = []
      loading.value = false
      return
    }

    const currentRequest = ++requestId
    loading.value = true
    try {
      const metrics = scope.view === 'area'
        ? await querySpaceGroupTrend_api(scope.ids, activeRange.value)
        : await queryDeviceGroupTrend_api(scope.id, activeRange.value)
      if (currentRequest === requestId) {
        runtimeSeries.value = metrics.map((metric) => toTrendSeries(metric, scope.view))
      }
    } catch {
      if (currentRequest === requestId) runtimeSeries.value = []
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  function isRuntimeTrendGroup() {
    const group = selectedGroup()
    return (group?.view === 'type' && !group.isVirtual) || group?.view === 'area'
  }

  return {
    loading,
    trendSeries,
  }
}

function resolveTrendScope(group?: GroupItem) {
  if (!group) return null
  if (group.view === 'type' && !group.isVirtual && group.sourceId) {
    return { view: 'type' as const, id: group.sourceId }
  }
  if (group.view === 'area') {
    const ids = group.areaScopeIds?.filter(Boolean) ?? []
    return ids.length ? { view: 'area' as const, ids } : null
  }
  return null
}

function toTrendSeries(metric: DeviceGroupTrendMetric, view: GroupItem['view']): GroupDashboardTrendSeries {
  const viewLabel = view === 'area' ? $t('IotDeviceGroups.view.area') : $t('IotDeviceGroups.view.type')
  if (metric.key === 'onlineRate') {
    const latest = metric.points.at(-1)?.value ?? 0
    return {
      key: 'onlineRate',
      title: $t('IotDeviceGroups.trend.onlineRateTitle'),
      unit: '%',
      value: `${formatValue(latest)}%`,
      accent: '#11C6B7',
      points: metric.points.map((item) => ({ ...item, description: $t('IotDeviceGroups.trend.onlineRateDescription', { view: viewLabel }) })),
    }
  }

  const total = metric.points.reduce((sum, item) => sum + item.value, 0)
  return {
    key: 'uplink',
    title: $t('IotDeviceGroups.trend.messageCountTitle'),
    unit: $t('IotDeviceGroups.unit.message'),
    value: formatCompactValue(total),
    accent: '#11C6B7',
    points: metric.points.map((item) => ({ ...item, description: $t('IotDeviceGroups.trend.messageDescription', { view: viewLabel }) })),
  }
}

function formatValue(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toLocaleString() : rounded.toFixed(1)
}

function formatCompactValue(value: number) {
  const rounded = Math.round(value)
  if (Math.abs(rounded) >= 10000) {
    const wan = rounded / 10000
    return $t('IotDeviceGroups.unit.tenThousand', { value: Number.isInteger(wan) ? wan.toFixed(0) : wan.toFixed(1) })
  }
  return rounded.toLocaleString()
}
