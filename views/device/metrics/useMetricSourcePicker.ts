import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { queryMetricDevices, loadMetricDevice } from '../../../api/metricSources'
import type { MetricSourcePicker, MetricSourceSelection } from '@jetlinks-web-core/components'
import type { MetricDeviceOption, MetricPropertyOption } from './metricSources'

/** 一个宿主只有一个待完成选择；切换对象或卸载时取消，不将旧来源写入新配置。 */
export function useMetricSourcePicker() {
  const request = shallowRef<Parameters<MetricSourcePicker>[0]>()
  const devices = ref<MetricDeviceOption[]>([])
  const selectedDevice = ref<MetricDeviceOption>()
  const properties = ref<MetricPropertyOption[]>([])
  const deviceId = ref('')
  const propertyId = ref('')
  const keyword = ref('')
  const scoped = ref(true)
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const propertyLoading = ref(false)
  const queryError = ref(false)
  const propertyError = ref(false)
  const error = computed(() => queryError.value || propertyError.value)
  let queryVersion = 0
  let propertyVersion = 0
  let resolveSelection: ((selection?: MetricSourceSelection) => void) | undefined
  const open = computed(() => Boolean(request.value))
  const canConfirm = computed(() => Boolean(deviceId.value && propertyId.value && !propertyLoading.value && !error.value
    && (propertyId.value === '$online' || properties.value.some(property => property.id === propertyId.value))))

  function cancel() {
    queryVersion += 1
    propertyVersion += 1
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
    deviceId.value = next.mapping?.thingId || ''
    propertyId.value = next.mapping?.id || ''
    keyword.value = ''
    scoped.value = true
    page.value = 1
    queryError.value = false
    propertyError.value = false
    const pending = new Promise<MetricSourceSelection | undefined>(resolve => { resolveSelection = resolve })
    void search()
    if (deviceId.value) void selectDevice(deviceId.value, true)
    return pending
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
    } catch { if (version === propertyVersion) propertyError.value = true }
    finally { if (version === propertyVersion) propertyLoading.value = false }
  }
  function changeScope(value: boolean) { scoped.value = value; page.value = 1; void search() }
  function changePage(value: number) { page.value = value; void search() }
  function confirm() {
    if (!canConfirm.value) return
    const device = devices.value.find(item => item.id === deviceId.value)
    const property = properties.value.find(item => item.id === propertyId.value)
    if (propertyId.value !== '$online' && !property) return
    resolveSelection?.({ mapping: { kind: 'property', thingType: 'device', thingId: deviceId.value, id: propertyId.value }, label: `${device?.name || deviceId.value} / ${property?.name || propertyId.value}` })
    resolveSelection = undefined
    cancel()
  }
  onScopeDispose(cancel)
  return { request, open, canConfirm, devices, properties, deviceId, propertyId, keyword, scoped, page, total, loading, propertyLoading, error, pickSource, search, selectDevice, changeScope, changePage, confirm, cancel }
}
export type MetricSourcePickerState = ReturnType<typeof useMetricSourcePicker>
