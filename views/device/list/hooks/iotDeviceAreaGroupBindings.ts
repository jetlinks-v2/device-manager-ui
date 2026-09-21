import {
  bindDeviceGroupDevices_api,
  unbindDeviceGroupDevices_api,
} from '@device-manager-ui/api/deviceGroup'
import {
  bindDevicesSpaceArea_api,
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

type IotDeviceAreaBindingInput = {
  id: string
  name?: string
  productName?: string
  state?: string
}

export async function reassignIotDevicesToArea(areaId: string, devices: IotDeviceAreaBindingInput[]) {
  if (!areaId) return

  const deviceIds = uniqueIds(devices.map((device) => device.id))
  if (!deviceIds.length) return

  // 由设备视角接口原子完成首次绑定或换绑，不再读取、解绑不可见的旧空间。
  await bindDevicesSpaceArea_api(areaId, deviceIds)
}

export async function saveIotDeviceAreaGroupBindings(input: SaveIotDeviceAreaGroupBindingsInput) {
  const tasks: Promise<unknown>[] = []
  const previousAreaId = input.previousAreaId
  const areaChanged = previousAreaId !== undefined && previousAreaId !== input.areaId
  const previousGroupIds = uniqueIds(input.previousGroupIds ?? (input.previousGroupId ? [input.previousGroupId] : []))
  const groupIds = uniqueIds(input.groupIds ?? (input.groupId ? [input.groupId] : []))

  if ((areaChanged || previousAreaId === undefined) && input.areaId) {
    await bindDevicesSpaceArea_api(input.areaId, [input.deviceId])
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
