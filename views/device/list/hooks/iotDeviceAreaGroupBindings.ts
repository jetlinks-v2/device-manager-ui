import {
  bindDeviceGroupDevices_api,
  unbindDeviceGroupDevices_api,
} from '@device-manager-ui/api/deviceGroup'
import {
  bindDeviceToSpaceArea_api,
  unbindDevicesFromSpaceArea_api,
} from '@device-manager-ui/api/spaceArea'

type SaveIotDeviceAreaGroupBindingsInput = {
  deviceId: string
  deviceName: string
  productName?: string
  state?: string
  areaId?: string
  previousAreaId?: string
  groupId?: string
  previousGroupId?: string
  groupIds?: string[]
  previousGroupIds?: string[]
}

export async function saveIotDeviceAreaGroupBindings(input: SaveIotDeviceAreaGroupBindingsInput) {
  const tasks: Promise<unknown>[] = []
  const previousAreaId = input.previousAreaId
  const areaChanged = previousAreaId !== undefined && previousAreaId !== input.areaId
  const previousGroupIds = uniqueIds(input.previousGroupIds ?? (input.previousGroupId ? [input.previousGroupId] : []))
  const groupIds = uniqueIds(input.groupIds ?? (input.groupId ? [input.groupId] : []))

  // 区域绑定接口不支持重复绑定；编辑时只有区域变更才先解绑旧区域再绑定新区域。
  if (areaChanged && previousAreaId) {
    await unbindDevicesFromSpaceArea_api(previousAreaId, [input.deviceId])
  }

  if ((areaChanged || previousAreaId === undefined) && input.areaId) {
    await bindDeviceToSpaceArea_api(input.areaId, {
      id: input.deviceId,
      name: input.deviceName,
      productName: input.productName,
      state: input.state,
    })
  }

  for (const groupId of previousGroupIds.filter((id) => !groupIds.includes(id))) {
    tasks.push(unbindDeviceGroupDevices_api(groupId, [input.deviceId]))
  }

  for (const groupId of groupIds.filter((id) => !previousGroupIds.includes(id))) {
    tasks.push(bindDeviceGroupDevices_api(groupId, [input.deviceId]))
  }

  await Promise.all(tasks)
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))]
}
