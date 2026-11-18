import { computed, ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { detail } from '@device-manager-ui/api/instance'
import { buildIotDeviceDetailPath, resolveIotProjectId } from './useIotDeviceRouting'
import type { IotDevice } from '../types'

/** 父设备名称独立回填；切换设备、重新绑定和卸载时丢弃旧查询。 */
export function useIotDeviceParentLink(device: Ref<IotDevice | null>) {
  const route = useRoute()
  const router = useRouter()
  const resolvedName = ref('')
  const parentDeviceId = computed(() => device.value?.deviceTypeValue === 'childrenDevice' ? device.value.parentId : undefined)
  const parentDeviceName = computed(() => device.value?.parentName || resolvedName.value || parentDeviceId.value || '')

  watch([() => device.value?.id, parentDeviceId, () => device.value?.parentName], async ([, parentId, name], _, onCleanup) => {
    resolvedName.value = ''
    if (!parentId || name) return
    let active = true
    onCleanup(() => { active = false })
    try {
      const response = await detail(parentId, true)
      if (active && response.result?.id === parentId) resolvedName.value = response.result.name || ''
    } catch {
      // 名称不可读时保留父设备 ID，不影响子设备详情加载。
    }
  }, { immediate: true })

  function openParentDevice() {
    if (!parentDeviceId.value) return
    void router.push(buildIotDeviceDetailPath(resolveIotProjectId(route), parentDeviceId.value, { tab: 'overview' }, route))
  }

  return { parentDeviceId, parentDeviceName, openParentDevice }
}
