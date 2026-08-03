import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { TableColumnType } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import type {
  ConditionFilterChangePayload,
  ConditionFilterCommonField,
  ConditionFilterField,
  ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'

import {
  batchDeviceNodeSummary_api,
  getDeviceGroupSummary_api,
  getDeviceSummary_api,
  queryDeviceGroupDetailList_api,
  queryDeviceGroupRuntimeDevices_api,
  querySpaceGroupYesterdayOnlineRate_api,
  queryDeviceGroupYesterdayOnlineRate_api,
  queryRuntimeDevices_api,
  type DeviceGroup,
  type DeviceGroupDeviceQueryParams,
  type DeviceGroupQueryTerm,
  type DeviceGroupNodeSummary,
  type DeviceGroupSummary,
} from '@device-manager-ui/api/deviceGroup'
import {
  queryDeviceSpaceAreaBindings_api,
  queryProjectSpaceAreaSettings_api,
} from '@device-manager-ui/api/spaceArea'
import { getProjectAreaTypeLabel } from '@device-manager-ui/hooks/useProjectAreaMeta'
import { useIotDataAccessRefresh } from '@device-manager-ui/hooks/useIotDataAccessRefresh'
import {
  getIotDeviceGroupViewMeta,
  IOT_DEVICE_GROUP_VIEW_OPTIONS,
  type IotDeviceGroupView,
} from '@device-manager-ui/hooks/useIotDeviceGroupMeta'
import { useIotDeviceMeta } from '@device-manager-ui/hooks/useIotDeviceMeta'
import type { ProjectArea, ProjectAreaSettings } from '@device-manager-ui/modules/defaults/types'
import { IOT_MOCK_PROJECT_ID, iotDeviceService } from '@device-manager-ui/services/iotDevice.service'
import type { IotDevice } from '@device-manager-ui/types'

import type { AreaTreeNode, GroupItem } from './iotDeviceGroupsPage.types'
import { useIotTypeGroupDeviceBinding } from './useIotTypeGroupDeviceBinding'
import { useIotTypeGroupMutations } from './useIotTypeGroupMutations'
import {
  areaIcon,
  buildAlarmContacts,
  buildAreaDeviceQueryTerms,
  buildAreaOverviewModel,
  buildTypeOverviewModel,
  cloneTerms,
  deviceHealthScore,
  deviceRiskRank,
  groupSummary,
  matchDeviceFilterTerms,
  normalizeLocalDeviceFilterTerms,
  normalizeRuntimeDeviceQueryTerms,
  onlineDuration,
  pickPrimaryOwner,
  resolveSubmittedTerms,
  riskLevelLabel,
  riskTone,
  toDeviceFilterOptions,
  buildUnboundAreaDeviceQueryTerms,
} from './iotDeviceGroupsPage.utils'

const ALL_AREA_SOURCE_ID = '__all__'
const ALL_AREA_GROUP_ID = `area:${ALL_AREA_SOURCE_ID}`
const UNBOUND_AREA_SOURCE_ID = '__unbound__'
const UNBOUND_AREA_GROUP_ID = `area:${UNBOUND_AREA_SOURCE_ID}`
const UNASSIGNED_TYPE_SOURCE_ID = '__unassigned__'
const UNASSIGNED_TYPE_GROUP_ID = `type:${UNASSIGNED_TYPE_SOURCE_ID}`
const areaGroupKey = (sourceId: string) => `area:${sourceId}`
const $t = i18n.global.t
type GroupDeviceTableColumn = TableColumnType & { scopedSlots?: boolean }

const toSummaryFromNode = (item: DeviceGroupNodeSummary): DeviceGroupSummary => ({
  deviceCount: item.deviceCount,
  total: item.total ?? item.deviceCount,
  watch: item.watch ?? 0,
  normal: item.normal ?? item.deviceCount,
  online: item.online ?? 0,
  offline: item.offline ?? 0,
  noData: item.noData ?? 0,
  onlineRate: item.onlineRate ?? 0,
})

export function useIotDeviceGroupsPage() {
  const route = useRoute()
  const router = useRouter()
  const projectId = computed(() => String(route.params.id ?? route.query.projectId ?? IOT_MOCK_PROJECT_ID))
  const groupViewOptions = IOT_DEVICE_GROUP_VIEW_OPTIONS
  const { statusMeta, riskMeta, riskOptions } = useIotDeviceMeta()

  const activeView = ref<IotDeviceGroupView>(normalizeView(route.query.tab))
  const selectedGroupId = ref('')
  const groupKeyword = ref('')
  const deviceFilterTerms = ref<ConditionFilterTerm[]>([])
  const submittedDeviceFilterTerms = ref<ConditionFilterTerm[]>([])
  const deviceSearchTriggerKey = ref(0)
  const expandedAreaIds = ref<Set<string>>(new Set())
  const deviceGroups = ref<DeviceGroup[]>([])
  const deviceGroupsLoaded = ref(false)
  const deviceGroupSummaryById = ref<Record<string, DeviceGroupSummary>>({})
  const yesterdayOnlineRateById = ref<Record<string, number | null>>({})
  const areaDeviceCountById = ref<Record<string, number>>({})
  const areaSummaryById = ref<Record<string, DeviceGroupSummary>>({})
  const areaYesterdayOnlineRateById = ref<Record<string, number | null>>({})
  const areaSummaryLoading = ref<Record<string, boolean>>({})
  const typeGroupDeviceIdsById = ref<Record<string, string[]>>({})
  const deviceTableRefreshKey = ref(0)
  const areaSettings = ref<ProjectAreaSettings | null>(null)
  const devicesByView = ref<Partial<Record<IotDeviceGroupView, IotDevice[]>>>({})
  const typeGroupMutations = useIotTypeGroupMutations({
    activeView,
    deviceGroups,
    loadDeviceGroups,
    route,
    router,
    selectedGroupId,
    onChanged: () => { deviceGroupSummaryById.value = {} },
  })
  const typeGroupDeviceBinding = useIotTypeGroupDeviceBinding({
    getAreaBindExcludeIds: () => (areaSettings.value?.areas ?? []).map((area) => area.id),
    refreshGroup: async (groupId) => {
      const group = selectedGroup.value
      if (group?.view === 'area') {
        await refreshAreaGroup(group)
        return
      }
      const summaries = await batchDeviceNodeSummary_api([{
        id: groupId,
        query: {
          terms: [{ column: 'id', termType: 'dev-group-tree', value: groupId }],
        },
      }])
      const summary = summaries[0]
      if (!summary) return
      deviceGroupSummaryById.value = {
        ...deviceGroupSummaryById.value,
        [groupId]: toSummaryFromNode(summary),
      }
    },
    refreshList: () => {
      const group = selectedGroup.value
      if (group?.view === 'type') {
        typeGroupDeviceIdsById.value = { ...typeGroupDeviceIdsById.value, [group.sourceId]: [] }
      } else if (group?.view === 'area') {
        const { [group.id]: _summary, ...summaryRest } = areaSummaryById.value
        areaSummaryById.value = summaryRest
      }
      deviceTableRefreshKey.value += 1
    },
  })

  const activeViewMeta = computed(() => getIotDeviceGroupViewMeta(activeView.value))
  const baseDevices = computed(() => devicesByView.value[activeView.value] ?? [])
  const keyword = computed(() => groupKeyword.value.trim().toLowerCase())

  const areaChildrenByParent = computed(() => {
    const map = new Map<string | undefined, ProjectArea[]>()
    for (const area of areaSettings.value?.areas ?? []) {
      const list = map.get(area.parentId) ?? []
      list.push(area)
      map.set(area.parentId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)
    return map
  })

  const areaParentById = computed(() => new Map((areaSettings.value?.areas ?? []).map((area) => [area.id, area.parentId])))
  const areaItemById = computed(() => {
    const map = new Map<string, GroupItem>()
    for (const area of areaSettings.value?.areas ?? []) {
      const devices = baseDevices.value.filter((device) => device.areaId && collectAreaScopeIds(area.id).has(device.areaId))
      map.set(area.id, createAreaItem(area, devices, areaDeviceCountById.value[areaGroupKey(area.id)]))
    }
    return map
  })

  const allAreaItem = computed(() => createAllAreaItem(baseDevices.value))
  const unboundAreaItem = computed(() => {
    const devices = baseDevices.value.filter((device) => !device.areaId)
    const count = areaDeviceCountById.value[UNBOUND_AREA_GROUP_ID]
    return devices.length || count ? createUnboundAreaItem(devices, count) : null
  })

  const areaTreeData = computed<AreaTreeNode[]>(() => {
    const rootChildren = buildAreaNodes(undefined, 1)
    const rootItem = allAreaItem.value
    const hasKeyword = !!keyword.value
    const rootMatched = matchGroupKeyword(rootItem)
    const unboundItem = unboundAreaItem.value
    const showUnbound = !!unboundItem && (!hasKeyword || matchGroupKeyword(unboundItem))

    if (showUnbound && unboundItem) {
      rootChildren.push({
        key: unboundItem.id,
        title: unboundItem.name,
        item: unboundItem,
        depth: 1,
        isUnbound: true,
      })
    }

    if (hasKeyword && !rootMatched && !rootChildren.length) return []

    return [{
      key: rootItem.id,
      title: rootItem.name,
      item: rootItem,
      depth: 0,
      isRoot: true,
      children: rootChildren.length ? rootChildren : undefined,
    }]
  })

  const areaVisibleNodes = computed(() => flattenAreaNodes(areaTreeData.value))
  const areaExpandedKeys = computed(() => {
    const keys = new Set<string>([ALL_AREA_GROUP_ID])

    for (const areaId of expandedAreaIds.value) {
      keys.add(`area:${areaId}`)
    }

    if (keyword.value) {
      collectVisibleParentKeys(areaTreeData.value, keys)
    }

    return [...keys]
  })

  const unassignedTypeItem = computed(() => createUnassignedTypeItem())
  const typeItems = computed(() => [...deviceGroups.value.map(createDeviceGroupItem), unassignedTypeItem.value].filter(matchGroupKeyword))
  const visibleItems = computed(() => activeView.value === 'area' ? areaVisibleNodes.value.map((node) => node.item) : typeItems.value)
  const visibleListItems = computed(() => activeView.value === 'area' ? [] : typeItems.value)
  const selectedGroup = computed(() => visibleItems.value.find((item) => item.id === selectedGroupId.value))
  const selectedGroupDevices = computed(() => {
    const group = selectedGroup.value
    if (!group || group.view === 'type') return []
    const ids = new Set(group.deviceIds)
    return baseDevices.value.filter((device) => ids.has(device.id)).slice().sort((a, b) => deviceRiskRank(a) - deviceRiskRank(b) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  })

  const deviceCommonFilterFieldsByView = computed<ConditionFilterCommonField[]>(() =>
    selectedGroup.value?.view === 'type' ? ['name', 'identifier'] : ['name', 'identifier', 'status', 'risk'],
  )

  const deviceFilterFields = computed<ConditionFilterField[]>(() => {
    if (selectedGroup.value?.view === 'type') {
      return [
        { dataIndex: 'name', title: $t('IotDeviceGroups.field.name'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['设备', '名称', 'name'] } },
        { dataIndex: 'identifier', title: $t('IotDeviceGroups.field.identifier'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['设备ID', 'identifier', 'id'] } },
        { dataIndex: 'productName', title: $t('IotDeviceGroups.field.productName'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['模板', '产品', 'product'] } },
        {
          dataIndex: 'state',
          title: $t('IotDeviceGroups.field.status'),
          search: {
            type: 'select',
            defaultTermType: 'in',
            options: [
              { label: statusMeta('online').label, value: 'online' },
              { label: statusMeta('offline').label, value: 'offline' },
              { label: statusMeta('disabled').label, value: 'notActive' },
            ],
            optionPanel: { multiple: true, showSearch: false },
            matchTokens: ['状态', 'state', 'status'],
          },
        },
      ]
    }

    return [
      { dataIndex: 'name', title: $t('IotDeviceGroups.field.name'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['设备', '名称', 'name'] } },
      { dataIndex: 'identifier', title: $t('IotDeviceGroups.field.identifier'), search: { type: 'string', defaultTermType: 'like', matchTokens: ['设备ID', 'identifier', 'id'] } },
      {
        dataIndex: 'productName',
        title: $t('IotDeviceGroups.field.productName'),
        search: {
          type: 'select',
          defaultTermType: 'in',
          options: toDeviceFilterOptions(selectedGroupDevices.value.map((device) => device.productName)),
          optionPanel: { multiple: true, showSearch: true },
          matchTokens: ['模板', '产品', 'product'],
        },
      },
      {
        dataIndex: 'status',
        title: $t('IotDeviceGroups.field.status'),
        search: {
          type: 'select',
          defaultTermType: 'in',
          options: [
            { label: statusMeta('online').label, value: 'online' },
            { label: statusMeta('offline').label, value: 'offline' },
            { label: statusMeta('no-data').label, value: 'no-data' },
            { label: statusMeta('alarm').label, value: 'alarm' },
          ],
          optionPanel: { multiple: true, showSearch: false },
          matchTokens: ['状态', 'status'],
        },
      },
      {
        dataIndex: 'risk',
        title: $t('IotDeviceGroups.field.risk'),
        search: {
          type: 'select',
          defaultTermType: 'in',
          options: riskOptions.map((option) => ({ value: option.value, label: option.label })),
          optionPanel: { multiple: true, showSearch: false },
          matchTokens: ['风险', 'risk'],
        },
      },
    ]
  })

  const selectedDevices = computed(() => selectedGroupDevices.value.filter((device) => matchDeviceFilterTerms(submittedDeviceFilterTerms.value, device)))
  const currentViewCount = computed(() => activeView.value === 'area'
    ? areaVisibleNodes.value.filter((node) => !node.isRoot).length
    : visibleItems.value.length)
  const visibleDeviceCount = computed(() => activeView.value === 'type'
    ? typeItems.value.reduce((sum, item) => sum + item.summary.total, 0)
    : (areaDeviceCountById.value[ALL_AREA_GROUP_ID] ?? 0))
  const urgentGroupCount = computed(() => activeView.value === 'type'
    ? visibleItems.value.filter((item) => (deviceGroupSummaryById.value[item.sourceId]?.watch ?? 0) > 0).length
    : visibleItems.value.filter((item) => item.riskLevel === 'high').length)
  const attentionDeviceCount = computed(() => activeView.value === 'type'
    ? Object.values(deviceGroupSummaryById.value).reduce((sum, summary) => sum + summary.watch + summary.offline + summary.noData, 0)
    : baseDevices.value.filter((device) => device.risk !== 'normal' || device.status !== 'online').length)
  const selectedStats = computed(() => {
    const group = selectedGroup.value
    if (group?.view === 'type') {
      const summary = deviceGroupSummaryById.value[group.sourceId]
      return {
        total: summary?.deviceCount ?? 0,
        urgent: group.summary.urgent,
        watch: summary?.watch ?? 0,
        onlineRate: Math.round(summary?.onlineRate ?? 0),
        healthScore: group.healthScore,
      }
    }

    if (group?.view === 'area') {
      const summary = areaSummaryById.value[group.id]
      if (summary) {
        return {
          total: summary.deviceCount,
          urgent: group.summary.urgent,
          watch: summary.watch,
          onlineRate: Math.round(summary.onlineRate ?? 0),
          healthScore: group.healthScore,
        }
      }
    }

    const total = group?.view === 'area' ? group.summary.total : selectedGroupDevices.value.length
    const online = selectedGroupDevices.value.filter((device) => device.status === 'online').length
    const scores = selectedGroupDevices.value.map((device) => deviceHealthScore(device))
    return {
      total,
      urgent: selectedGroupDevices.value.filter((device) => device.risk === 'urgent').length,
      watch: selectedGroupDevices.value.filter((device) => device.risk === 'watch').length,
      onlineRate: total ? Math.round((online / total) * 100) : 0,
      healthScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0,
    }
  })

  const selectedOverview = computed(() => {
    const group = selectedGroup.value
    if (!group) return null
    return group.view === 'type'
        ? buildTypeOverviewModel({
            group,
            summary: deviceGroupSummaryById.value[group.sourceId],
            yesterdayOnlineRate: yesterdayOnlineRateById.value[group.sourceId],
            pathSegments: buildPathSegments(group),
          })
      : buildAreaOverviewModel({
          group,
          devices: selectedGroupDevices.value,
          projectId: projectId.value,
          pathSegments: buildPathSegments(group),
          summary: areaSummaryById.value[group.id],
          yesterdayOnlineRate: areaYesterdayOnlineRateById.value[group.id],
          statusMeta,
        })
  })

  watch(() => route.query.tab, async (value) => {
    const next = normalizeView(value)
    if (next === activeView.value) return
    activeView.value = next
    await ensureViewReady(next)
  })

  watch(visibleItems, (items) => {
    if (items.some((item) => item.id === selectedGroupId.value)) return
    selectedGroupId.value = items[0]?.id ?? ''
  }, { immediate: true })

  watch(selectedGroupId, () => {
    deviceFilterTerms.value = []
    submittedDeviceFilterTerms.value = []
    deviceSearchTriggerKey.value += 1
  })

  watch(() => selectedGroup.value?.id, () => {
    void ensureSelectedGroupSummary(true)
  }, { immediate: true })

  watch(typeGroupMutations.typeGroupDrawerOpen, (open) => {
    if (open) typeGroupMutations.typeGroupDrawerError.value = ''
  })

  async function ensureViewReady(view: IotDeviceGroupView) {
    if (view === 'type') {
      if (!deviceGroupsLoaded.value) await loadDeviceGroups()
    } else if (!devicesByView.value[view]) {
      const result = await iotDeviceService.getGroups(projectId.value, view)
      if (result.ok) devicesByView.value = { ...devicesByView.value, [view]: result.data.devices }
    }
    if (!areaSettings.value) {
      const nextAreaSettings = await queryProjectSpaceAreaSettings_api(projectId.value)
      areaSettings.value = nextAreaSettings
      if (!expandedAreaIds.value.size && nextAreaSettings.rootAreaId) expandedAreaIds.value = new Set([nextAreaSettings.rootAreaId])
      await loadAreaNodeSummaries()
    }
    if (view === activeView.value) await ensureSelectedGroupSummary()
  }

  async function loadDeviceGroups() {
    deviceGroups.value = await queryDeviceGroupDetailList_api()
    deviceGroupsLoaded.value = true
    await loadDeviceGroupSummaries()
  }

  async function loadDeviceGroupSummaries() {
    const requests: Array<{ id: string; query: DeviceGroupDeviceQueryParams }> = deviceGroups.value.map((group) => ({
      id: group.id,
      query: {
        terms: [{ column: 'id', termType: 'dev-group-tree', value: group.id }],
      },
    }))
    requests.push({
      id: UNASSIGNED_TYPE_SOURCE_ID,
      query: {
        terms: buildUnassignedTypeQueryTerms(),
      },
    })
    try {
      const summaries = await batchDeviceNodeSummary_api(requests)
      deviceGroupSummaryById.value = {
        ...deviceGroupSummaryById.value,
        ...Object.fromEntries(summaries.map((item) => [item.id, toSummaryFromNode(item)])),
      }
      void loadYesterdayOnlineRates()
    } catch {
      deviceGroupSummaryById.value = {}
    }
  }

  async function loadYesterdayOnlineRates() {
    const entries = await Promise.all(deviceGroups.value.map(async (group) => {
      try {
        return [group.id, await queryDeviceGroupYesterdayOnlineRate_api(group.id)] as const
      } catch {
        return [group.id, null] as const
      }
    }))
    yesterdayOnlineRateById.value = Object.fromEntries(entries)
  }

  async function loadAreaNodeSummaries() {
    const areas = areaSettings.value?.areas ?? []
    const requests = [
      { id: ALL_AREA_GROUP_ID, query: { terms: buildAllAreaDeviceQueryTerms() } },
      ...areas.map((area) => ({ id: areaGroupKey(area.id), query: { terms: buildAreaQueryTerms(area.id) } })),
      { id: UNBOUND_AREA_GROUP_ID, query: { terms: buildUnboundAreaQueryTerms() } },
    ]
    try {
      const summaries = await batchDeviceNodeSummary_api(requests)
      areaDeviceCountById.value = Object.fromEntries(summaries.map((item) => [item.id, item.deviceCount]))
    } catch {
      areaDeviceCountById.value = {}
    }
  }

  async function ensureAreaGroupSummary(group: GroupItem, force = false) {
    if ((!force && areaSummaryById.value[group.id]) || areaSummaryLoading.value[group.id]) return
    areaSummaryLoading.value = { ...areaSummaryLoading.value, [group.id]: true }
    try {
      const [summary, yesterdayOnlineRate] = await Promise.all([
        getDeviceSummary_api({ terms: buildAreaGroupQueryTerms(group) }),
        queryAreaYesterdayOnlineRate(group),
      ])
      areaSummaryById.value = {
        ...areaSummaryById.value,
        [group.id]: summary,
      }
      areaYesterdayOnlineRateById.value = {
        ...areaYesterdayOnlineRateById.value,
        [group.id]: yesterdayOnlineRate,
      }
    } finally {
      const { [group.id]: _current, ...rest } = areaSummaryLoading.value
      areaSummaryLoading.value = rest
    }
  }

  async function refreshSelectedGroupSummary(group: GroupItem) {
    if (group.view === 'area') {
      await ensureAreaGroupSummary(group, true)
      return
    }

    if (group.isVirtual) {
      await refreshUnassignedTypeGroupSummary()
      return
    }

    const [summary, yesterdayOnlineRate] = await Promise.all([
      getDeviceGroupSummary_api(group.sourceId),
      queryDeviceGroupYesterdayOnlineRate_api(group.sourceId).catch(() => null),
    ])
    deviceGroupSummaryById.value = {
      ...deviceGroupSummaryById.value,
      [group.sourceId]: summary,
    }
    yesterdayOnlineRateById.value = {
      ...yesterdayOnlineRateById.value,
      [group.sourceId]: yesterdayOnlineRate,
    }
  }

  async function ensureSelectedGroupSummary(force = false) {
    const group = selectedGroup.value
    if (!group) return
    if (!force) {
      const cached = group.view === 'area'
        ? areaSummaryById.value[group.id]
        : deviceGroupSummaryById.value[group.sourceId]
      if (cached) return
    }
    await refreshSelectedGroupSummary(group)
  }

  async function refreshUnassignedTypeGroupSummary() {
    const summaries = await batchDeviceNodeSummary_api([{
      id: UNASSIGNED_TYPE_SOURCE_ID,
      query: {
        terms: buildUnassignedTypeQueryTerms(),
      },
    }])
    const summary = summaries[0]
    if (!summary) return
    deviceGroupSummaryById.value = {
      ...deviceGroupSummaryById.value,
      [UNASSIGNED_TYPE_SOURCE_ID]: toSummaryFromNode(summary),
    }
  }

  async function refreshAreaGroup(group: GroupItem) {
    const [summary, yesterdayOnlineRate] = await Promise.all([
      getDeviceSummary_api({ terms: buildAreaGroupQueryTerms(group) }),
      queryAreaYesterdayOnlineRate(group),
      loadAreaNodeSummaries(),
    ])
    areaSummaryById.value = {
      ...areaSummaryById.value,
      [group.id]: summary,
    }
    areaYesterdayOnlineRateById.value = {
      ...areaYesterdayOnlineRateById.value,
      [group.id]: yesterdayOnlineRate,
    }
  }

  async function queryAreaYesterdayOnlineRate(group: GroupItem) {
    if (group.sourceId === ALL_AREA_SOURCE_ID || group.sourceId === UNBOUND_AREA_SOURCE_ID) return null
    try {
      return await querySpaceGroupYesterdayOnlineRate_api([...collectAreaScopeIds(group.sourceId)])
    } catch {
      return null
    }
  }

  async function onSwitchView(view: IotDeviceGroupView) {
    if (view === activeView.value) return
    activeView.value = view
    await router.replace({ query: { ...route.query, tab: view } })
    await ensureViewReady(view)
  }

  function handleAreaExpand(keys: Array<string | number>) {
    expandedAreaIds.value = new Set(
      keys
        .map((key) => String(key))
        .filter((key) => key.startsWith('area:') && key !== ALL_AREA_GROUP_ID && key !== UNBOUND_AREA_GROUP_ID)
        .map((key) => key.slice('area:'.length)),
    )
  }

  function handleDeviceFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
    deviceFilterTerms.value = cloneTerms(terms)
  }

  function handleDeviceFilterSearch(payload?: unknown) {
    submittedDeviceFilterTerms.value = resolveSubmittedTerms(payload as ConditionFilterChangePayload | undefined, deviceFilterTerms.value)
    deviceSearchTriggerKey.value += 1
  }

  async function deviceTableRequest(params: { pageIndex?: number; pageSize?: number }) {
    const group = selectedGroup.value
    const pageIndex = Number(params.pageIndex ?? 0)
    const pageSize = Number(params.pageSize ?? 10)

    if (group?.view === 'type') {
      const queryTerms = normalizeRuntimeDeviceQueryTerms(submittedDeviceFilterTerms.value)
      const result = group.isVirtual
        ? await queryRuntimeDevices_api({
          pageIndex,
          pageSize,
          withAlarmInfo: false,
          terms: [
            ...buildUnassignedTypeQueryTerms(),
            ...queryTerms,
          ],
        })
        : await queryDeviceGroupRuntimeDevices_api(group.sourceId, {
          pageIndex,
          pageSize,
          withAlarmInfo: false,
          terms: queryTerms,
        })
      mergeTypeGroupDeviceIds(group.sourceId, result.data.map((device) => device.id).filter(Boolean))
      return { success: true, result }
    }

    if (group?.view === 'area') {
      const riskTerms = normalizeLocalDeviceFilterTerms(submittedDeviceFilterTerms.value)
      const pageMultiplier = riskTerms.length ? 4 : 1
      const result = await queryRuntimeDevices_api({
        pageIndex,
        pageSize: pageSize * pageMultiplier,
        withAlarmInfo: false,
        terms: buildAreaGroupQueryTerms(group, submittedDeviceFilterTerms.value),
      })
      const data = riskTerms.length
        ? result.data.filter((device) => matchDeviceFilterTerms(riskTerms, device)).slice(0, pageSize)
        : result.data
      const enrichedData = await fillAreaBindingsForDevices(data)

      return {
        success: true,
        result: {
          ...result,
          data: enrichedData,
          total: riskTerms.length ? enrichedData.length : result.total,
          pageSize,
        },
      }
    }

    return {
      success: true,
      result: {
        data: selectedDevices.value.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
        total: selectedDevices.value.length,
        pageIndex,
        pageSize,
      },
    }
  }

  const deviceTableColumns = computed<GroupDeviceTableColumn[]>(() => [
    { title: $t('IotDeviceGroups.field.name'), dataIndex: 'name', key: 'name', scopedSlots: true, ellipsis: true, width: 200 },
    { title: $t('IotDeviceGroups.field.status'), dataIndex: 'status', key: 'status', scopedSlots: true, width: 112 },
    { title: $t('IotDeviceGroups.field.onlineDuration'), dataIndex: 'onlineDuration', key: 'onlineDuration', scopedSlots: true, width: 130 },
    { title: $t('IotDeviceGroups.field.lastSeen'), dataIndex: 'lastSeen', key: 'lastSeen', scopedSlots: true, width: 140 },
    { title: $t('IotDeviceGroups.field.area'), dataIndex: 'area', key: 'area', ellipsis: true, width: 160 },
    { title: $t('IotDeviceGroups.field.healthScore'), dataIndex: 'healthScore', key: 'healthScore', scopedSlots: true, width: 100 },
    { title: $t('IotDeviceGroups.field.actions'), dataIndex: 'actions', key: 'actions', scopedSlots: true, width: 100 },
  ])

  const deviceTableParams = computed(() => {
    const group = selectedGroup.value
    const filterKey = JSON.stringify(submittedDeviceFilterTerms.value)
    return {
      groupId: selectedGroupId.value,
      total: group?.view === 'type'
        ? (deviceGroupSummaryById.value[group.sourceId]?.deviceCount ?? 0)
        : group?.view === 'area'
          ? (areaSummaryById.value[group.id]?.deviceCount ?? 0)
          : selectedDevices.value.length,
      filterKey,
      refreshKey: group?.view === 'type'
        ? `${group.sourceId}:${filterKey}:${deviceSearchTriggerKey.value}:${deviceTableRefreshKey.value}`
        : group?.view === 'area'
          ? `${group.id}:${filterKey}:${deviceSearchTriggerKey.value}:${deviceTableRefreshKey.value}:${areaSummaryById.value[group.id]?.deviceCount ?? 0}`
          : selectedDevices.value.map((device) => device.id).join('|'),
    }
  })

  const deviceTablePagination = {
    pageSizeOptions: ['10', '20', '50'],
    showSizeChanger: true,
    showTotal: (total: number) => $t('IotDeviceGroups.pagination.total', { total }),
  }

  function mergeTypeGroupDeviceIds(groupId: string, deviceIds: string[]) {
    if (!deviceIds.length) return
    const currentIds = typeGroupDeviceIdsById.value[groupId] ?? []
    const nextIds = [...new Set([...currentIds, ...deviceIds])]
    if (nextIds.length === currentIds.length) return

    typeGroupDeviceIdsById.value = {
      ...typeGroupDeviceIdsById.value,
      [groupId]: nextIds,
    }
  }

  useIotDataAccessRefresh(projectId, async () => {
    devicesByView.value = {}
    areaSettings.value = null
    deviceGroups.value = []
    deviceGroupsLoaded.value = false
    deviceGroupSummaryById.value = {}
    yesterdayOnlineRateById.value = {}
    areaDeviceCountById.value = {}
    areaSummaryById.value = {}
    areaYesterdayOnlineRateById.value = {}
    expandedAreaIds.value = new Set()
    await Promise.all(groupViewOptions.map((option) => ensureViewReady(option.key)))
  })

  onMounted(() => {
    void Promise.all(groupViewOptions.map((option) => ensureViewReady(option.key)))
      .then(() => ensureSelectedGroupSummary())
  })

  return {
    activeView,
    activeViewMeta,
    areaIcon,
    attentionDeviceCount,
    currentViewCount,
    deviceFilterFields,
    deviceFilterTerms,
    deviceTableColumns,
    deviceTablePagination,
    deviceTableParams,
    deviceTableRequest,
    deviceHealthScore,
    areaExpandedKeys,
    areaTreeData,
    deviceCommonFilterFieldsByView,
    deviceDetailPath: (deviceId: string) => `/iot-user/device/list/Detail/${deviceId}?${new URLSearchParams({ projectId: projectId.value }).toString()}`,
    groupKeyword,
    groupViewOptions,
    handleDeviceFilterSearch,
    handleDeviceFilterTermsUpdate,
    handleTypeGroupDelete: typeGroupMutations.handleTypeGroupDelete,
    handleTypeGroupSave: typeGroupMutations.handleTypeGroupSave,
    handleBindDeviceFilterSearch: typeGroupDeviceBinding.handleBindDeviceFilterSearch,
    handleBindDevices: typeGroupDeviceBinding.handleBindDevices,
    handleUnbindDevice: typeGroupDeviceBinding.handleUnbindDevice,
    onlineDuration,
    onSwitchView,
    openTypeGroupDrawer: typeGroupMutations.openCreateTypeGroupDrawer,
    openEditTypeGroupDrawer: typeGroupMutations.openEditTypeGroupDrawer,
    openBindDeviceModal: typeGroupDeviceBinding.openBindDeviceModal,
    riskLevelLabel,
    riskTone,
    selectedGroup,
    selectedGroupId,
    selectedOverview,
    selectedStats,
    selectedVisibleDeviceCount: computed(() => selectedStats.value.total),
    handleAreaExpand,
    typeGroupDrawerError: typeGroupMutations.typeGroupDrawerError,
    typeGroupDrawerMode: typeGroupMutations.typeGroupDrawerMode,
    typeGroupDrawerOpen: typeGroupMutations.typeGroupDrawerOpen,
    typeGroupEditingValue: typeGroupMutations.typeGroupEditingValue,
    typeGroupDeleting: typeGroupMutations.typeGroupDeleting,
    typeGroupSaving: typeGroupMutations.typeGroupSaving,
    bindDeviceError: typeGroupDeviceBinding.bindDeviceError,
    bindDeviceGroup: typeGroupDeviceBinding.bindDeviceGroup,
    bindDeviceModalOpen: typeGroupDeviceBinding.bindDeviceModalOpen,
    bindDeviceSaving: typeGroupDeviceBinding.bindDeviceSaving,
    bindDeviceSearchTriggerKey: typeGroupDeviceBinding.bindDeviceSearchTriggerKey,
    queryBindableDevices: typeGroupDeviceBinding.queryBindableDevices,
    urgentGroupCount,
    viewCount: (view: IotDeviceGroupView) => view === 'area' ? areaSettings.value?.areas.length ?? 0 : deviceGroups.value.length + 1,
    visibleDeviceCount,
    visibleItems,
    visibleListItems,
  }

  function normalizeView(value: unknown): IotDeviceGroupView {
    return value === 'type' || value === 'area' ? value : 'area'
  }

  function collectAreaScopeIds(areaId: string): Set<string> {
    const ids = new Set<string>([areaId])
    for (const child of areaChildrenByParent.value.get(areaId) ?? []) {
      for (const id of collectAreaScopeIds(child.id)) ids.add(id)
    }
    return ids
  }

  function buildAllAreaDeviceQueryTerms(terms: ConditionFilterTerm[] = []) {
    const ids = (areaSettings.value?.areas ?? []).map((area) => area.id)
    return buildAreaDeviceQueryTerms(ids, terms)
  }

  function buildAreaQueryTerms(areaId: string, terms: ConditionFilterTerm[] = []) {
    return buildAreaDeviceQueryTerms([...collectAreaScopeIds(areaId)], terms)
  }

  function buildUnboundAreaQueryTerms(terms: ConditionFilterTerm[] = []) {
    const ids = (areaSettings.value?.areas ?? []).map((area) => area.id)
    return buildUnboundAreaDeviceQueryTerms(ids, terms)
  }

  async function fillAreaBindingsForDevices(devices: IotDevice[]): Promise<IotDevice[]> {
    const ids = devices.map((device) => device.id).filter(Boolean)
    if (!ids.length) return devices
    try {
      const bindings = await queryDeviceSpaceAreaBindings_api(ids, projectId.value)
      const bindingsByDeviceId = bindings.reduce<Record<string, typeof bindings>>((acc, item) => {
        const list = acc[item.deviceId] ?? []
        acc[item.deviceId] = [...list, item]
        return acc
      }, {})
      return devices.map((device) => {
        const firstArea = bindingsByDeviceId[device.id]?.[0]
        if (!firstArea) return device
        return {
          ...device,
          areaId: firstArea.areaId || device.areaId,
          area: firstArea.area || device.area,
        }
      })
    } catch {
      return devices
    }
  }

  function buildUnassignedTypeQueryTerms(): DeviceGroupQueryTerm[] {
    const ids = deviceGroups.value.map((group) => group.id).filter(Boolean)
    return ids.length ? [{ column: 'id', termType: 'dev-group$not', value: ids }] : []
  }

  function buildAreaGroupQueryTerms(group: GroupItem, terms: ConditionFilterTerm[] = []) {
    if (group.sourceId === ALL_AREA_SOURCE_ID) return buildAllAreaDeviceQueryTerms(terms)
    if (group.sourceId === UNBOUND_AREA_SOURCE_ID) return buildUnboundAreaQueryTerms(terms)
    return buildAreaQueryTerms(group.sourceId, terms)
  }

  function createAreaItem(area: ProjectArea, devices: IotDevice[], deviceCount?: number): GroupItem {
    const summary = groupSummary(devices)
    const total = deviceCount ?? 0
    const areaScopeIds = [...collectAreaScopeIds(area.id)]
    return {
      id: areaGroupKey(area.id),
      sourceId: area.id,
      view: 'area',
      viewLabel: $t('IotDeviceGroups.view.area'),
      name: area.name,
      owner: pickPrimaryOwner(devices),
      objective: $t('IotDeviceGroups.group.area.objective'),
      description: area.description || $t('IotDeviceGroups.group.area.description', { name: area.name }),
      condition: area.parentId ? $t('IotDeviceGroups.group.area.condition.child', { name: area.name }) : $t('IotDeviceGroups.group.area.condition.all'),
      deviceIds: devices.map((device) => device.id),
      tags: [getProjectAreaTypeLabel(area.type), area.code, ...area.aliases].filter(Boolean).slice(0, 4),
      summary: { ...summary, total, normal: total },
      healthScore: 0,
      riskLevel: 'low',
      alarmContacts: buildAlarmContacts(devices),
      automationRules: [$t('IotDeviceGroups.group.area.rule.escalate')],
      actions: [$t('IotDeviceGroups.group.area.action.inspect'), $t('IotDeviceGroups.group.action.notifyOwner'), $t('IotDeviceGroups.group.area.action.summary')],
      area,
      areaScopeIds,
    }
  }

  function createAllAreaItem(devices: IotDevice[]): GroupItem {
    const summary = groupSummary(devices)
    const total = areaDeviceCountById.value[ALL_AREA_GROUP_ID] ?? 0
    const areaScopeIds = (areaSettings.value?.areas ?? []).map((area) => area.id)
    return {
      id: ALL_AREA_GROUP_ID,
      sourceId: ALL_AREA_SOURCE_ID,
      view: 'area',
      viewLabel: $t('IotDeviceGroups.view.area'),
      name: $t('IotDeviceGroups.group.allArea.name'),
      owner: pickPrimaryOwner(devices),
      objective: $t('IotDeviceGroups.group.allArea.objective'),
      description: $t('IotDeviceGroups.group.allArea.description'),
      condition: $t('IotDeviceGroups.group.area.condition.all'),
      deviceIds: devices.map((device) => device.id),
      tags: [$t('IotDeviceGroups.group.allArea.tag')],
      summary: { ...summary, total, normal: total },
      healthScore: 0,
      riskLevel: 'low',
      alarmContacts: buildAlarmContacts(devices),
      automationRules: [$t('IotDeviceGroups.group.allArea.rule.priority')],
      actions: [$t('IotDeviceGroups.group.allArea.action.overview'), $t('IotDeviceGroups.group.allArea.action.drill'), $t('IotDeviceGroups.group.allArea.action.notify')],
      areaScopeIds,
    }
  }

  function createUnboundAreaItem(devices: IotDevice[], deviceCount?: number): GroupItem {
    const summary = groupSummary(devices)
    const total = deviceCount ?? 0
    return {
      id: UNBOUND_AREA_GROUP_ID,
      sourceId: UNBOUND_AREA_SOURCE_ID,
      view: 'area',
      viewLabel: $t('IotDeviceGroups.view.area'),
      name: $t('IotDeviceGroups.group.unboundArea.name'),
      owner: pickPrimaryOwner(devices),
      objective: $t('IotDeviceGroups.group.unboundArea.objective'),
      description: $t('IotDeviceGroups.group.unboundArea.description'),
      condition: $t('IotDeviceGroups.group.unboundArea.condition'),
      deviceIds: devices.map((device) => device.id),
      tags: [$t('IotDeviceGroups.group.unboundArea.tag')],
      summary: { ...summary, total, normal: total },
      healthScore: 0,
      riskLevel: 'low',
      alarmContacts: buildAlarmContacts(devices),
      automationRules: [$t('IotDeviceGroups.group.unboundArea.rule.bindArea')],
      actions: [$t('IotDeviceGroups.group.unboundArea.action.bindArea'), $t('IotDeviceGroups.group.action.notifyOwner')],
    }
  }

  function createDeviceGroupItem(group: DeviceGroup): GroupItem {
    const summary = deviceGroupSummaryById.value[group.id]
    const total = summary?.deviceCount ?? 0
    return {
      id: `type:${group.id}`,
      sourceId: group.id,
      view: 'type',
      viewLabel: $t('IotDeviceGroups.view.type'),
      name: group.name,
      owner: '',
      objective: $t('IotDeviceGroups.group.type.objective'),
      description: group.description || $t('IotDeviceGroups.group.type.description', { name: group.name }),
      condition: $t('IotDeviceGroups.group.type.condition', { name: group.name }),
      deviceIds: typeGroupDeviceIdsById.value[group.id] ?? [],
      tags: [group.key].filter(Boolean),
      summary: {
        total,
        urgent: 0,
        watch: summary?.watch ?? 0,
        normal: summary?.normal ?? total,
        offline: summary?.offline ?? 0,
        noData: summary?.noData ?? 0,
        alarm: 0,
      },
      healthScore: 0,
      riskLevel: (summary?.watch ?? 0) > 0 || (summary?.offline ?? 0) > 0 || (summary?.noData ?? 0) > 0 ? 'medium' : 'low',
      alarmContacts: [],
      automationRules: [],
      actions: [],
      bizTypeMeta: { code: group.key, sortIndex: group.sortIndex },
    }
  }

  function createUnassignedTypeItem(): GroupItem {
    const summary = deviceGroupSummaryById.value[UNASSIGNED_TYPE_SOURCE_ID]
    const total = summary?.deviceCount ?? summary?.total ?? 0
    return {
      id: UNASSIGNED_TYPE_GROUP_ID,
      sourceId: UNASSIGNED_TYPE_SOURCE_ID,
      view: 'type',
      viewLabel: $t('IotDeviceGroups.view.type'),
      name: $t('IotDeviceGroups.group.unassignedType.name'),
      owner: '',
      objective: $t('IotDeviceGroups.group.unassignedType.objective'),
      description: $t('IotDeviceGroups.group.unassignedType.description'),
      condition: $t('IotDeviceGroups.group.unassignedType.condition'),
      deviceIds: typeGroupDeviceIdsById.value[UNASSIGNED_TYPE_SOURCE_ID] ?? [],
      tags: [$t('IotDeviceGroups.group.unassignedType.tag')],
      summary: {
        total,
        urgent: 0,
        watch: summary?.watch ?? 0,
        normal: summary?.normal ?? total,
        offline: summary?.offline ?? 0,
        noData: summary?.noData ?? 0,
        alarm: 0,
      },
      healthScore: 0,
      riskLevel: 'low',
      alarmContacts: [],
      automationRules: [],
      actions: [],
      isVirtual: true,
      bizTypeMeta: { code: 'unassigned', sortIndex: Number.MAX_SAFE_INTEGER },
    }
  }

  function matchGroupKeyword(item: GroupItem) {
    if (!keyword.value) return true
    return [item.name, item.description, item.condition, item.bizTypeMeta?.code, item.owner].some((text) => String(text || '').toLowerCase().includes(keyword.value))
  }

  function buildPathSegments(group: GroupItem) {
    if (group.view === 'type') return [group.viewLabel, group.name]
    if (group.sourceId === ALL_AREA_SOURCE_ID || group.sourceId === UNBOUND_AREA_SOURCE_ID) return [group.viewLabel, group.name]
    const names: string[] = []
    let cursor = group.sourceId
    while (cursor) {
      const area = areaSettings.value?.areas.find((item) => item.id === cursor)
      if (!area) break
      names.unshift(area.name)
      cursor = areaParentById.value.get(cursor) || ''
    }
    return [group.viewLabel, ...names]
  }

  function buildAreaNodes(parentId: string | undefined, depth: number): AreaTreeNode[] {
    const nodes: AreaTreeNode[] = []
    for (const area of areaChildrenByParent.value.get(parentId) ?? []) {
      const item = areaItemById.value.get(area.id)
      if (!item) continue

      const children = buildAreaNodes(area.id, depth + 1)
      const matched = matchGroupKeyword(item)

      if (keyword.value && !matched && !children.length) continue

      nodes.push({
        key: item.id,
        title: item.name,
        item,
        depth,
        children: children.length ? children : undefined,
      })
    }
    return nodes
  }

  function flattenAreaNodes(nodes: AreaTreeNode[]): AreaTreeNode[] {
    const list: AreaTreeNode[] = []
    for (const node of nodes) {
      list.push(node)
      if (node.children?.length) list.push(...flattenAreaNodes(node.children))
    }
    return list
  }

  // 搜索态下强制展开所有可见父节点，避免命中结果仍被折叠隐藏。
  function collectVisibleParentKeys(nodes: AreaTreeNode[], keys: Set<string>) {
    for (const node of nodes) {
      if (node.children?.length) {
        keys.add(node.key)
        collectVisibleParentKeys(node.children, keys)
      }
    }
  }
}
