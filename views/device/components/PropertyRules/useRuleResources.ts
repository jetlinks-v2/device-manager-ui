import { onBeforeUnmount, provide, ref, watch } from 'vue'
import { queryDefaultAlarmLevels, queryDeviceAlarmNotifyMethods } from '../../alarm/api'
import type { AlarmLevelOption, DeviceAlarmNotifyMethod } from '../../alarm/types'
import { alarmRecipientCacheKey, createAlarmRecipientCache } from '../../alarm/hooks/alarmRecipientCache'

export function useRuleResources(scope?: () => unknown) {
  const recipients = createAlarmRecipientCache()
  provide(alarmRecipientCacheKey, recipients)
  const levels = ref<AlarmLevelOption[]>([])
  const methods = ref<DeviceAlarmNotifyMethod[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const ready = ref(false)
  const levelsLoading = ref(false)
  const levelsFailed = ref(false)
  let levelsLoaded = false
  let generation = 0
  // Keep resources across properties; only the owning device/product/auth context invalidates them.
  function reset() {
    generation++
    recipients.reset()
    levels.value = []
    methods.value = []
    loading.value = failed.value = false
    ready.value = levelsLoading.value = levelsFailed.value = levelsLoaded = false
  }
  // Compare a value snapshot: equivalent owner objects must not clear options, while nested auth changes must.
  if (scope) watch(() => JSON.stringify(scope()), () => {
    const wasRequested = ready.value || loading.value
    reset()
    if (wasRequested) void load()
  }, { flush: 'sync' })
  async function loadLevels() {
    if (levelsLoaded || levelsLoading.value) return
    const token = generation
    levelsLoading.value = true
    levelsFailed.value = false
    try {
      const result = await queryDefaultAlarmLevels()
      if (token === generation) { levels.value = result; levelsLoaded = true }
    } catch { if (token === generation) levelsFailed.value = true }
    finally { if (token === generation) levelsLoading.value = false }
  }
  async function load(force = false) {
    if (loading.value || ready.value && !force) return
    const token = generation
    loading.value = true
    failed.value = false
    try {
      const methodList = await queryDeviceAlarmNotifyMethods()
      if (token !== generation) return
      methods.value = methodList
      failed.value = methodList.some(method => method.templates?.trigger === 'unknown' || method.templates?.relieve === 'unknown')
    } catch { if (token === generation) failed.value = true }
    finally {
      if (token === generation) {
        // Cache settled failures too; ordinary display/popover events only ensure, never retry.
        ready.value = true
        loading.value = false
      }
    }
  }
  function retry() { return load(true) }
  onBeforeUnmount(reset)
  return { levels, methods, loading, levelsLoading, levelsFailed, failed, ready, loadLevels, load, retry, reset }
}
