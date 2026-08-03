import { request, wsClient } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'
import { map } from 'rxjs/operators'
import { withIotDeviceListDefaultTerms } from '@device-manager-ui/api/deviceListDefaultTerms'

export type ThingModelMetadata = {
  properties: any[]
  functions: any[]
  events: any[]
  tags: any[]
}

export type DevicePropertyValue = {
  property: string
  value?: any
  formatValue?: any
  timestamp?: number
  timeString?: string
  [key: string]: any
}

export function parseMetadata(value: unknown): ThingModelMetadata {
  if (!value) return { properties: [], functions: [], events: [], tags: [] }
  if (typeof value === 'object') {
    const metadata = value as Partial<ThingModelMetadata>
    return {
      properties: Array.isArray(metadata.properties) ? metadata.properties : [],
      functions: Array.isArray(metadata.functions) ? metadata.functions : [],
      events: Array.isArray(metadata.events) ? metadata.events : [],
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    }
  }
  if (typeof value !== 'string') return { properties: [], functions: [], events: [], tags: [] }
  try {
    return parseMetadata(JSON.parse(value))
  } catch {
    return { properties: [], functions: [], events: [], tags: [] }
  }
}

export function extractRows(result: any): any[] {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.records)) return result.records
  if (Array.isArray(result?.result)) return result.result
  return []
}

export function formatApiTime(value: unknown, fallback = '--'): string {
  if (!value) return fallback
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const withDefaultDeviceListQuery = (data: Record<string, any> = {}) => ({
  ...data,
  terms: withIotDeviceListDefaultTerms(data.terms ?? []),
})

export const iotDeviceDetailRealApi = {
  getDeviceDetail: (deviceId: string) => request.get(`/device-instance/${deviceId}/detail`),
  queryDashboard: (data: any) => request.post('/dashboard/_multi', data),
  readProperty: (deviceId: string, property: string) => request.get(`/device/standard/${deviceId}/property/${property}`),
  setProperty: (deviceId: string, data: Record<string, any>) => request.put(`/device-instance/${deviceId}/property`, data),
  queryPropertyData: (deviceId: string, property: string, data: Record<string, any>) =>
    request.post(`/device/instance/${deviceId}/property/${property}/_query`, data),
  queryPropertyNoPaging: (deviceId: string, property: string, data: Record<string, any>) =>
    request.post(`/device/instance/${deviceId}/property/${property}/_query/no-paging`, data),
  queryPropertyAggregation: (deviceId: string, data: Record<string, any>) =>
    request.post(`/device-instance/${deviceId}/agg/_query`, data),
  queryPropertyMetric: (deviceId: string, data: any) => request.post(`/device-instance/${deviceId}/metric/properties`, data),
  queryEvent: (deviceId: string, eventId: string, data: Record<string, any>) =>
    request.post(`/device-instance/${deviceId}/event/${eventId}`, data),
  queryLog: (deviceId: string, data: Record<string, any>) => request.post(`/device-instance/${deviceId}/logs`, data),
  queryOverviewSummary: (data: Record<string, any>) => request.post('/device/summary/_overview', data),
  queryLogsType: () => request.get('/dictionary/device-log-type/items'),
  queryAlarmByDevice: (data: Record<string, any>) => request.post('/alarm/record/device/_query', data),
  handleAlarmByDevice: (data: Record<string, any>) => request.post('/alarm/record/device/_handle', data),
  queryAlarmHandleHistory: (recordId: string, data: Record<string, any>) =>
    request.post(`/alarm/record/${recordId}/handle-history/_query`, data),
  queryAlarmRecordLogs: (recordId: string, data: Record<string, any>) =>
    request.post(`/alarm/history/alarm-record/${recordId}/_query`, data),
  countAlarmHistoryByDevice: (deviceId: string, data: Record<string, any>) =>
    request.post(`/alarm/history/device/_count?targetId=${encodeURIComponent(deviceId)}`, data),
  queryDeviceThresholdList: (productId: string, deviceId: string, data: Record<string, any>) =>
    request.post(`/message/preprocessor/product/${productId}/${deviceId}/property/_list`, data),
  queryProductThresholdList: (productId: string, data: Record<string, any>) =>
    request.post(`/message/preprocessor/product/${productId}/property/_list`, data),
  queryInvalidData: (data: Record<string, any>) => request.post('/message/preprocessor/invalid/_query', data),
  queryDeviceGeo: (data: Record<string, any>) => request.post('/geo/object/device/_search/_page', data),
  updateDeviceThreshold: (productId: string, deviceId: string, propertyId: string, data: any) =>
    request.put(`/message/preprocessor/device/${productId}/${deviceId}/property/${propertyId}`, data),
  deleteDeviceThreshold: (productId: string, deviceId: string, propertyId: string, data?: any) =>
    request.remove(`/message/preprocessor/device/${productId}/${deviceId}/property/${propertyId}`, data),
  saveTags: (deviceId: string, data: Record<string, any> | Record<string, any>[]) => request.patch(`/device/instance/${deviceId}/tag`, data),
  deleteTag: (deviceId: string, tagId: string) => request.remove(`/device/instance/${deviceId}/tag/${tagId}`),
  queryChildDevices: (data: Record<string, any>) => request.post('/device-instance/_query', withDefaultDeviceListQuery(data)),
  queryChildDevicesNoPaging: (data: Record<string, any>) => request.post('/device-instance/_query/no-paging?paging=false', withDefaultDeviceListQuery(data)),
  queryChildProductNoPaging: (data: Record<string, any>) => request.post('/device/product/_query/no-paging?paging=false', data),
  addDevice: (data: Record<string, any>) => request.post('/device-instance', data),
  bindDevice: (deviceId: string, data: Record<string, any>) => request.post(`/device/gateway/${deviceId}/bind`, data),
  unbindBatchDevice: (deviceId: string, data: Record<string, any>) => request.post(`/device/gateway/${deviceId}/unbind`, data),
  unbindDevice: (deviceId: string, childrenId: string, data: Record<string, any>) =>
    request.post(`/device/gateway/${deviceId}/unbind/${childrenId}`, data),
  getDevicePrincipal: (deviceId: string) => request.get(`/device/principal/${deviceId}`),
  resetDevicePrincipal: (deviceId: string) => request.post(`/device/principal/${deviceId}/_reset`),
  existsDevicePrincipalSupport: () => request.get<boolean>(`/command-supports/service/deviceService:principal/exists`),
  getProductDetail: (productId: string) => request.get(`/device-product/${productId}`),
  getGatewayDetail: (id: string) => request.get(`/gateway/device/${id}`),
  queryGatewayDetail: (id: string) => request.get(`/gateway/device/${id}/detail`),
  queryDeviceConfig: (id: string) => request.get(`/device-instance/${id}/config-metadata`),
  queryProtocolDetail: (type: string, transport: string) => request.get(`/protocol/${type}/transport/${transport}`),
  sendDeviceMessage: (deviceId: string, data: Record<string, any>) => request.post(`/device/instance/${deviceId}/message`, data),
  getDeviceSessions: (deviceId: string) => request.get(`/device/instance/${deviceId}/sessions`),
  getTransparentCodecSupports: () => request.post<Array<{ id: string; name: string }>>('/device/transparent-codec/supports'),
  getDeviceTransparentCodec: (productId: string, deviceId: string) =>
    request.get(`/device/transparent-codec/${productId}/${deviceId}`),
  saveDeviceTransparentCodec: (productId: string, deviceId: string, data: Record<string, unknown>) =>
    request.post(`/device/transparent-codec/${productId}/${deviceId}`, data),
  deleteDeviceTransparentCodec: (productId: string, deviceId: string) =>
    request.remove(`/device/transparent-codec/${productId}/${deviceId}`),
  testTransparentDecode: (data: Record<string, unknown>) => request.post('/device/transparent-codec/decode-test', data),
  testTransparentEncode: (data: Record<string, unknown>) => request.post('/device/transparent-codec/encode-test', data),
  queryTransparentCodecTips: (productId: string, deviceId: string) =>
    request.get(`/device/transparent-codec/${productId}/${deviceId}.d.ts`),
  saveDeviceConfig: (deviceId: string, data: Record<string, any>) => request.put(`/device-instance/${deviceId}`, data),
  executeFunction: (deviceId: string, functionId: string, data: any) =>
    request.post(`/device/invoked/${deviceId}/function/${functionId}`, data),
}

/** Returns the authenticated platform path consumed by the shared NDJSON client-tool transport. */
export const buildDevicePropertyNoPagingUrl = (deviceId: string, property: string) => (
  `/device/instance/${encodeURIComponent(deviceId)}/property/${encodeURIComponent(property)}/_query/no-paging`
)

export function subscribeDeviceProperties(
  deviceId: string,
  productId: string,
  properties: string[],
  onValue: (value: DevicePropertyValue) => void,
) {
  if (!deviceId || !properties.length) return undefined
  const dashboardObjectId = productId || deviceId
  const subscription = wsClient
    .getWebSocket(`iot-device-detail-property-${deviceId}-${dashboardObjectId}-${properties.join('-')}`, `/dashboard/device/${dashboardObjectId}/properties/realTime`, {
      deviceId,
      properties,
      history: 1,
    })
    ?.pipe(map((res: any) => res?.payload ?? res))
    .subscribe({
      next(payload: any) {
        try {
          for (const value of normalizePropertyPayload(payload, properties)) {
            try {
              onValue(value)
            } catch (error) {
              console.warn('[iot-ui] 更新设备属性实时值失败', error, value)
            }
          }
        } catch (error) {
          console.warn('[iot-ui] 解析设备属性实时值失败', error, payload)
        }
      },
      error(error: unknown) {
        console.warn('[iot-ui] 设备属性实时值订阅异常', error)
      },
      complete() {
        console.warn('[iot-ui] 设备属性实时值订阅已完成', { deviceId, productId: dashboardObjectId, properties })
      },
    })

  return {
    unsubscribe() {
      subscription?.unsubscribe?.()
    },
  }
}

function normalizePropertyPayload(payload: any, properties: string[]): DevicePropertyValue[] {
  const propertySet = new Map(properties.map((item) => [String(item).toLowerCase(), String(item)]))
  const rowPayload = parsePayload(payload)
  const rows = Array.isArray(rowPayload) ? rowPayload : [rowPayload]
  return rows
    .flatMap((row) => {
      if (Array.isArray(row?.data)) return row.data
      if (Array.isArray(row?.result)) return row.result
      const valueMapRows = expandPropertyValueMap(row?.data?.value, propertySet, row)
      if (valueMapRows.length) return valueMapRows
      const valueRows = expandPropertyValueMap(row?.value, propertySet, row)
      if (valueRows.length) return valueRows
      const directRows = expandPropertyValueMap(row, propertySet, row)
      if (directRows.length) return directRows
      return [row]
    })
    .map((row) => {
      const value = row?.data?.value || row?.value || row
      const property = value?.property || value?.id || value?.key || row?.data?.property || row?.property || row?.id || row?.key
      if (!property) return undefined
      const valueObject = value && typeof value === 'object' ? value : { value }
      return {
        ...row,
        ...row?.data,
        ...valueObject,
        property,
        timestamp: row?.data?.timestamp ?? row?.timestamp ?? valueObject?.timestamp,
        timeString: row?.data?.timeString ?? row?.timeString ?? valueObject?.timeString,
      } as DevicePropertyValue
    })
    .filter((item): item is DevicePropertyValue => Boolean(item))
}

function parsePayload(payload: any) {
  if (typeof payload !== 'string') return payload
  try {
    return JSON.parse(payload)
  } catch {
    return payload
  }
}

function expandPropertyValueMap(source: any, propertySet: Map<string, string>, parent: any): DevicePropertyValue[] {
  const valueMap = parsePayload(source)
  if (!valueMap || typeof valueMap !== 'object' || Array.isArray(valueMap)) return []
  return Object.entries(valueMap)
    .filter(([key]) => propertySet.has(key.toLowerCase()))
    .map(([property, value]) => ({
      ...parent,
      property: propertySet.get(property.toLowerCase()) || property,
      value,
      formatValue: value,
      timestamp: parent?.data?.timestamp ?? parent?.timestamp,
      timeString: parent?.data?.timeString ?? parent?.timeString,
    }))
}

export function subscribeDeviceStatus(deviceId: string, onMessage: (value: any) => void) {
  if (!deviceId) return undefined
  return wsClient
    .getWebSocket(`iot-device-detail-status-${deviceId}`, `/dashboard/device/status/change/realTime`, { deviceId })
    ?.pipe(map((res: any) => res?.payload ?? res))
    .subscribe(onMessage)
}

export function subscribeDeviceTrace(deviceId: string, onMessage: (value: any) => void) {
  if (!deviceId) return undefined
  return wsClient
    .getWebSocket(`iot-device-detail-trace-${deviceId}`, `/debug/device/${deviceId}/trace`, {})
    ?.pipe(map((res: any) => res?.payload ?? res))
    .subscribe((payload: any) => onMessage({ key: randomString(), ...payload }))
}
