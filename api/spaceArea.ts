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

type SpaceDataBindInfoResponse = {
  assetId?: string
  spaceId?: string
  spaceName?: string
}

export type DeviceSpaceAreaBinding = {
  deviceId: string
  areaId: string
  area?: string
}

const DEVICE_SPACE_AREA_SERVICE_ID = 'spaceService:space-bind'
export type DeviceSpaceAreaSupport = boolean | undefined
let deviceSpaceAreaSupportPromise: Promise<DeviceSpaceAreaSupport> | undefined

const unwrapList = <T>(response: ApiResponse<T[]> | T[] | undefined | null): T[] => {
  if (Array.isArray(response)) return response
  const result = response?.result
  return Array.isArray(result) ? result : []
}

// 命令服务探测在不同请求适配层下可能返回裸值或标准 { result } 响应体。
const unwrapResult = <T>(response: ApiResponse<T> | T): T => (
  response && typeof response === 'object' && 'result' in response
    ? (response as ApiResponse<T>).result as T
    : response as T
)

const normalizeIds = (ids: string[]) => [...new Set(ids.map(String).filter(Boolean))]

const toBusinessError = (error: unknown): Error => {
  const source = error as { message?: unknown; response?: { data?: { message?: unknown } }; data?: { message?: unknown } }
  const message = [source?.response?.data?.message, source?.data?.message]
    .find((item): item is string => typeof item === 'string' && item.trim())
    ?.trim()
  if (error instanceof Error && message) {
    error.message = message
    return error
  }
  return new Error(message || (error instanceof Error ? error.message : ''))
}

/**
 * 探测设备区域关联服务。
 *
 * 明确返回 false 才表示未装配空间服务；网络或网关异常保持 unknown，不能被缓存为“不支持”。
 */
export const existsDeviceSpaceAreaSupport_api = (): Promise<DeviceSpaceAreaSupport> => {
  if (!deviceSpaceAreaSupportPromise) {
    deviceSpaceAreaSupportPromise = request
      .get<ApiResponse<boolean> | boolean>(
        `/command-supports/service/${DEVICE_SPACE_AREA_SERVICE_ID}/exists`,
        {},
        { hiddenError: true },
      )
      .then((response) => unwrapResult<boolean>(response) === true)
      .catch(() => {
        // 探测失败不代表模块不存在，释放缓存以便后续页面或用户操作重试。
        deviceSpaceAreaSupportPromise = undefined
        return undefined
      })
  }
  return deviceSpaceAreaSupportPromise
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
  if (await existsDeviceSpaceAreaSupport_api() !== true) return toProjectAreaSettings(projectId, [])
  const [areaResponse, spaceTypeResponse] = await Promise.all([
    request.post('/space/_query/tree', {
      paging: false,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    }, { hiddenError: true }) as Promise<ApiResponse<SpaceAreaResponse[]>>,
    (request.post('/space/type/_query/no-paging', {
      paging: false,
    }, { hiddenError: true }) as Promise<ApiResponse<SpaceTypeResponse[]>>).catch(() => undefined),
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

export const queryDeviceSpaceAreaBindings_api = async (
  deviceIds: string[],
  _projectId = '',
): Promise<DeviceSpaceAreaBinding[]> => {
  const ids = normalizeIds(deviceIds)
  if (!ids.length) return []
  if (await existsDeviceSpaceAreaSupport_api() !== true) return []

  const response = await request
    .post('/space/bind/_query', { assetType: 'device', assetIds: ids }, { hiddenError: true }) as ApiResponse<SpaceDataBindInfoResponse[]>

  return unwrapList(response)
    .map((item) => ({
      deviceId: String(item.assetId || ''),
      areaId: String(item.spaceId || ''),
      area: typeof item.spaceName === 'string' ? item.spaceName : undefined,
    }))
    .filter((item) => ids.includes(item.deviceId) && Boolean(item.areaId))
}

/**
 * 绑定设备到目标区域；后端会在同一事务内完成首次绑定或从旧区域换绑。
 *
 * 业务异常转换为后端 message，供批量操作和抽屉统一展示，而非 Axios 的英文状态描述。
 */
export const bindDevicesSpaceArea_api = async (spaceId: string, deviceIds: string[]): Promise<void> => {
  const ids = normalizeIds(deviceIds)
  if (!spaceId || !ids.length) return
  if (await existsDeviceSpaceAreaSupport_api() !== true) return
  try {
    await request.post('/space/bind/_bind', { spaceId, assetType: 'device', assetIds: ids }, { hiddenError: true })
  } catch (error) {
    throw toBusinessError(error)
  }
}

export const querySpaceAreaDeviceIds_api = async (areaIds: string[]): Promise<string[]> => {
  const bindings = await querySpaceAreaDeviceBindings_api(areaIds)
  return [...new Set(bindings.map((item) => item.deviceId).filter(Boolean))]
}

export const querySpaceAreaDeviceBindings_api = async (
  areaIds: string[],
): Promise<DeviceSpaceAreaBinding[]> => {
  const ids = normalizeIds(areaIds)
  if (!ids.length) return []
  if (await existsDeviceSpaceAreaSupport_api() !== true) return []

  const response = await request.post('/space/data-bind/_query/no-paging', {
    paging: false,
    terms: [{ column: 'spaceId', termType: 'in', value: ids }],
  }, { hiddenError: true }) as ApiResponse<SpaceDataBindResponse[]>

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
