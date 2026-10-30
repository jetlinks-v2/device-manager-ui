import {
  createDomainAgentErrorResult,
  createDomainAgentInputError,
  DomainAgentInputError,
  resolveDomainAgentMessage,
  type DomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { buildIotDeviceDetailPath } from '@device-manager-ui/views/device/list/hooks/useIotDeviceRouting'
import {
  iotDeviceDetailRealApi,
  parseMetadata,
  type ThingModelMetadata,
} from '@device-manager-ui/views/device/list/services/iotDeviceDetailReal.service'
import type { IotDevice } from '@device-manager-ui/views/device/list/types'

export type RawDevice = Record<string, unknown> & {
  id: string
  name?: string
  productId?: string
  metadata?: unknown
  deriveMetadata?: unknown
  productMetadata?: unknown
}

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

export const asRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {}

export const unwrapResult = <T>(value: unknown): T => (
  isRecord(value) && 'result' in value ? value.result as T : value as T
)

export const normalizeText = (value: unknown) => String(value || '').trim()

export const isDeviceDetailHandoffRequested = (value: unknown) => (
  value === true || normalizeText(value).toLowerCase() === 'true'
)

export const inputError = (
  code: string,
  key: string,
  params?: Record<string, string | number>,
) => createDomainAgentInputError(code, `IotGeneralAgent.errors.${key}`, params)

/** Only expose explicit event/report times; page lastSeen is derived from connection events, not observed communication. */
export const mapDeviceTimeContext = (device: IotDevice) => ({
  onlineAt: device.onlineAt,
  offlineAt: device.offlineAt,
  lastReportAt: device.lastReportAt,
  timeSemantics: {
    onlineAt: resolveDomainAgentMessage('DeviceConnectionAgent.time.onlineAt'),
    offlineAt: resolveDomainAgentMessage('DeviceConnectionAgent.time.offlineAt'),
    lastReportAt: resolveDomainAgentMessage('DeviceConnectionAgent.time.lastReportAt'),
  },
})

export const mapDevice = (device: IotDevice) => ({
  id: device.id,
  name: device.name,
  productId: device.productId,
  productName: device.productName,
  state: { value: device.connectionStatus || device.status, text: device.status },
  deviceType: { value: device.deviceTypeValue, text: device.deviceType },
  areaId: device.areaId,
  area: device.area,
  groupId: device.groupId,
  groupName: device.groupName,
  ...mapDeviceTimeContext(device),
  navigation: buildIotDeviceDetailPath(getProjectIdFromLocation(), device.id),
})

export const getRawDevice = async (deviceId: string) => {
  const response = await iotDeviceDetailRealApi.getDeviceDetail(deviceId)
  const device = asRecord(unwrapResult<unknown>(response))
  const id = normalizeText(device.id)
  if (!id) throw inputError('DEVICE_NOT_FOUND', 'deviceNotFound', { deviceId })
  return { ...device, id } as RawDevice
}

export const getMetadata = async (deviceId: string) => {
  const device = await getRawDevice(deviceId)
  return {
    device,
    metadata: parseMetadata(device.metadata || device.deriveMetadata || device.productMetadata),
  }
}

export type DeviceMetadataResolver = (deviceId: string) => Promise<{
  device: Pick<RawDevice, 'id' | 'name'>
  metadata: ThingModelMetadata
}>

/** 页面拥有物模型的新鲜度；缺省加载只在当前助手实例内复用。 */
export const createDeviceMetadataResolver = (
  getDevice: () => Pick<IotDevice, 'id' | 'name' | 'thingModelMetadata'> | null | undefined,
): DeviceMetadataResolver => {
  let cached: { deviceId: string, promise: ReturnType<DeviceMetadataResolver> } | undefined
  let previousDevice: ReturnType<typeof getDevice>
  return async (deviceId) => {
    const device = getDevice()
    if (device !== previousDevice) {
      cached = undefined
      previousDevice = device
    }
    if (device?.id === deviceId && device.thingModelMetadata) {
      return { device: { id: device.id, name: device.name }, metadata: device.thingModelMetadata }
    }
    if (cached?.deviceId !== deviceId) {
      const promise = getMetadata(deviceId).then(({ device, metadata }) => ({
        device: { id: device.id, name: device.name }, metadata,
      }))
      cached = { deviceId, promise }
      void promise.catch(() => {
        if (cached?.promise === promise) cached = undefined
      })
    }
    return cached.promise
  }
}

export const findProperty = (metadata: ThingModelMetadata, propertyId: string) => {
  const property = metadata.properties
    .map(asRecord)
    .find(item => normalizeText(item.id || item.property || item.key) === propertyId)
  if (!property) throw inputError('PROPERTY_NOT_FOUND', 'propertyNotFound', { propertyId })
  return property
}

export const runDeviceTool = async <T>(
  data: T,
  action: () => Promise<DomainAgentToolResult<T>>,
): Promise<DomainAgentToolResult<T>> => {
  try {
    return await action()
  } catch (error) {
    if (error instanceof DomainAgentInputError) throw error
    return createDomainAgentErrorResult('device', data, error)
  }
}

/** Preserves the device-domain error receipt for results materialized later by the shared runtime. */
export const runDeviceToolExecution = async <T, TErrorData>(
  errorData: TErrorData,
  action: () => Promise<T>,
): Promise<T | DomainAgentToolResult<TErrorData>> => {
  try {
    return await action()
  } catch (error) {
    if (error instanceof DomainAgentInputError) throw error
    return createDomainAgentErrorResult('device', errorData, error)
  }
}
