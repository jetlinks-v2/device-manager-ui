import i18n from '@jetlinks-web-core/locales'
import {
  queryDeviceGroupRuntimeDevices,
  queryDeviceGroups,
  queryDeviceGroupSummaries,
} from '@device-manager-ui/api/deviceGroupMonitoring'
import type {
  DeviceGroupDevicePageData,
  DeviceGroupDeviceRow,
  DeviceGroupDevicesQuery,
  DeviceGroupListQuery,
  DeviceGroupRow,
  DeviceGroupRuntimeState,
  DeviceGroupSummaryBatchQuery,
  DeviceGroupSummaryRow,
} from './deviceGroupMonitoring.types'
import { createIotDeviceScopeTerm } from './deviceScope'

type UnknownRecord = Record<string, unknown>

const t = (key: string) => String(i18n.global.t(key))
const RUNTIME_STATES: DeviceGroupRuntimeState[] = [
  'online',
  'offline',
  'notActive',
]

export async function loadDeviceGroups(
  query: DeviceGroupListQuery,
  signal?: AbortSignal,
): Promise<DeviceGroupRow[]> {
  const response = await queryDeviceGroups({
    paging: true,
    pageIndex: 0,
    pageSize: query.limit,
    sorts: [{ name: 'sortIndex', order: 'asc' }],
    terms: [],
  }, { signal })
  assertResponseSuccess(response)

  return extractRows(unwrapResult(response))
    .map(normalizeGroupRow)
    .filter((item): item is DeviceGroupRow => Boolean(item))
}

export async function loadDeviceGroupSummaries(
  query: DeviceGroupSummaryBatchQuery,
  signal?: AbortSignal,
): Promise<DeviceGroupSummaryRow[]> {
  if (!query.groupIds.length) return []

  const response = await queryDeviceGroupSummaries(
    query.groupIds.map(groupId => ({
      id: groupId,
      query: {
        pageIndex: 0,
        pageSize: 0,
        terms: createGroupDeviceTerms(groupId),
      },
    })),
    { signal },
  )
  assertResponseSuccess(response)

  return extractRows(unwrapResult(response))
    .map(normalizeSummaryRow)
    .filter((item): item is DeviceGroupSummaryRow => Boolean(item))
}

export async function loadDeviceGroupDevices(
  query: DeviceGroupDevicesQuery,
  signal?: AbortSignal,
): Promise<DeviceGroupDevicePageData> {
  const response = await queryDeviceGroupRuntimeDevices({
    paging: true,
    pageIndex: query.pageIndex,
    pageSize: query.pageSize,
    sorts: [{ name: 'createTime', order: 'desc' }],
    terms: createGroupDeviceTerms(query.groupId),
  }, { signal })
  assertResponseSuccess(response)

  const result = asRecord(unwrapResult(response))
  const data = extractRows(result)
    .map(normalizeDeviceRow)
    .filter((item): item is DeviceGroupDeviceRow => Boolean(item))

  return {
    data,
    total: finiteNumber(result.total ?? result.count) ?? data.length,
    pageIndex: finiteNumber(result.pageIndex) ?? query.pageIndex,
    pageSize: finiteNumber(result.pageSize) ?? query.pageSize,
  }
}

function createGroupDeviceTerms(groupId: string): UnknownRecord[] {
  return [
    { column: 'id', termType: 'dev-group-tree', value: groupId },
    createIotDeviceScopeTerm(),
  ]
}

function normalizeGroupRow(row: UnknownRecord): DeviceGroupRow | undefined {
  const groupId = textOrNull(row.id)
  if (!groupId) return undefined
  return {
    groupId,
    groupName: textOrNull(row.name ?? row.key) ?? groupId,
  }
}

function normalizeSummaryRow(row: UnknownRecord): DeviceGroupSummaryRow | undefined {
  const groupId = textOrNull(row.id)
  if (!groupId) return undefined

  const total = finiteNumber(row.total ?? row.deviceCount) ?? null
  const online = finiteNumber(row.online) ?? null
  const offline = finiteNumber(row.offline) ?? null
  const responseNotActive = finiteNumber(row.notActive)
  const notActive = responseNotActive !== undefined
    ? responseNotActive
    : total !== null && online !== null && offline !== null
      ? Math.max(total - online - offline, 0)
      : null
  const responseOnlineRate = finiteNumber(row.onlineRate)
  const onlineRate = responseOnlineRate !== undefined
    ? clampPercentage(responseOnlineRate)
    : total !== null && online !== null
      ? total > 0
        ? clampPercentage((online / total) * 100)
        : 0
      : null

  return {
    groupId,
    total,
    online,
    offline,
    notActive,
    onlineRate,
  }
}

function normalizeDeviceRow(row: UnknownRecord): DeviceGroupDeviceRow | undefined {
  const deviceId = textOrNull(row.id)
  if (!deviceId) return undefined
  const stateValue = enumValue(row.state)

  return {
    deviceId,
    identifier: textOrNull(row.identifier),
    deviceName: textOrNull(row.name),
    productName: textOrNull(row.productName),
    state: RUNTIME_STATES.includes(stateValue as DeviceGroupRuntimeState)
      ? stateValue as DeviceGroupRuntimeState
      : null,
    lastReportTime: toTimestamp(row.lastReportTime),
  }
}

function assertResponseSuccess(response: unknown) {
  if (!isRecord(response)) return
  if (response.success === false || (response.status !== undefined && Number(response.status) !== 200)) {
    throw new Error(text(response.message) || t('DeviceGroupDataCapability.error.loadFailed'))
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

function enumValue(value: unknown): string {
  return text(isRecord(value) ? value.value : value)
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

function clampPercentage(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(2)), 0), 100)
}

function finiteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function textOrNull(value: unknown): string | null {
  const valueText = text(value).trim()
  return valueText || null
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
