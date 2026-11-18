import { computed, onScopeDispose, ref, watch } from 'vue'
import { useInstanceStore } from '../../../../../store/instance'
import { detail as queryPluginAccessDetail } from '../../../../../api/link/accessConfig'
import { getPluginData } from '../../../../../api/link/plugin'

export interface DeviceIdMappingTarget {
  id: string
  accessId?: string
  accessProvider?: string
}

export interface DeviceIdMappingProps {
  device?: DeviceIdMappingTarget
  canUpdate?: boolean
}

/** 新旧详情共用插件 ID 映射；新详情显式传入设备，旧入口沿用实例 store。 */
export function useDeviceIdMapping(props: DeviceIdMappingProps, saved: (deviceId: string) => void) {
  const instanceStore = useInstanceStore()
  const target = computed(() => props.device ?? instanceStore.current)
  const isPluginGateway = computed(() => target.value?.accessProvider === 'plugin_gateway')
  const inkingVisible = ref(false)
  const inklingDeviceId = ref<string>()
  const channelId = ref<string>()
  const loading = ref(false)
  const loadFailed = ref(false)
  let version = 0
  let disposed = false
  const targetKey = () => JSON.stringify([target.value?.id, target.value?.accessId, target.value?.accessProvider])
  const canUpdate = () => props.canUpdate !== false

  async function queryInkling() {
    const requestVersion = ++version
    const key = targetKey()
    const current = { ...target.value }
    const isCurrent = () => !disposed && requestVersion === version && key === targetKey()
    inklingDeviceId.value = undefined
    channelId.value = undefined
    loadFailed.value = false
    loading.value = false
    if (!isPluginGateway.value || !current.id || !current.accessId) return false
    loading.value = true
    try {
      const [access, mapping] = await Promise.all([
        queryPluginAccessDetail(current.accessId),
        getPluginData('device', current.accessId, current.id),
      ])
      if (!isCurrent()) return false
      if (!access.success || !mapping.success || !access.result?.channelId) throw new Error('Failed to load device ID mapping')
      channelId.value = access.result.channelId
      inklingDeviceId.value = mapping.result?.externalId
      return true
    } catch {
      if (isCurrent()) loadFailed.value = true
      return false
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  async function openInklingModal() {
    if (!canUpdate() || loading.value || !isPluginGateway.value) return
    const key = targetKey()
    if (!await queryInkling()) return
    if (!disposed && key === targetKey() && canUpdate()) inkingVisible.value = true
  }

  async function saveInkling() {
    const current = { ...target.value }
    const key = targetKey()
    inkingVisible.value = false
    if (!current.id || disposed) return
    // 新详情由宿主刷新，避免旧 store 的异步刷新覆盖另一台设备。
    if (!props.device) await instanceStore.refresh(current.id)
    if (disposed || key !== targetKey()) return
    saved(current.id)
    await queryInkling()
  }

  watch(targetKey, () => {
    inkingVisible.value = false
    void queryInkling()
  }, { immediate: true })
  onScopeDispose(() => { disposed = true; version += 1 })

  return { target, isPluginGateway, inkingVisible, inklingDeviceId, channelId, loading, loadFailed, openInklingModal, saveInkling }
}
