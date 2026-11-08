import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { queryMetricDevices, loadMetricDevice, loadMetricProduct, loadMetricBuiltins } from '../../../api/metricSources'
import type { MetricSourcePicker, MetricSourceSelection } from '@jetlinks-web-core/components'
import type { MetricDeviceOption, MetricPropertyOption } from './metricSources'
import { useMetricOutputSources } from './useMetricOutputSources'
import type { MetricOutputSource } from '../../../api/metricSources'
import { useMetricMemberStatistics } from './useMetricMemberStatistics'

/** 一个宿主只有一个待完成选择；切换对象或卸载时取消，不将旧来源写入新配置。 */
export function useMetricSourcePicker() {
  const request = shallowRef<Parameters<MetricSourcePicker>[0]>()
  const devices = ref<MetricDeviceOption[]>([])
  const selectedDevice = ref<MetricDeviceOption>()
  const properties = ref<MetricPropertyOption[]>([])
  const builtins = ref<Awaited<ReturnType<typeof loadMetricBuiltins>>>([])
  const builtinScope = ref<{ type:string; id:string }>()
  const includeChildren = ref(false)
  const builtinLoading = ref(false)
  const builtinError = ref(false)
  let builtinVersion = 0
  const deviceId = ref('')
  const propertyId = ref('')
  const category = ref<'property' | 'builtin' | 'metric'>('property')
  const choosingObject = ref(false)
  const keyword = ref('')
  const scoped = ref(true)
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const propertyLoading = ref(false)
  const queryError = ref(false)
  const propertyError = ref(false)
  const error = computed(() => category.value === 'builtin' && ownerBuiltin.value ? builtinError.value : queryError.value || propertyError.value)
  let queryVersion = 0
  let propertyVersion = 0
  let resolveSelection: ((selection?: MetricSourceSelection) => void) | undefined
  const statistics = useMetricMemberStatistics(request, builtinScope, includeChildren, selection => {
    resolveSelection?.(selection); resolveSelection = undefined; cancel()
  })
  const open = computed(() => Boolean(request.value))
  const inherited = computed(() => request.value?.context.scope === 'children')
  const hasOwnerBuiltins = computed(() => !inherited.value && !!request.value)
  const ownerBuiltin = computed(() => category.value === 'builtin' && hasOwnerBuiltins.value)
  const historyInput = computed(() => !!request.value?.input.source?.lookback)
  const platformProperty = computed(() => properties.value.find(item => item.id === propertyId.value && item.platform))
  const metricSources = useMetricOutputSources(request, deviceId, computed(() => category.value === 'metric'))
  const canConfirm = computed(() => !statistics.active.value && (ownerBuiltin.value
    ? !!platformProperty.value && (!historyInput.value || platformProperty.value.history) && !!deviceId.value && !propertyLoading.value && !propertyError.value
      || request.value?.scheduled !== false && !historyInput.value && !builtinLoading.value && !builtinError.value
        && builtins.value.some(item => item.id === propertyId.value && !item.configurationRequired)
    : Boolean((inherited.value || deviceId.value) && propertyId.value && !propertyLoading.value && !error.value
      && properties.value.some(property => property.id === propertyId.value && (!property.platform || !historyInput.value || property.history)))))

  function cancel() {
    statistics.close()
    queryVersion += 1
    propertyVersion += 1
    builtinVersion += 1
    request.value = undefined
    resolveSelection?.()
    resolveSelection = undefined
  }
  const pickSource: MetricSourcePicker = (next) => {
    cancel()
    request.value = next
    selectedDevice.value = undefined
    devices.value = []
    properties.value = []
    builtins.value = []
    const context = next.context
    builtinScope.value = next.mapping?.kind === 'builtin' || next.mapping?.statistics
      ? { type:next.mapping.thingType || context.targetType || context.ownerType, id:next.mapping.thingId || context.targetId || context.ownerId }
      : { type:context.ownerType, id:context.ownerId }
    includeChildren.value = !!next.mapping?.includeChildren
    builtinError.value = false
    deviceId.value = next.mapping?.statistics ? '' : (next.mapping?.thingType && next.mapping.thingType !== 'device' ? '' : next.mapping?.thingId)
      || (next.context.ownerType === 'device' && !inherited.value ? next.context.ownerId : '')
    propertyId.value = next.mapping?.statistics ? 'memberStatistics' : next.mapping?.id || ''
    category.value = next.mapping?.statistics ? 'builtin' : next.mapping?.kind === 'metric' || next.input.source?.kind === 'metric' ? 'metric' : next.mapping?.kind === 'builtin' || next.mapping?.id?.startsWith('$') ? 'builtin' : 'property'
    choosingObject.value = !inherited.value && !deviceId.value && category.value === 'property'
    keyword.value = ''
    scoped.value = true
    page.value = 1
    queryError.value = false
    propertyError.value = false
    const pending = new Promise<MetricSourceSelection | undefined>(resolve => { resolveSelection = resolve })
    if (next.mapping?.statistics) statistics.open(next.mapping)
    if (inherited.value) void loadProduct()
    else if (ownerBuiltin.value) { if (deviceId.value) void selectDevice(deviceId.value, true); else void loadBuiltins() }
    else { if (choosingObject.value) void search(); if (deviceId.value) void selectDevice(deviceId.value, true) }
    return pending
  }
  async function loadBuiltins() {
    if (!request.value || !hasOwnerBuiltins.value) return
    const version = ++builtinVersion
    builtinLoading.value = true; builtinError.value = false
    try {
      const source = builtinScope.value!
      const items = await loadMetricBuiltins(source.type, source.id)
      if (version === builtinVersion) builtins.value = items
    } catch { if (version === builtinVersion) builtinError.value = true }
    finally { if (version === builtinVersion) builtinLoading.value = false }
  }
  async function loadProduct() {
    if (!request.value || !inherited.value) return
    const version = ++propertyVersion
    propertyLoading.value = true
    propertyError.value = false
    try {
      const result = await loadMetricProduct(request.value.context.ownerId)
      if (version === propertyVersion) properties.value = result
    } catch { if (version === propertyVersion) propertyError.value = true }
    finally { if (version === propertyVersion) propertyLoading.value = false }
  }
  async function search() {
    if (!request.value) return
    const version = ++queryVersion
    loading.value = true
    queryError.value = false
    try {
      const result = await queryMetricDevices(request.value.context, keyword.value, page.value - 1, scoped.value)
      if (version !== queryVersion) return
      devices.value = result.data
      if (selectedDevice.value && !devices.value.some(device => device.id === selectedDevice.value?.id)) devices.value.push(selectedDevice.value)
      total.value = result.total
    } catch { if (version === queryVersion) queryError.value = true }
    finally { if (version === queryVersion) loading.value = false }
  }
  async function selectDevice(id: string, restoring = false) {
    const version = ++propertyVersion
    deviceId.value = id
    if (category.value === 'builtin') {
      builtinScope.value = { type:'device', id }
      void loadBuiltins()
    }
    properties.value = []
    if (!restoring) propertyId.value = ''
    propertyLoading.value = true
    propertyError.value = false
    try {
      const result = await loadMetricDevice(id)
      if (version !== propertyVersion) return
      if (!devices.value.some(device => device.id === id)) devices.value.push(result.device)
      selectedDevice.value = result.device
      properties.value = result.properties
      if (!restoring) choosingObject.value = false
    } catch { if (version === propertyVersion) propertyError.value = true }
    finally { if (version === propertyVersion) propertyLoading.value = false }
  }
  function changeScope(value: boolean) { scoped.value = value; page.value = 1; void search() }
  function changePage(value: number) { page.value = value; void search() }
  function changeObject() { statistics.close(); choosingObject.value = true; void search() }
  function useOwner() {
    statistics.close()
    const context = request.value?.context
    if (!context) return
    builtinScope.value = { type:context.ownerType, id:context.ownerId }
    deviceId.value = ''; selectedDevice.value = undefined; choosingObject.value = false; propertyId.value = ''
    if (category.value === 'builtin') void loadBuiltins()
  }
  function changeCategory(value:typeof category.value) {
    statistics.close()
    category.value = value
    if (value === 'builtin' && hasOwnerBuiltins.value) {
      if (deviceId.value) { builtinScope.value = { type:'device', id:deviceId.value }; choosingObject.value = false; void loadBuiltins() }
      else useOwner()
    }
    else if (value !== 'metric' && !inherited.value && !deviceId.value) changeObject()
    else choosingObject.value = false
  }
  function confirmMetric(item:MetricOutputSource, label:string) {
    if (!request.value || inherited.value || metricSources.loading.value || metricSources.error.value
      || !metricSources.items.value.includes(item) || item.config.id === request.value.configId
      || request.value.input.source?.lookback && (!item.output.persist || item.output.latestOnly)) return
    resolveSelection?.({ mapping:{ kind:'metric', configId:item.config.id, thingType:item.config.targetType,
      thingId:item.config.targetId, id:item.output.metricId }, label })
    resolveSelection = undefined
    cancel()
  }
  function confirm(propertyLabel?: string) {
    if (!canConfirm.value) return
    if (ownerBuiltin.value && !platformProperty.value && request.value) {
      const item = builtins.value.find(item => item.id === propertyId.value)!
      const context = request.value.context
      const source = builtinScope.value!
      const label = source.type === context.ownerType && source.id === context.ownerId ? context.label || context.ownerId : source.id
      resolveSelection?.({ mapping:{ kind:'builtin', thingType:source.type, thingId:source.id, id:item.id,
        includeChildren:!!item.supportsChildren && includeChildren.value }, label:`${label} / ${item.name}` })
      resolveSelection = undefined; cancel(); return
    }
    const device = devices.value.find(item => item.id === deviceId.value)
    const property = properties.value.find(item => item.id === propertyId.value)
    if (!property) return
    const propertyName = propertyLabel || property?.name || propertyId.value
    resolveSelection?.({ mapping: { kind: 'property', thingType: 'device', ...(inherited.value ? {} : { thingId: deviceId.value }), id: propertyId.value },
      label: inherited.value ? propertyName : `${device?.name || deviceId.value} / ${propertyName}` })
    resolveSelection = undefined
    cancel()
  }
  onScopeDispose(cancel)
  return { request, open, inherited, canConfirm, devices, selectedDevice, properties, deviceId, propertyId, keyword, scoped, page, total, loading, propertyLoading, error,
    builtins, builtinScope, includeChildren, builtinLoading, ownerBuiltin, hasOwnerBuiltins, historyInput, loadBuiltins, useOwner, statistics,
    category, choosingObject, metricSources, changeCategory, changeObject, confirmMetric, pickSource, search, loadProduct, selectDevice, changeScope, changePage, confirm, cancel }
}
export type MetricSourcePickerState = ReturnType<typeof useMetricSourcePicker>
