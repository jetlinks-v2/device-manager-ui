import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { queryDefaultAlarmLevels } from '../../../alarm/api'
import { normalizeAlarmSource, toDeviceAlarmRow } from '../../../alarm/utils'
import { queryActiveRuleCounts } from '../../../alarm/workspaceApi'
import type { AlarmLevelOption, DeviceAlarmRow, ThingPropertyPreprocess } from '../../../alarm/types'
import { loadRules } from '../../../components/PropertyRules/service'
import type { IotDevice } from '../../types'

/** 按属性合并产品与设备配置；空设备覆盖同样阻断继承，不从全局分页中筛选规则。 */
export function useDeviceAlarmDetail(device: Readonly<Ref<IotDevice>>) {
  const rows = ref<DeviceAlarmRow[]>([]), levels = ref<AlarmLevelOption[]>([])
  const keyword = ref(''), selectedId = ref<string>(), loading = ref(false), error = ref(false)
  const counts = ref<Record<string, number>>(), countsError = ref(false)
  let revision = 0, countRevision = 0
  onScopeDispose(() => { revision += 1 })
  const filtered = computed(() => {
    const word = keyword.value.trim().toLowerCase()
    return rows.value.filter(row => !word || [row.name, row.property, row.propertyName].join(' ').toLowerCase().includes(word))
  })
  async function refreshCounts() {
    const current = revision, count = ++countRevision, id = device.value.id
    countsError.value = false
    try {
      const result = await queryActiveRuleCounts(rows.value.flatMap(row => row.id ? [row.id] : []), id)
      if (current === revision && count === countRevision) counts.value = result
    } catch { if (current === revision && count === countRevision) countsError.value = true }
  }
  async function load() {
    const current = ++revision, target = device.value
    rows.value = []; counts.value = undefined; error.value = false; loading.value = true
    if (!target.id || !target.productKey) { loading.value = false; error.value = true; return }
    try {
      const [rules, options] = await Promise.all([
        loadRules({ productId: target.productKey, deviceId: target.id }),
        queryDefaultAlarmLevels().catch(() => []),
      ])
      if (current !== revision) return
      levels.value = options
      const overridden = new Set(rules.device.map(row => row.property))
      const effective = [...rules.product.filter(row => !overridden.has(row.property)), ...rules.device]
      rows.value = effective.map((raw: ThingPropertyPreprocess) => {
        const source = normalizeAlarmSource(raw)
        const property = target.thingModelMetadata?.properties?.find(item => item.id === raw.property)
        return toDeviceAlarmRow(raw, source, source === 'product' ? target.productName : target.name, property)
      }).filter((row): row is DeviceAlarmRow => Boolean(row))
      if (!rows.value.some(row => row.id === selectedId.value)) selectedId.value = undefined
      void refreshCounts()
    } catch { if (current === revision) error.value = true }
    finally { if (current === revision) loading.value = false }
  }
  watch(() => [device.value.id, device.value.productKey], () => {
    selectedId.value = undefined; keyword.value = ''; void load()
  }, { immediate: true })
  return { rows, levels, filtered, keyword, selectedId, loading, error, counts, countsError, load, refreshCounts }
}
