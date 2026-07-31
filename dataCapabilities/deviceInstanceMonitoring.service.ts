import i18n from '@jetlinks-web-core/locales'
import {
  queryDeviceInstanceDetail,
  queryDeviceInstanceStates,
} from '@device-manager-ui/api/deviceInstanceMonitoring'
import type {
  DeviceDetailData,
  DeviceDetailQuery,
  DeviceStateBatchQuery,
  DeviceStateRow,
} from './deviceInstanceMonitoring.types'

type UnknownRecord = Record<string, unknown>

const t = (key: string) => String(i18n.global.t(key))

export async function loadDeviceStates(
  query: DeviceStateBatchQuery,
  signal?: AbortSignal,
): Promise<DeviceStateRow[]> {
  const response = await queryDeviceInstanceStates({
    paging: false,
    terms: [{ column: 'id', termType: 'in', value: query.deviceIds }],
  }, { signal, hiddenError: true })
  assertResponseSuccess(response)

  return extractRows(unwrapResult(response))
    .map(normalizeStateRow)
    .filter((item): item is DeviceStateRow => Boolean(item))
}

export async function loadDeviceDetail(
  query: DeviceDetailQuery,
  signal?: AbortSignal,
): Promise<DeviceDetailData> {
  const response = await queryDeviceInstanceDetail(
    query.deviceId,
    { signal, hiddenError: true },
  )
  assertResponseSuccess(response)
  const detail = asRecord(unwrapResult(response))
  if (!Object.keys(detail).length) {
    throw new Error(t('DeviceInstanceDataCapability.error.loadFailed'))
  }
  return normalizeDeviceDetail(detail, query.deviceId)
}

function normalizeStateRow(row: UnknownRecord): DeviceStateRow | undefined {
  const deviceId = textOrNull(row.id)
  if (!deviceId) return undefined
  return {
    deviceId,
    state: enumValue(row.state),
    stateText: enumText(row.state),
  }
}

function normalizeDeviceDetail(
  row: UnknownRecord,
  fallbackDeviceId: string,
): DeviceDetailData {
  const state = enumValue(row.state)
  const lastActiveTime = state === 'online'
    ? toTimestamp(row.onlineTime)
    : state === 'offline'
      ? toTimestamp(row.offlineTime)
      : null

  return {
    deviceId: textOrNull(row.id) ?? fallbackDeviceId,
    deviceName: textOrNull(row.name),
    state,
    stateText: enumText(row.state),
    productName: textOrNull(row.productName),
    deviceType: enumText(row.deviceType) ?? enumValue(row.deviceType),
    organizationName: textOrNull(row.orgName),
    accessMode: firstText(
      enumValue(row.transportProtocol),
      enumValue(row.transport),
      enumValue(row.accessProvider),
    ),
    address: textOrNull(row.address),
    description: firstText(row.description, row.describe),
    lastActiveTime,
  }
}

function assertResponseSuccess(response: unknown) {
  if (!isRecord(response)) return
  if (response.success === false || (response.status !== undefined && Number(response.status) !== 200)) {
    throw new Error(
      text(response.message)
      || t('DeviceInstanceDataCapability.error.loadFailed'),
    )
  }
}

function unwrapResult(value: unknown): unknown {
  return isRecord(value) && 'result' in value ? value.result : value
}

function extractRows(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  const record = asRecord(value)
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.records)
      ? record.records
      : []
  return rows.filter(isRecord)
}

function enumValue(value: unknown): string | null {
  return textOrNull(isRecord(value) ? value.value : value)
}

function enumText(value: unknown): string | null {
  return textOrNull(isRecord(value) ? value.text : undefined)
}

function toTimestamp(value: unknown): number | null {
  const raw = isRecord(value) ? value.value : value
  if (raw === undefined || raw === null || raw === '') return null
  const numeric = Number(raw)
  if (Number.isFinite(numeric)) {
    if (numeric > 1_000_000_000_000) return numeric
    if (numeric > 1_000_000_000) return numeric * 1000
  }
  const parsed = Date.parse(String(raw))
  return Number.isFinite(parsed) ? parsed : null
}

function textOrNull(value: unknown): string | null {
  const valueText = text(value).trim()
  return valueText || null
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const valueText = textOrNull(value)
    if (valueText) return valueText
  }
  return null
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
