import { ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import type { ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'

import {
  bindDeviceGroupDevices_api,
  queryRuntimeDevices_api,
  unbindDeviceGroupDevices_api,
  type DeviceGroupDevicePageResult,
} from '@device-manager-ui/api/deviceGroup'
import {
  bindDevicesToSpaceArea_api,
  queryDeviceSpaceAreaBindings_api,
  unbindDevicesFromSpaceArea_api,
} from '@device-manager-ui/api/spaceArea'

import type { GroupItem } from './iotDeviceGroupsPage.types'
import type { IotDevice } from '@device-manager-ui/types'
import {
  normalizeRuntimeDeviceQueryTerms,
} from './iotDeviceGroupsPage.utils'

const $t = i18n.global.t

export interface TypeGroupDeviceBindingOptions {
  refreshGroup: (groupId: string) => Promise<void>
  refreshList: () => void
  getAreaBindExcludeIds?: () => string[]
}

export function useIotTypeGroupDeviceBinding(options: TypeGroupDeviceBindingOptions) {
  const bindDeviceModalOpen = ref(false)
  const bindDeviceSaving = ref(false)
  const bindDeviceError = ref('')
  const bindDeviceGroup = ref<GroupItem | null>(null)
  const bindDeviceFilterTerms = ref<ConditionFilterTerm[]>([])
  const bindDeviceSearchTriggerKey = ref(0)

  function openBindDeviceModal(group: GroupItem) {
    if (!isBindableGroup(group)) return
    bindDeviceGroup.value = group
    bindDeviceFilterTerms.value = []
    bindDeviceError.value = ''
    bindDeviceModalOpen.value = true
  }

  async function queryBindableDevices(params: { pageIndex?: number; pageSize?: number }): Promise<{ success: boolean; result: DeviceGroupDevicePageResult }> {
    const result = await queryRuntimeDevices_api({
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      withAlarmInfo: false,
      terms: [
        ...normalizeRuntimeDeviceQueryTerms(bindDeviceFilterTerms.value),
        ...buildExcludeBoundTerms(),
      ],
    })

    return { success: true, result }
  }

  async function handleBindDevices(devices: Array<Pick<IotDevice, 'id' | 'name' | 'productName' | 'status'>>) {
    const group = bindDeviceGroup.value
    const deviceIds = devices.map((device) => device.id).filter(Boolean)
    if (!group || !deviceIds.length) return
    bindDeviceSaving.value = true
    bindDeviceError.value = ''
    try {
      if (group.view === 'area') {
        await bindDevicesToSpaceArea_api(group.sourceId, devices.map((device) => ({
          id: device.id,
          name: device.name,
          productName: device.productName,
          state: device.status,
        })))
      } else {
        await bindDeviceGroupDevices_api(group.sourceId, deviceIds)
      }
      await options.refreshGroup(group.sourceId)
      options.refreshList()
      bindDeviceModalOpen.value = false
    } catch (error) {
      bindDeviceError.value = error instanceof Error ? error.message : $t('IotDeviceGroups.error.bindDevice')
    } finally {
      bindDeviceSaving.value = false
    }
  }

  async function handleUnbindDevice(group: GroupItem, device: Pick<IotDevice, 'id' | 'name' | 'areaId'> | string) {
    const deviceId = typeof device === 'string' ? device : device.id
    if (!isBindableGroup(group) || !deviceId) return
    if (group.view === 'area') {
      const spaceId = await resolveDeviceBoundSpaceId(group, device)
      if (!spaceId) return
      await unbindDevicesFromSpaceArea_api(spaceId, [deviceId])
    } else {
      await unbindDeviceGroupDevices_api(group.sourceId, [deviceId])
    }
    await options.refreshGroup(group.sourceId)
    options.refreshList()
  }

  function handleBindDeviceFilterSearch(terms: ConditionFilterTerm[]) {
    bindDeviceFilterTerms.value = terms
    bindDeviceSearchTriggerKey.value += 1
  }

  function buildExcludeBoundTerms() {
    const group = bindDeviceGroup.value
    if (!group) return []
    if (group.view !== 'area') return [{ column: 'id', termType: 'dev-group$not', value: group.sourceId }]

    const areaIds = [...new Set([
      ...(options.getAreaBindExcludeIds?.() ?? []),
      ...(group.areaScopeIds ?? []),
      group.sourceId,
    ].filter(Boolean))]
    // 区域绑定为单设备单区域，候选设备需要排除已绑定到任意区域的设备。
    return areaIds.length
      ? [{ column: 'id', termType: 'space-bind$not$device', value: areaIds }]
      : []
  }

  async function resolveDeviceBoundSpaceId(group: GroupItem, device: Pick<IotDevice, 'id' | 'areaId'> | string) {
    const deviceId = typeof device === 'string' ? device : device.id
    const areaScopeIds = new Set(group.areaScopeIds?.filter(Boolean) ?? [group.sourceId])
    const deviceAreaId = typeof device === 'string' ? '' : device.areaId
    if (deviceAreaId && areaScopeIds.has(deviceAreaId)) return deviceAreaId

    const bindings = await queryDeviceSpaceAreaBindings_api([deviceId])
    return bindings.find((item) => areaScopeIds.has(item.areaId))?.areaId
  }

  function isBindableGroup(group: GroupItem) {
    if (group.view === 'type') return !group.isVirtual
    return group.view === 'area' && Boolean(group.area)
  }

  return {
    bindDeviceError,
    bindDeviceGroup,
    bindDeviceModalOpen,
    bindDeviceSaving,
    bindDeviceSearchTriggerKey,
    handleBindDeviceFilterSearch,
    handleBindDevices,
    handleUnbindDevice,
    openBindDeviceModal,
    queryBindableDevices,
  }
}
