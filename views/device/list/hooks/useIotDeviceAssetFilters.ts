import { computed, ref, type ComputedRef, type Ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  buildQueryFilter,
  decodeConditionFilterQuery,
  encodeConditionFilterQuery,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import type { DeviceLibraryProductFilterOption, DeviceQueryTerm } from '@device-manager-ui/api/device'
import { queryDeviceLibraryProductFilterOptions_api } from '@device-manager-ui/api/device-library'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'

import type { IotDevice, IotDeviceConnectionStatus } from '../types'

type ConnectionStatusMeta = (status: IotDeviceConnectionStatus) => { label: string }

export function cloneConditionTerms(terms: ConditionFilterTerm[] = []): ConditionFilterTerm[] {
  return terms.map((item) => ({
    ...item,
    value: Array.isArray(item.value) ? [...item.value] : item.value,
    terms: Array.isArray(item.terms)
      ? cloneConditionTerms(item.terms as ConditionFilterTerm[]) as ConditionFilterTerm['terms']
      : item.terms,
  }))
}

export function useIotDeviceAssetFilters(
  projectId: Ref<string>,
  _devices: Ref<IotDevice[]>,
  connectionStatusMeta: ConnectionStatusMeta,
  route: RouteLocationNormalizedLoaded,
  router: Router,
  onSearch: () => void,
) {
  const { t: $t } = useI18n()
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const submittedTerms = ref<ConditionFilterTerm[]>([])
  const areaOptions = ref<ProjectArea[]>([])
  const groupOptions = ref<DeviceGroup[]>([])
  const deviceLibraryProducts = ref<DeviceLibraryProductFilterOption[]>([])

  const areaChildrenByParent = computed(() => {
    const map = new Map<string, ProjectArea[]>()
    for (const area of areaOptions.value) {
      const parentId = area.parentId || ''
      map.set(parentId, [...(map.get(parentId) ?? []), area])
    }
    return map
  })

  const areaFilterOptions = computed(() => areaOptions.value.map((area) => ({ label: area.name, value: area.id })))
  const groupFilterOptions = computed(() => groupOptions.value.map((group) => ({ label: group.name, value: group.id })))

  const productFilterOptions = computed(() => {
    const grouped = new Map<string, { label: string; value: string }>()
    deviceLibraryProducts.value.forEach((product) => {
      if (!product.productId) return
      grouped.set(product.productId, {
        label: product.productName || product.productId,
        value: product.productId,
      })
    })

    return [...grouped.values()]
  })

  const accessModeOptions = computed(() => {
    const grouped = new Map<string, { label: string; value: string }>()
    deviceLibraryProducts.value.forEach((product) => {
      const value = String(product.accessProvider ?? '').trim()
      if (!value) return
      grouped.set(value, {
        label: product.accessName || value,
        value,
      })
    })
    return [...grouped.values()]
  })

  const statusOptions = computed(() => [
    { label: connectionStatusMeta('online').label, value: 'online' },
    { label: connectionStatusMeta('offline').label, value: 'offline' },
    { label: connectionStatusMeta('disabled').label, value: 'disabled' },
  ])

  const deviceTypeOptions = computed(() => [
    { label: $t('IotDeviceList.deviceType.device'), value: 'device' },
    { label: $t('IotDeviceList.deviceType.childrenDevice'), value: 'childrenDevice' },
    { label: $t('IotDeviceList.deviceType.gateway'), value: 'gateway' },
  ])

  const healthScoreOptions = computed(() => [
    { label: $t('IotDeviceList.filter.healthUrgent'), value: 'urgent' },
    { label: $t('IotDeviceList.filter.healthWatch'), value: 'watch' },
    { label: $t('IotDeviceList.filter.healthNormal'), value: 'normal' },
  ])

  const filterFields = computed<ConditionFilterField[]>(() => [
    {
      dataIndex: 'name',
      title: $t('IotDeviceList.filter.keyword'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['设备名称', '名称', 'deviceName', 'name'],
      },
    },
    {
      dataIndex: 'id',
      title: $t('IotDeviceList.filter.identifier'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['设备ID', 'ID', 'id'],
      },
    },
    {
      dataIndex: 'deviceType',
      title: $t('IotDeviceList.filter.type'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: deviceTypeOptions.value,
        matchTokens: ['设备类型', '类型', 'deviceType', 'type'],
        optionPanel: {
          multiple: false,
          showSearch: true,
        },
      },
    },
    {
      dataIndex: 'accessProvider',
      title: $t('IotDeviceList.filter.accessMode'),
      search: {
        type: 'select',
        defaultTermType: 'in',
        options: accessModeOptions.value,
        matchTokens: ['接入方式', '接入', 'accessProvider', 'accessMode'],
        optionPanel: {
          multiple: true,
          showSearch: true,
        },
      },
    },
    {
      dataIndex: 'productManufacturer',
      title: $t('IotDeviceList.filter.manufacturer'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['厂商', '制造商', 'manufacturer'],
      },
    },
    {
      dataIndex: 'productModel',
      title: $t('IotDeviceList.filter.model'),
      search: {
        type: 'string',
        defaultTermType: 'like',
        matchTokens: ['型号', 'model'],
      },
    },
    {
      dataIndex: 'status',
      title: $t('IotDeviceList.filter.status'),
      search: {
        rename: 'state',
        type: 'select',
        defaultTermType: 'in',
        options: statusOptions.value,
        matchTokens: ['状态', '连接状态', 'status', 'state'],
        optionPanel: {
          multiple: true,
          showSearch: false,
        },
      },
    },
    {
      dataIndex: 'areaId',
      title: $t('IotDeviceList.filter.area'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: areaFilterOptions.value,
        matchTokens: ['区域分组', '所属区域', '区域', 'area'],
        optionPanel: {
          multiple: false,
          showSearch: true,
        },
      },
    },
    {
      dataIndex: 'groupId',
      title: $t('IotDeviceList.filter.group'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: groupFilterOptions.value,
        matchTokens: ['业务分组', '分组', 'group'],
        optionPanel: {
          multiple: false,
          showSearch: true,
        },
      },
    },
    {
      dataIndex: 'productId',
      title: $t('IotDeviceList.filter.deviceLibrary'),
      search: {
        type: 'select',
        defaultTermType: 'in',
        routeAlias: 'productId',
        matchTokens: ['产品', '产品ID', 'productId', 'product'],
        optionPanel: {
          multiple: true,
          showSearch: true,
          loadOptions: async (keyword = '', params = {}) => {
            const searchText = keyword.trim().toLowerCase()
            const pageIndex = params.pageIndex ?? 0
            const pageSize = params.pageSize ?? 20
            const list = productFilterOptions.value.filter((item) => {
              if (!searchText) return true
              return [item.label, item.value].some((text) => text.toLowerCase().includes(searchText))
            })
            return list.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
          },
          loadSelectedOptions: async (values = []) => {
            const selected = new Set(values.map((item) => String(item ?? '').trim()).filter(Boolean))
            return productFilterOptions.value.filter((item) => selected.has(item.value))
          },
        },
      },
    },
    {
      dataIndex: 'healthScore',
      title: $t('IotDeviceList.filter.health'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: healthScoreOptions.value,
        matchTokens: ['健康评分', '健康', '风险', 'health', 'risk'],
        optionPanel: {
          multiple: false,
          showSearch: false,
        },
      },
    },
  ])
  const commonFilterFields = computed(() => ['name', 'id', 'deviceType', 'accessProvider', 'productManufacturer', 'productModel', 'status', 'areaId', 'groupId', 'productId', 'healthScore'])

  function collectAreaScopeIds(areaId: string): string[] {
    const ids = new Set<string>([areaId])
    for (const child of areaChildrenByParent.value.get(areaId) ?? []) {
      for (const id of collectAreaScopeIds(child.id)) ids.add(id)
    }
    return [...ids]
  }

  function normalizeTermValues(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value]
    return [...new Set(values
      .map((item) => String(item ?? '').trim())
      .filter(Boolean))]
  }

  function normalizeLikeValue(value: unknown) {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (!text || text.includes('%')) return text
    return `%${text}%`
  }

  function hasProductFilter(terms: ConditionFilterTerm[] = []): boolean {
    return terms.some((term) =>
      term.column === 'productId'
      || (Array.isArray(term.terms) && hasProductFilter(term.terms as ConditionFilterTerm[])),
    )
  }

  function normalizeDeviceQueryTerm(term: DeviceQueryTerm): DeviceQueryTerm | null {
    if (Array.isArray(term.terms)) {
      const terms = term.terms
        .map(normalizeDeviceQueryTerm)
        .filter((item): item is DeviceQueryTerm => Boolean(item))

      return terms.length ? { ...term, terms } : null
    }

    if (term.column === 'areaId') {
      const ids = [...new Set(normalizeTermValues(term.value).flatMap(collectAreaScopeIds))]
      if (!ids.length) return null
      // 所属区域是独立空间绑定关系，转成后端已有的设备 ID 自定义 term 查询。
      return {
        column: 'id',
        termType: 'space-bind$device',
        value: ids.length === 1 ? ids[0] : ids,
      }
    }

    if (term.column === 'groupId') {
      const ids = normalizeTermValues(term.value)
      if (!ids.length) return null
      return {
        column: 'id',
        termType: 'dev-group-tree',
        value: ids.length === 1 ? ids[0] : ids,
      }
    }

    if (term.column === 'productId') {
      const productIds = normalizeTermValues(term.value)
      return {
        column: 'productId',
        termType: productIds.length ? 'in' : 'eq',
        value: productIds.length ? productIds : '__empty_product__',
      }
    }

    if (term.column === 'name') {
      return {
        ...term,
        value: normalizeLikeValue(term.value),
        skipKeywordExpand: true,
      }
    }

    if (term.column === 'id') {
      return {
        ...term,
        value: normalizeLikeValue(term.value),
      }
    }

    if (term.column === 'deviceType') {
      // 设备详情聚合查询按产品信息过滤设备类型，跟随原版设备管理列表的 product-info term 结构。
      return {
        type: term.type,
        column: 'productId$product-info',
        value: [{
          column: 'deviceType',
          termType: term.termType,
          value: term.value,
        }],
      }
    }

    if (term.column === 'productManufacturer' || term.column === 'productModel') {
      const productColumn = term.column === 'productManufacturer' ? 'manufacturer' : 'model'
      return {
        type: term.type,
        column: 'productId$product-info',
        value: [{
          column: productColumn,
          termType: term.termType,
          value: normalizeLikeValue(term.value),
        }],
      }
    }

    if (term.column === 'state') {
      if (Array.isArray(term.value)) {
        return {
          ...term,
          value: term.value.map((item) => item === 'disabled' ? 'notActive' : item),
        }
      }

      return {
        ...term,
        value: term.value === 'disabled' ? 'notActive' : term.value,
      }
    }

    if (term.column === 'healthScore') {
      return {
        column: 'risk',
        termType: term.termType,
        value: term.value,
      }
    }

    return term
  }

  function buildDeviceQueryTerms() {
    const filter = buildQueryFilter(submittedTerms.value, filterFields.value)
    return (filter.terms as DeviceQueryTerm[])
      .map(normalizeDeviceQueryTerm)
      .filter((item): item is DeviceQueryTerm => Boolean(item))
  }

  function syncRouteQuery(terms: ConditionFilterTerm[]) {
    const q = encodeConditionFilterQuery(terms, filterFields.value)
    const nextQuery = { ...route.query }
    if (q) nextQuery.q = q
    else delete nextQuery.q
    void router.replace({ query: nextQuery })
  }

  function applyRouteTerms() {
    const decoded = cloneConditionTerms(decodeConditionFilterQuery(route.query.q, filterFields.value))
    filterTerms.value = decoded
    submittedTerms.value = decoded
  }

  function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
    filterTerms.value = cloneConditionTerms(terms)
  }

  function handleFilterSearch(payload?: { terms?: ConditionFilterTerm[] }) {
    // 路由回显依赖原始字段，接口字段映射统一留给 buildQueryFilter 处理。
    const terms = cloneConditionTerms(payload?.terms ?? filterTerms.value)
    filterTerms.value = terms
    submittedTerms.value = terms
    syncRouteQuery(terms)
    onSearch()
  }

  watch(
    () => route.query.q,
    () => applyRouteTerms(),
    { immediate: true },
  )

  watch(
    projectId,
    async (value) => {
      if (!value) {
        areaOptions.value = []
        groupOptions.value = []
        deviceLibraryProducts.value = []
        return
      }

      const [areaSettings, groups, products] = await Promise.all([
        queryProjectSpaceAreaSettings_api(value).catch(() => ({ areas: [] })),
        queryDeviceGroupDetailList_api().catch(() => []),
        queryDeviceLibraryProductFilterOptions_api(value).catch(() => []),
      ])
      areaOptions.value = areaSettings.areas
      groupOptions.value = groups
      deviceLibraryProducts.value = products
      if (hasProductFilter(submittedTerms.value)) onSearch()
    },
    { immediate: true },
  )

  return {
    filterTerms,
    filterFields: filterFields as ComputedRef<ConditionFilterField[]>,
    commonFilterFields,
    submittedTerms,
    buildDeviceQueryTerms,
    handleFilterTermsUpdate,
    handleFilterSearch,
  }
}
