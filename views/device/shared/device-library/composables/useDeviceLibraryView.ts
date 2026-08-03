import type { LocationQueryValue } from 'vue-router'

import {
  DEVICE_CATEGORY_OPTIONS,
  DEVICE_SOURCE_META,
} from '@device-manager-ui/views/device/shared/device-library/composables/useDeviceLibraryMeta'
import { deviceLibraryService } from '@device-manager-ui/views/device/shared/device-library/services/device-library.service'
import type { AdapterBrand, AdapterGroup, DeviceCategory } from '@device-manager-ui/views/device/shared/device-library/services/types'

export type DeviceLibraryViewMode = 'browse' | 'browse-filtered' | 'brand-first'
export type DeviceLibraryCategoryFilter = DeviceCategory | 'all'

export interface DeviceBrandSection {
  brand: string
  adapters: Array<{
    adapter: AdapterGroup
    brand: AdapterBrand
  }>
}

function asString(value: LocationQueryValue | LocationQueryValue[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function includesText(value: string | undefined, keyword: string) {
  return Boolean(value?.toLowerCase().includes(keyword))
}

function groupTextMatches(group: AdapterGroup, keyword: string) {
  return [
    group.family,
    group.summary,
    group.accessName,
    group.accessBusiness,
    group.accessTech,
    DEVICE_SOURCE_META[group.maintainedBy],
    ...group.accessNames,
    ...group.industries,
    ...group.scenarios,
    ...group.dataPoints.flatMap((point) => [point.name, point.desc]),
  ].some((text) => includesText(text, keyword))
}

function brandMatches(group: AdapterGroup, brand: AdapterBrand, keyword: string) {
  return [
    brand.brand,
    brand.note,
    brand.connectionHint,
    ...brand.accessNames,
    ...brand.accessBusiness,
    ...brand.accessTech,
    ...brand.models,
    ...brand.requirements,
    group.family,
    group.accessName,
    group.accessBusiness,
    group.accessTech,
  ].some((text) => includesText(text, keyword))
}

function compactQuery(query: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value))
}

export function useDeviceLibraryView() {
  const route = useRoute()
  const router = useRouter()

  const groups = ref<AdapterGroup[]>([])
  const loading = ref(false)
  const error = ref('')

  const keyword = ref(asString(route.query.kw))
  const category = ref<DeviceLibraryCategoryFilter>((asString(route.query.cat) as DeviceLibraryCategoryFilter) || 'all')
  const viewModeOverride = ref<'browse' | null>(asString(route.query.view) === 'browse' ? 'browse' : null)
  const detailAdapterId = ref(asString(route.query.detail) || null)

  async function load() {
    loading.value = true
    error.value = ''
    const result = await deviceLibraryService.listAdapters()
    if (result.ok) {
      groups.value = result.data
    } else {
      error.value = result.error.message
    }
    loading.value = false
  }

  onMounted(load)

  const totalBrandCount = computed(() =>
    groups.value.reduce((sum, group) => sum + group.brands.length, 0),
  )

  const categoryCounts = computed(() => {
    const counts: Record<string, number> = { all: groups.value.length }
    for (const group of groups.value) {
      counts[group.category] = (counts[group.category] ?? 0) + 1
    }
    return counts
  })

  const hasFilter = computed(() =>
    Boolean(keyword.value.trim())
    || category.value !== 'all',
  )

  const filteredGroups = computed<AdapterGroup[]>(() => {
    const kw = keyword.value.trim().toLowerCase()
    let list = groups.value

    if (category.value !== 'all') list = list.filter((group) => group.category === category.value)

    if (!kw) return list

    return list
      .map((group) => {
        if (groupTextMatches(group, kw)) return group
        return {
          ...group,
          brands: group.brands.filter((brand) => brandMatches(group, brand, kw)),
        }
      })
      .filter((group) => group.brands.length > 0)
  })

  const uniqueFilteredBrands = computed(() => new Set(
    filteredGroups.value.flatMap((group) => group.brands.map((brand) => brand.brand)),
  ))

  const viewMode = computed<DeviceLibraryViewMode>(() => {
    if (!hasFilter.value) return 'browse'
    if (viewModeOverride.value === 'browse') return 'browse-filtered'
    return uniqueFilteredBrands.value.size === 1 ? 'brand-first' : 'browse-filtered'
  })

  const groupedByCategory = computed(() => {
    return DEVICE_CATEGORY_OPTIONS
      .filter((option) => option.key !== 'all')
      .map((option) => ({
        key: option.key as DeviceCategory,
        label: option.label,
        groups: filteredGroups.value.filter((group) => group.category === option.key),
      }))
      .filter((section) => section.groups.length > 0)
  })

  const brandSections = computed<DeviceBrandSection[]>(() => {
    const map = new Map<string, DeviceBrandSection>()
    for (const group of filteredGroups.value) {
      for (const brand of group.brands) {
        const section = map.get(brand.brand) ?? { brand: brand.brand, adapters: [] }
        section.adapters.push({ adapter: group, brand })
        map.set(brand.brand, section)
      }
    }
    return [...map.values()]
  })

  const activeFilterLabels = computed(() => {
    const labels: Array<{ key: string; label: string; clear: () => void }> = []
    if (category.value !== 'all') {
      const option = DEVICE_CATEGORY_OPTIONS.find((item) => item.key === category.value)
      labels.push({ key: 'category', label: option?.label ?? category.value, clear: () => { category.value = 'all' } })
    }
    return labels
  })

  function forceBrowseView() {
    viewModeOverride.value = 'browse'
  }

  watch(keyword, () => {
    viewModeOverride.value = null
  })

  let lastQuery = ''
  watch(
    [keyword, category, viewModeOverride, detailAdapterId],
    () => {
      const query = compactQuery({
        kw: keyword.value.trim() || undefined,
        cat: category.value !== 'all' ? category.value : undefined,
        view: viewModeOverride.value || undefined,
        detail: detailAdapterId.value || undefined,
      })
      const serialized = JSON.stringify(query)
      if (serialized === lastQuery) return
      lastQuery = serialized
      router.replace({ path: route.path, query })
    },
    { immediate: true },
  )

  return {
    groups,
    filteredGroups,
    groupedByCategory,
    brandSections,
    totalBrandCount,
    categoryCounts,
    uniqueFilteredBrands,
    keyword,
    category,
    viewMode,
    viewModeOverride,
    detailAdapterId,
    activeFilterLabels,
    loading,
    error,
    hasFilter,
    load,
    forceBrowseView,
  }
}

