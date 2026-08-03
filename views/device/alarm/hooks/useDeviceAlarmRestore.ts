import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  queryDeviceAlarmLibraryDetail,
  queryInstalledDeviceAlarmLibraries,
  restoreDeviceLibraryAlarms,
} from '../api'
import type { DeviceAlarmLibraryTemplate, ThingPropertyPreprocess } from '../types'

export function useDeviceAlarmRestore(
  t: (key: string, params?: Record<string, unknown>) => string,
  afterRestore: () => void | Promise<void>,
) {
  const restoreOpen = ref(false)
  const restoreLoading = ref(false)
  const restoreLibraryId = ref('')
  const restoreSelectedRowKeys = ref<string[]>([])
  const restoreClearDeviceConfig = ref(false)
  const restoreLibraries = ref<DeviceAlarmLibraryTemplate[]>([])
  const restoreConfigs = ref<ThingPropertyPreprocess[]>([])

  watch(restoreLibraryId, (libraryId) => {
    restoreSelectedRowKeys.value = []
    void loadRestoreConfigs(libraryId)
  })

  async function openRestore() {
    restoreOpen.value = true
    restoreLibraryId.value = ''
    restoreSelectedRowKeys.value = []
    restoreClearDeviceConfig.value = false
    restoreConfigs.value = []
    restoreLoading.value = true
    try {
      restoreLibraries.value = await queryInstalledDeviceAlarmLibraries().catch(() => [])
    } finally {
      restoreLoading.value = false
    }
  }

  async function loadRestoreConfigs(libraryId: string) {
    if (!libraryId) {
      restoreConfigs.value = []
      return
    }
    const library = restoreLibraries.value.find((item) => item.id === libraryId)
    if (!library) {
      restoreConfigs.value = []
      return
    }
    restoreLoading.value = true
    try {
      const detail = await queryDeviceAlarmLibraryDetail(library)
      const configs = detail?.propertyPreprocessors ?? []
      if (restoreLibraryId.value !== libraryId) return
      restoreConfigs.value = configs
      if (detail) {
        restoreLibraries.value = restoreLibraries.value.map((item) =>
          item.id === library.id ? { ...item, ...detail } : item,
        )
      }
    } catch {
      if (restoreLibraryId.value === libraryId) restoreConfigs.value = []
    } finally {
      restoreLoading.value = false
    }
  }

  async function restoreFromLibrary() {
    if (!restoreLibraryId.value) {
      message.warning(t('DeviceAlarm.restore.validationLibrary'))
      return
    }
    const library = restoreLibraries.value.find((item) => item.id === restoreLibraryId.value)
    if (!library) {
      message.warning(t('DeviceAlarm.restore.validationLibrary'))
      return
    }
    const selected = restoreConfigs.value.filter((item) =>
      restoreSelectedRowKeys.value.includes(String(item.id ?? item.property)),
    )
    if (!selected.length) {
      message.warning(t('DeviceAlarm.restore.validationConfig'))
      return
    }
    await restoreDeviceLibraryAlarms(library, selected, restoreClearDeviceConfig.value)
    message.success(t('DeviceAlarm.restore.success'))
    restoreOpen.value = false
    await afterRestore()
  }

  return {
    restoreOpen,
    restoreLoading,
    restoreLibraryId,
    restoreSelectedRowKeys,
    restoreClearDeviceConfig,
    restoreLibraries,
    restoreConfigs,
    openRestore,
    restoreFromLibrary,
  }
}
