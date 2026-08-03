import { request } from '@jetlinks-web/core'

import type {
  ProjectArea,
  ProjectAreaPlanMode,
  ProjectAreaSettings,
  ProjectAreaType,
} from '@device-manager-ui/modules/defaults/types'

type ApiResponse<T> = {
  result?: T
}

type SpaceAreaResponse = {
  id?: string
  parentId?: string
  children?: SpaceAreaResponse[]
  spaceTypeId?: string
  levelNo?: number
  level?: number
  path?: string
  name?: string
  code?: string
  aliases?: string[]
  aliasesJson?: string
  sortOrder?: number
  sortIndex?: number
  planMode?: string
  description?: string
  canBindAsset?: boolean | string
}

type SpaceTypeResponse = {
  id?: string
  children?: SpaceTypeResponse[]
  others?: Record<string, unknown>
}

type SpaceDataBindResponse = {
  id?: string
  spaceId?: string
  deviceId?: string
  extensions?: {
    assetType?: string
    name?: string
    deviceId?: string
    deviceName?: string
    spaceName?: string
    [key: string]: unknown
  }
  createTime?: number
  modifyTime?: number
}

export type DeviceSpaceAreaBinding = {
  deviceId: string
  areaId: string
  area?: string
}

const unwrapList = <T>(response: ApiResponse<T[]> | T[] | undefined | null): T[] => {
  if (Array.isArray(response)) return response
  const result = response?.result
  return Array.isArray(result) ? result : []
}

const flattenAreas = (areas: SpaceAreaResponse[]): SpaceAreaResponse[] =>
  areas.flatMap((item) => [item, ...flattenAreas(item.children || [])])

const flattenSpaceTypes = (types: SpaceTypeResponse[]): SpaceTypeResponse[] =>
  types.flatMap((item) => [item, ...flattenSpaceTypes(item.children || [])])

const readCapability = (value: unknown): boolean | undefined => {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return undefined
}

const getBindingDeviceId = (item: SpaceDataBindResponse) =>
  String(item.deviceId || item.extensions?.deviceId || '')

const readAliases = (item: SpaceAreaResponse): string[] => {
  if (Array.isArray(item.aliases)) return item.aliases.map(String)
  if (!item.aliasesJson) return []
  try {
    const aliases = JSON.parse(item.aliasesJson)
    return Array.isArray(aliases) ? aliases.map(String) : []
  } catch {
    return []
  }
}

const resolveAreaLevel = (item: SpaceAreaResponse) => {
  if (item.levelNo) return item.levelNo
  if (item.level) return item.level
  if (item.path) return item.path.split('-').filter(Boolean).length
  return 1
}

const toAreaType = (level: number): ProjectAreaType => {
  if (level <= 1) return 'site'
  if (level === 2) return 'building'
  if (level === 3) return 'floor'
  if (level === 4) return 'zone'
  if (level === 5) return 'room'
  return 'point'
}

const toPlanMode = (value?: string): ProjectAreaPlanMode => (value === 'own' ? 'own' : 'inherit')

const toProjectArea = (
  projectId: string,
  item: SpaceAreaResponse,
  canBindAsset?: boolean,
): ProjectArea => {
  const level = resolveAreaLevel(item)

  return {
    id: String(item.id || ''),
    projectId,
    parentId: item.parentId || undefined,
    name: item.name || item.code || item.id || '--',
    type: toAreaType(level),
    canBindAsset,
    code: item.code || item.id || '',
    aliases: readAliases(item),
    sortOrder: Number(item.sortOrder ?? item.sortIndex ?? 0),
    description: item.description || '',
    planMode: item.parentId ? toPlanMode(item.planMode) : 'own',
  }
}

const toProjectAreaSettings = (projectId: string, areas: ProjectArea[]): ProjectAreaSettings => ({
  projectId,
  rootAreaId: areas.find((item) => !item.parentId)?.id || areas[0]?.id || '',
  areas,
  floorPlans: [],
  geometries: [],
  whiteModelJobs: [],
  whiteModelCandidates: [],
})

export const queryProjectSpaceAreaSettings_api = async (projectId: string): Promise<ProjectAreaSettings> => {
  const [areaResponse, spaceTypeResponse] = await Promise.all([
    request.post('/space/_query/tree', {
      paging: false,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    }) as Promise<ApiResponse<SpaceAreaResponse[]>>,
    (request.post('/space/type/_query/no-paging', {
      paging: false,
    }) as Promise<ApiResponse<SpaceTypeResponse[]>>).catch(() => undefined),
  ])
  const capabilityBySpaceTypeId = new Map(
    flattenSpaceTypes(unwrapList(spaceTypeResponse))
      .filter((item) => Boolean(item.id))
      .map((item) => [String(item.id), readCapability(item.others?.canBindAsset)]),
  )
  const areas = flattenAreas(unwrapList(areaResponse))
    .map((item) => toProjectArea(
      projectId,
      item,
      readCapability(item.canBindAsset) ?? capabilityBySpaceTypeId.get(String(item.spaceTypeId || '')),
    ))
    .filter((item) => Boolean(item.id))

  return toProjectAreaSettings(projectId, areas)
}

export const querySpaceAreasByIds_api = async (projectId: string, areaIds: string[]): Promise<ProjectArea[]> => {
  const ids = [...new Set(areaIds.filter(Boolean))]
  if (!ids.length) return []

  const response = await request.post('/space/_query/no-paging', {
    paging: false,
    terms: [{
      column: 'id',
      termType: 'in',
      value: ids,
    }],
  }) as ApiResponse<SpaceAreaResponse[]>

  return unwrapList(response)
    .map((item) => toProjectArea(projectId, item))
    .filter((item) => Boolean(item.id))
}

export const bindDeviceToSpaceArea_api = async (
  spaceId: string,
  device: { id: string; name?: string; productName?: string; state?: string },
): Promise<void> => {
  await bindDevicesToSpaceArea_api(spaceId, [device])
}

export const bindDevicesToSpaceArea_api = async (
  spaceId: string,
  devices: Array<{ id: string; name?: string; productName?: string; state?: string }>,
): Promise<void> => {
  const rows = devices
    .filter((device) => Boolean(device.id))
    .map((device) => ({
      spaceId,
      deviceId: device.id,
      extensions: {
        assetType: 'DEVICE',
        deviceId: device.id,
        deviceName: device.name || device.id,
        name: device.name || device.id,
        productName: device.productName || '',
        state: device.state || '',
        stateText: device.state || '',
        source: 'iot-device-group',
      },
    }))
  if (!spaceId || !rows.length) return
  await request.post('/space/data-bind/_batch', rows)
}

export const unbindDevicesFromSpaceArea_api = async (
  spaceId: string,
  deviceIds: string[],
): Promise<void> => {
  const ids = [...new Set(deviceIds.filter(Boolean))]
  if (!spaceId || !ids.length) return

  const response = await request.post('/space/data-bind/_query/no-paging', {
    paging: false,
    terms: [
      { column: 'spaceId', termType: 'eq', value: spaceId },
      { column: 'deviceId', termType: 'in', value: ids },
    ],
  }) as ApiResponse<SpaceDataBindResponse[]>
  const bindIds = unwrapList(response)
    .filter((item) => String(item.extensions?.assetType || 'DEVICE').toUpperCase() === 'DEVICE')
    .map((item) => String(item.id || ''))
    .filter(Boolean)

  await Promise.all(bindIds.map((bindId) => request.remove(`/space/data-bind/${bindId}`)))
}

export const queryDeviceSpaceAreaBindings_api = async (
  deviceIds: string[],
  projectId = '',
): Promise<DeviceSpaceAreaBinding[]> => {
  const ids = [...new Set(deviceIds.filter(Boolean))]
  if (!ids.length) return []

  const response = await request.post('/space/data-bind/_query/no-paging', {
    paging: false,
    sorts: [{ name: 'modifyTime', order: 'desc' }],
    terms: [
      { column: 'deviceId', termType: 'in', value: ids },
    ],
  }) as ApiResponse<SpaceDataBindResponse[]>

  const bindings: DeviceSpaceAreaBinding[] = []
  const seenBindings = new Set<string>()
  for (const item of unwrapList(response)) {
    const deviceId = getBindingDeviceId(item)
    const areaId = String(item.spaceId || '')
    const key = `${deviceId}:${areaId}`
    if (!ids.includes(deviceId) || !areaId || seenBindings.has(key)) continue
    if (String(item.extensions?.assetType || 'DEVICE').toUpperCase() !== 'DEVICE') continue
    seenBindings.add(key)
    bindings.push({
      deviceId,
      areaId,
      area: typeof item.extensions?.spaceName === 'string' ? item.extensions.spaceName : undefined,
    })
  }

  const missingAreaNames = [...new Set(bindings
    .filter((item) => !item.area)
    .map((item) => item.areaId))]

  if (missingAreaNames.length) {
    const areaMap = new Map((await querySpaceAreasByIds_api(projectId, missingAreaNames)).map((item) => [item.id, item.name]))
    for (const binding of bindings) {
      if (!binding.area) binding.area = areaMap.get(binding.areaId) || binding.areaId
    }
  }

  return bindings
}

export const querySpaceAreaDeviceIds_api = async (areaIds: string[]): Promise<string[]> => {
  const bindings = await querySpaceAreaDeviceBindings_api(areaIds)
  return [...new Set(bindings.map((item) => item.deviceId).filter(Boolean))]
}

export const querySpaceAreaDeviceBindings_api = async (
  areaIds: string[],
): Promise<DeviceSpaceAreaBinding[]> => {
  const ids = [...new Set(areaIds.map(String).filter(Boolean))]
  if (!ids.length) return []

  const response = await request.post('/space/data-bind/_query/no-paging', {
    paging: false,
    terms: [{ column: 'spaceId', termType: 'in', value: ids }],
  }) as ApiResponse<SpaceDataBindResponse[]>

  const bindings: DeviceSpaceAreaBinding[] = []
  const seenBindings = new Set<string>()
  for (const item of unwrapList(response)) {
    const deviceId = getBindingDeviceId(item)
    const areaId = String(item.spaceId || '')
    const key = `${deviceId}:${areaId}`
    if (!deviceId || !areaId || seenBindings.has(key)) continue
    if (String(item.extensions?.assetType || 'DEVICE').toUpperCase() !== 'DEVICE') continue
    seenBindings.add(key)
    bindings.push({
      deviceId,
      areaId,
      area: typeof item.extensions?.spaceName === 'string' ? item.extensions.spaceName : undefined,
    })
  }

  return bindings
}

export const queryDeviceSpaceAreaBinding_api = async (deviceId: string): Promise<{ areaId: string; area?: string } | null> => {
  if (!deviceId) return null
  return (await queryDeviceSpaceAreaBindings_api([deviceId]))[0] ?? null
}
