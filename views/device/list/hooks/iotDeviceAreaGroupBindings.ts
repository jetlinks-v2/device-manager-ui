import {
  bindDeviceGroupDevices_api,
  unbindDeviceGroupDevices_api,
} from '@device-manager-ui/api/deviceGroup'
import {
  bindDevicesToSpaceArea_api,
  bindDeviceToSpaceArea_api,
  queryDeviceSpaceAreaBindings_api,
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

type IotDeviceAreaBindingInput = {
  id: string
  name?: string
  productName?: string
  state?: string
}

export async function reassignIotDevicesToArea(areaId: string, devices: IotDeviceAreaBindingInput[]) {
  if (!areaId) return

  const devicesById = new Map<string, IotDeviceAreaBindingInput>()
  for (const device of devices) {
    if (device.id) devicesById.set(device.id, device)
  }
  if (!devicesById.size) return

  const bindings = await queryDeviceSpaceAreaBindings_api([...devicesById.keys()])
  const targetBoundDeviceIds = new Set<string>()
  const deviceIdsByPreviousArea = new Map<string, string[]>()

  for (const binding of bindings) {
    if (binding.areaId === areaId) {
      targetBoundDeviceIds.add(binding.deviceId)
      continue
    }
    const deviceIds = deviceIdsByPreviousArea.get(binding.areaId) || []
    deviceIds.push(binding.deviceId)
    deviceIdsByPreviousArea.set(binding.areaId, deviceIds)
  }

  // 一个设备只能保留一个区域绑定；先按原区域解绑，再批量写入目标区域，避免重复绑定校验失败。
  await Promise.all([...deviceIdsByPreviousArea.entries()].map(([previousAreaId, deviceIds]) =>
    unbindDevicesFromSpaceArea_api(previousAreaId, uniqueIds(deviceIds)),
  ))

  const devicesToBind = [...devicesById.values()]
    .filter((device) => !targetBoundDeviceIds.has(device.id))
  await bindDevicesToSpaceArea_api(areaId, devicesToBind)
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
