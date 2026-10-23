import { computed, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { createDeviceDetailContext, useDeviceDetailContext } from './context'
import { settingsOf, type DeviceDetailInfo, type DeviceDetailKind, type OverviewSummary, type RecentAlarmRecord } from '../shared'
import { loadSummary } from '../services/summary'
import { loadAlarms } from '../services/alarms'
import { loadProperties, mergeProperty, subscribeDeviceProperties, type PropertySnapshot } from '../services/properties'
import { previewSummary, previewProperties, previewAlarms } from '../services/preview'

type Data = OverviewSummary | RecentAlarmRecord[] | PropertySnapshot

/** 同一宿主按设备和数据源复用请求；切换设备、停用或卸载立即解除旧消费者。 */
export function useDeviceDetailWidget(kind: DeviceDetailKind, info: Readonly<Ref<DeviceDetailInfo | undefined>>, isEdit: Readonly<Ref<boolean>>) {
  const config = computed(() => settingsOf(kind, info.value))
  const host = useDeviceDetailContext()
  const context = host ?? createDeviceDetailContext(computed(() => config.value.deviceId))
  const deviceId = computed(() => host ? host.deviceId.value : config.value.deviceId)
  const active = ref(true), data = shallowRef<Data>(), loading = ref(false), error = ref(false)
  const key = computed(() => JSON.stringify([context.scope.value, deviceId.value,
    kind === 'RecentAlarms' ? ['alarms', config.value.limit] : kind === 'Properties' ? 'properties' : 'summary']))
  const summary = computed(() => data.value as OverviewSummary | undefined)
  const alarms = computed(() => kind === 'RecentAlarms' ? data.value as RecentAlarmRecord[] ?? [] : [])
  const properties = computed(() => {
    if (kind !== 'Properties') return []
    if (isEdit.value) return previewProperties()
    if (host?.properties) return host.properties.value.filter(item => item.focused)
    return (data.value as PropertySnapshot | undefined)?.rows ?? []
  })
  let stop = () => {}, stopRealtime = () => {}, epoch = 0
  watch([key, () => config.value.refreshSeconds, isEdit, active], () => {
    stop(); stopRealtime(); ++epoch
    data.value = undefined; error.value = false; loading.value = false
    if (!active.value) return
    if (isEdit.value) {
      data.value = kind === 'Properties' ? { productId: '', rows: previewProperties() }
        : kind === 'RecentAlarms' ? previewAlarms() : previewSummary()
      return
    }
    if (!deviceId.value || (kind === 'Properties' && host?.properties)) return
    const version = epoch, id = deviceId.value, limit = config.value.limit
    const load = kind === 'Properties' ? () => loadProperties(id)
      : kind === 'RecentAlarms' ? () => loadAlarms(id, limit) : () => loadSummary(id)
    stop = context.pool.subscribe<Data>(key.value, config.value.refreshSeconds, load, result => {
      if (version !== epoch) return
      data.value = result.data; error.value = result.error; loading.value = result.loading
    })
  }, { immediate: true, flush: 'sync' })
  // 独立属性组件拥有自己的订阅；设备详情继续复用宿主已有的实时属性流。
  watch(() => {
    const snapshot = data.value as PropertySnapshot | undefined
    return kind === 'Properties' && !host?.properties && !isEdit.value && active.value && snapshot
      ? JSON.stringify([deviceId.value, snapshot.productId, snapshot.rows.map(item => item.id)]) : ''
  }, signature => {
    stopRealtime(); stopRealtime = () => {}
    const snapshot = data.value as PropertySnapshot | undefined
    if (!signature || !snapshot?.rows.length) return
    const version = epoch
    const subscription = subscribeDeviceProperties(deviceId.value, snapshot.productId, snapshot.rows.map(item => item.id), value => {
      if (version !== epoch) return
      const current = data.value as PropertySnapshot | undefined
      if (!current) return
      const next = current.rows.map(item => ({ ...item }))
      mergeProperty(next, value)
      data.value = { ...current, rows: next }
    })
    stopRealtime = () => subscription?.unsubscribe()
  })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false })
  onScopeDispose(() => { ++epoch; stop(); stopRealtime() })
  const retry = () => context.pool.refresh(key.value)
  return { config, deviceId, identity: key, summary, alarms, properties, loading, error, retry }
}
