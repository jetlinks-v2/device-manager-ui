import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DeviceQueryTerm } from './api/device'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from './api/deviceGroup'
import {
  existsDeviceSpaceAreaSupport_api,
  queryProjectSpaceAreaSettings_api,
  type DeviceSpaceAreaBinding,
  type DeviceSpaceAreaSupport,
} from './api/spaceArea'
import type { ProjectArea } from './modules/defaults/types'
import { resolveIotProjectId } from './views/device/list/hooks/useIotDeviceRouting'
import { mergeDeviceBoundAreas } from './views/device/list/hooks/iotAreaTreeOptions'
import { buildAreaScopeIds, useIotDeviceScopeCounts } from './views/device/list/hooks/useIotDeviceScopeCounts'
import {
  IOT_UNASSIGNED_GROUP_SCOPE_ID,
  IOT_UNBOUND_AREA_SCOPE_ID,
} from './views/device/list/hooks/useIotDeviceAssetFilters'
import type { IotDevice } from './views/device/list/types'

const ANY_SPACE_BINDING_VALUE = '__any_space_binding__'

/** 模块公开的设备范围能力；宿主传入固定设备条件，树、统计和路由由设备模块维护。 */
export function useDeviceScope(
  baseTerms: Ref<DeviceQueryTerm[]>,
  refreshKey: Ref<number>,
  deviceRows?: Readonly<Ref<IotDevice[]>>,
) {
  const route = useRoute()
  const router = useRouter()
  const projectId = computed(() => resolveIotProjectId(route))
  const areas = ref<ProjectArea[]>([])
  const visibleDeviceAreaBindings = ref<DeviceSpaceAreaBinding[]>([])
  const groups = ref<DeviceGroup[]>([])
  const spaceAreaSupported = ref<DeviceSpaceAreaSupport>()
  const loading = ref(false)
  const loadError = ref(false)
  const scopeType = computed(() => route.query.scopeType === 'group' ? 'group' : 'area')
  const scopeId = computed(() => String(route.query.scopeId || ''))
  // 列表已按设备权限补齐的绑定区域必须进入范围树；空间树接口本身仍只返回用户有空间读取权限的节点。
  const areaOptions = computed(() => mergeDeviceBoundAreas(
    areas.value,
    visibleDeviceAreaBindings.value,
    projectId.value,
  ))
  const areaScopeIds = computed(() => buildAreaScopeIds(areaOptions.value))
  let loadRequest: Promise<void> = Promise.resolve()

  watch(projectId, (id, _, onCleanup) => {
    let cancelled = false
    onCleanup(() => { cancelled = true })
    // 仅项目切换才清空已发现的无权限区域；筛选、翻页或空结果不能使侧栏节点消失。
    visibleDeviceAreaBindings.value = []
    loading.value = true
    loadError.value = false
    // 只有明确存在空间服务时才生成区域查询、统计和 term；探测异常保留入口但不猜测服务不存在。
    loadRequest = existsDeviceSpaceAreaSupport_api().then((supported) => {
      if (cancelled) return undefined
      spaceAreaSupported.value = supported
      if (supported === false && scopeType.value === 'area') {
        void router.replace({ query: {
          ...route.query,
          scopeType: 'group',
          scopeId: undefined,
        } })
      }
      return Promise.all([
        supported === true ? queryProjectSpaceAreaSettings_api(id) : Promise.resolve({ areas: [] }),
      queryDeviceGroupDetailList_api(),
      ])
    }).then((result) => {
      if (!result) return
      const [settings, items] = result
      if (cancelled) return
      areas.value = settings.areas
      groups.value = items
    }).catch(() => {
      if (!cancelled) loadError.value = true
    }).finally(() => {
      if (!cancelled) loading.value = false
    })
  }, { immediate: true })

  watch(deviceRows, (rows) => {
    const bindings = rows?.flatMap((device) => (
      device.areaBindings?.map((binding) => ({ deviceId: device.id, ...binding })) ?? []
    )) ?? []
    if (!bindings.length) return

    const cached = new Map(visibleDeviceAreaBindings.value.map((binding) => [
      `${binding.deviceId}:${binding.areaId}`,
      binding,
    ]))
    bindings.forEach((binding) => cached.set(`${binding.deviceId}:${binding.areaId}`, binding))
    visibleDeviceAreaBindings.value = [...cached.values()]
  }, { immediate: true })

  const terms = computed<DeviceQueryTerm[]>(() => {
    const id = scopeId.value
    if (!id) return []
    if (scopeType.value === 'group') {
      if (id !== IOT_UNASSIGNED_GROUP_SCOPE_ID) {
        return [{ column: 'id', termType: 'dev-group-tree', value: id }]
      }
      const ids = groups.value.map(group => group.id)
      return ids.length ? [{ column: 'id', termType: 'dev-group$not', value: ids }] : []
    }
    if (spaceAreaSupported.value !== true) return []
    if (id === IOT_UNBOUND_AREA_SCOPE_ID) {
      // 不能按调用者可见空间的反选判断未绑定，否则已绑定到无权限空间的设备会被误判为未绑定。
      return [{ column: 'id', termType: 'space-bind$any$not', value: ANY_SPACE_BINDING_VALUE }]
    }
    const ids = areaScopeIds.value[id] ?? [id]
    return ids.length ? [{
      column: 'id',
      termType: 'space-bind$device',
      value: ids.length === 1 ? ids[0] : ids,
    }] : []
  })

  function handleScopeChange(scope: { type: 'area' | 'group'; id: string }) {
    if (scope.type === 'area' && spaceAreaSupported.value === false) return
    void router.replace({ query: {
      ...route.query,
      scopeType: scope.type,
      scopeId: scope.id || undefined,
    } })
  }

  async function ensureReady() {
    await loadRequest
    if (loadError.value) throw new Error('Device scope options failed to load')
  }

  const countsProjectId = computed(() => loading.value || loadError.value ? '' : projectId.value)
  const counts = useIotDeviceScopeCounts(countsProjectId, areaOptions, groups, refreshKey, baseTerms, spaceAreaSupported)
  const sidebarProps = computed(() => ({
    activeType: scopeType.value,
    activeId: scopeId.value,
    showArea: spaceAreaSupported.value !== false,
    areas: areaOptions.value,
    groups: groups.value,
    totalDeviceCount: counts.totalDeviceCount.value,
    areaDeviceCounts: counts.areaDeviceCounts.value,
    groupDeviceCounts: counts.groupDeviceCounts.value,
    unboundAreaDeviceCount: counts.unboundAreaDeviceCount.value,
    unassignedGroupDeviceCount: counts.unassignedGroupDeviceCount.value,
  }))
  async function reloadGroups() { groups.value = await queryDeviceGroupDetailList_api() }
  return { sidebarProps, spaceAreaSupported, scopeType, scopeId, terms, loading, loadError, ensureReady, handleScopeChange, reloadGroups }
}
