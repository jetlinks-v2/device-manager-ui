import { onBeforeUnmount, ref } from 'vue'
import { queryDefaultAlarmLevels, queryDeviceAlarmNotifyMethods } from '../../alarm/api'
import type { AlarmLevelOption, DeviceAlarmNotifyMethod } from '../../alarm/types'

export function useRuleResources() {
  const levels = ref<AlarmLevelOption[]>([])
  const methods = ref<DeviceAlarmNotifyMethod[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const ready = ref(false)
  const levelsLoading = ref(false)
  const levelsFailed = ref(false)
  let levelsLoaded = false
  let generation = 0
  // Ignore late option responses after changing the edited property or leaving the panel.
  function reset() {
    generation++
    levels.value = []
    methods.value = []
    loading.value = failed.value = false
    ready.value = levelsLoading.value = levelsFailed.value = levelsLoaded = false
  }
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
  async function load() {
    if (loading.value || ready.value && !failed.value) return
    const token = generation
    loading.value = true
    failed.value = false
    try {
      const methodList = await queryDeviceAlarmNotifyMethods()
      if (token !== generation) return
      methods.value = methodList
      ready.value = true
    } catch { if (token === generation) failed.value = true }
    finally { if (token === generation) loading.value = false }
  }
  onBeforeUnmount(reset)
  return { levels, methods, loading, levelsLoading, levelsFailed, failed, ready, loadLevels, load, reset }
}
