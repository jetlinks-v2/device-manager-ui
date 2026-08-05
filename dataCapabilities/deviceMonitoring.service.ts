import dayjs from 'dayjs'
import i18n from '@jetlinks-web-core/locales'
import { queryTree as queryDeviceCategoryTree } from '@device-manager-ui/api/category'
import { dashboard, getDeviceGeoJson } from '@device-manager-ui/api/dashboard'
import { countDeviceInstances } from '@device-manager-ui/api/deviceInstanceMonitoring'
import { queryNoPagingPost as queryDeviceProducts } from '@device-manager-ui/api/product'
import type {
  DeviceCategoryDistributionQuery,
  DeviceCategoryDistributionRow,
  DeviceLocationPageData,
  DeviceLocationQuery,
  DeviceLocationRow,
  DeviceRuntimeTrendQuery,
  DeviceRuntimeTrendRow,
  DeviceSummaryData,
  DeviceSummaryQuery,
} from './deviceMonitoring.types'
import {
  createIotDeviceScopeTerm,
  IOT_DEVICE_DASHBOARD_ACCESS_PROVIDERS,
} from './deviceScope'

type UnknownRecord = Record<string, unknown>

const DEFAULT_TREND_DURATION = 24 * 60 * 60 * 1000
const ONLINE_RATE_GROUP = 'device-runtime-online-rate'
const MESSAGE_COUNT_GROUP = 'device-runtime-message-count'
const t = (key: string) => String(i18n.global.t(key))

/**
 * 查询设备状态总览。
 *
 * 健康在线与异常在线需要跨告警域关联，当前设备接口无法给出准确值，因此明确返回 null。
 */
export async function loadDeviceSummary(
  query: DeviceSummaryQuery,
  signal?: AbortSignal,
): Promise<DeviceSummaryData> {
  if (query.deviceIds && !query.deviceIds.length) return createEmptyDeviceSummary()

  const terms = createDeviceSummaryTerms(query)
  const [total, online, offline, notActive] = await Promise.all([
    queryDeviceCount(terms, undefined, signal),
    queryDeviceCount(terms, 'online', signal),
    queryDeviceCount(terms, 'offline', signal),
    queryDeviceCount(terms, 'notActive', signal),
  ])
  const other = Math.max(total - online - offline - notActive, 0)

  return {
    total,
    online,
    offline,
    notActive,
    other,
    onlineRate: total > 0 ? Number(((online / total) * 100).toFixed(2)) : 0,
    healthyOnline: null,
    abnormalOnline: null,
    sampleTime: Date.now(),
  }
}

function createEmptyDeviceSummary(): DeviceSummaryData {
  return {
    total: 0,
    online: 0,
    offline: 0,
    notActive: 0,
    other: 0,
    onlineRate: 0,
    healthyOnline: null,
    abnormalOnline: null,
    sampleTime: Date.now(),
  }
}

/**
 * 查询带地理坐标的设备分页。
 *
 * Geo 接口在不同部署中可能返回 page、GeoJSON 或数组，统一在此边界收口为稳定分页结构。
 */
export async function loadDeviceLocationList(
  query: DeviceLocationQuery,
  signal?: AbortSignal,
): Promise<DeviceLocationPageData> {
  const terms: UnknownRecord[] = []
  if (query.scope === 'iot') terms.push(createIotDeviceScopeTerm())
  if (query.state) {
    terms.push({ column: 'state', termType: 'eq', value: query.state })
  }
  const response = await getDeviceGeoJson({
    paging: true,
    pageIndex: query.pageIndex,
    pageSize: query.pageSize,
    terms,
  }, { signal })
  assertResponseSuccess(response)

  const root = asRecord(unwrapResult(response))
  const rows = extractRows(unwrapResult(response))
  const data = rows
    .map(normalizeLocationRow)
    .filter((item): item is DeviceLocationRow => Boolean(item))

  return {
    data,
    total: finiteNumber(root.total ?? root.count ?? root.numberMatched) ?? data.length,
    pageIndex: finiteNumber(root.pageIndex) ?? query.pageIndex,
    pageSize: finiteNumber(root.pageSize) ?? query.pageSize,
  }
}

/**
 * 查询设备在线率与上行消息量趋势。
 */
export async function loadDeviceRuntimeTrend(
  query: DeviceRuntimeTrendQuery,
  signal?: AbortSignal,
): Promise<DeviceRuntimeTrendRow[]> {
  const endTime = query.endTime ?? Date.now()
  const startTime = query.startTime ?? endTime - DEFAULT_TREND_DURATION
  if (startTime > endTime) throw new Error(t('DeviceDataCapability.error.invalidTimeRange'))

  const aggregation = resolveAggregation(startTime, endTime)
  const params = {
    ...(query.scope === 'iot'
      ? { accessProvider: IOT_DEVICE_DASHBOARD_ACCESS_PROVIDERS }
      : {}),
    limit: aggregation.limit,
    from: dayjs(startTime).format('YYYY-MM-DD HH:mm:ss'),
    to: dayjs(endTime).format('YYYY-MM-DD HH:mm:ss'),
    time: aggregation.time,
    format: aggregation.format,
  }
  const response = await dashboard([
    {
      dashboard: 'device',
      object: 'status',
      measurement: 'record',
      dimension: 'onlineRate',
      group: ONLINE_RATE_GROUP,
      params,
    },
    {
      dashboard: 'device',
      object: 'message',
      measurement: 'quantity',
      dimension: 'agg',
      group: MESSAGE_COUNT_GROUP,
      params,
    },
  ], { signal })
  assertResponseSuccess(response)

  const points = new Map<number, DeviceRuntimeTrendRow>()
  extractRows(unwrapResult(response)).forEach((row) => {
    const group = text(row.group)
    if (group !== ONLINE_RATE_GROUP && group !== MESSAGE_COUNT_GROUP) return
    const data = asRecord(row.data)
    const timestamp = toTimestamp(data.timeString)
    if (timestamp === null) return

    const point = points.get(timestamp) || {
      timestamp,
      onlineRate: null,
      messageCount: 0,
    }
    if (group === ONLINE_RATE_GROUP) {
      const value = finiteNumber(data.value ?? data.rate)
      point.onlineRate = value === undefined ? null : clampPercentage(value)
    } else {
      point.messageCount = Math.max(finiteNumber(data.value ?? data.count) ?? 0, 0)
    }
    points.set(timestamp, point)
  })

  return Array.from(points.values())
    .sort((left, right) => left.timestamp - right.timestamp)
}

function createDeviceSummaryTerms(query: DeviceSummaryQuery): UnknownRecord[] {
  const terms: UnknownRecord[] = []
  if (query.scope === 'iot') terms.push(createIotDeviceScopeTerm())
  if (query.deviceIds) {
    terms.push({ column: 'id', termType: 'in', value: query.deviceIds })
  }
  return terms
}

/**
 * 按设备分类统计实例数量。分类、产品和设备实例的关联只在设备模块内解释。
 */
export async function loadDeviceCategoryDistribution(
  query: DeviceCategoryDistributionQuery,
  signal?: AbortSignal,
): Promise<DeviceCategoryDistributionRow[]> {
  const [categoryResponse, productResponse, totalDeviceCount] = await Promise.all([
    queryDeviceCategoryTree({
      paging: false,
      sorts: [{ name: 'sortIndex', order: 'asc' }],
    }, { signal, hiddenError: true }),
    queryDeviceProducts({
      paging: false,
      terms: [],
    }, { signal, hiddenError: true }),
    queryDeviceCount([], undefined, signal),
  ])
  assertResponseSuccess(categoryResponse)
  assertResponseSuccess(productResponse)
  const categories = extractRows(unwrapResult(categoryResponse))
    .map(toCategoryNode)
    .filter((item): item is CategoryNode => Boolean(item))
  const products = extractRows(unwrapResult(productResponse))
  const productIdsByCategory = groupProductIdsByRootCategory(categories, products)
  const rows = await Promise.all(categories.map(async category => ({
    category,
    count: await countDevicesByProducts(
      productIdsByCategory.get(category.id) || [],
      signal,
    ),
  })))
  const ranked = rows
    .filter(item => item.count > 0)
    .sort((left, right) => right.count - left.count
      || left.category.name.localeCompare(right.category.name))
  const categorizedCount = ranked.reduce((sum, item) => sum + item.count, 0)
  const uncategorizedCount = Math.max(totalDeviceCount - categorizedCount, 0)
  const hasOverflow = ranked.length + (uncategorizedCount > 0 ? 1 : 0) > query.limit
  const visibleCategoryCount = hasOverflow ? Math.max(query.limit - 1, 0) : ranked.length
  const visibleRows = ranked.slice(0, visibleCategoryCount)
  const overflowCount = ranked
    .slice(visibleCategoryCount)
    .reduce((sum, item) => sum + item.count, 0)
  const otherCount = uncategorizedCount + overflowCount
  const result = visibleRows.map(item => ({
    categoryId: item.category.id,
    categoryName: item.category.name,
    count: item.count,
    rate: toDistributionRate(item.count, totalDeviceCount),
  }))
  if (otherCount > 0) {
    result.push({
      categoryId: 'other',
      categoryName: t('DeviceDataCapability.category.other'),
      count: otherCount,
      rate: toDistributionRate(otherCount, totalDeviceCount),
    })
  }
  return result
}

interface CategoryNode {
  id: string
  name: string
  children: CategoryNode[]
}

function toCategoryNode(value: UnknownRecord): CategoryNode | undefined {
  const id = text(value.id).trim()
  const name = text(value.name).trim()
  if (!id || !name) return undefined
  return {
    id,
    name,
    children: Array.isArray(value.children)
      ? value.children
          .map(asRecord)
          .map(toCategoryNode)
          .filter((item): item is CategoryNode => Boolean(item))
      : [],
  }
}

function groupProductIdsByRootCategory(
  roots: CategoryNode[],
  products: UnknownRecord[],
): Map<string, string[]> {
  const rootByCategory = new Map<string, string>()
  roots.forEach(root => collectRootCategoryIds(root, root.id, rootByCategory))
  const grouped = new Map<string, string[]>()
  products.forEach((product) => {
    const productId = text(product.id).trim()
    if (!productId) return
    normalizeIds(product.classifiedId ?? product.categoryId).forEach((categoryId) => {
      const rootId = rootByCategory.get(categoryId)
      if (!rootId) return
      const ids = grouped.get(rootId) || []
      if (!ids.includes(productId)) ids.push(productId)
      grouped.set(rootId, ids)
    })
  })
  return grouped
}

function collectRootCategoryIds(
  node: CategoryNode,
  rootId: string,
  result: Map<string, string>,
) {
  result.set(node.id, rootId)
  node.children.forEach(child => collectRootCategoryIds(child, rootId, result))
}

async function countDevicesByProducts(
  productIds: string[],
  signal?: AbortSignal,
): Promise<number> {
  if (!productIds.length) return 0
  const response = await countDeviceInstances({
    terms: [{ column: 'productId', termType: 'in', value: productIds }],
  }, { signal, hiddenError: true })
  assertResponseSuccess(response)
  const result = unwrapResult(response)
  return finiteNumber(isRecord(result) ? result.total ?? result.count : result) ?? 0
}

function normalizeIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).map(item => item.trim()).filter(Boolean)
  const normalized = text(isRecord(value) ? value.value : value).trim()
  return normalized ? [normalized] : []
}

async function queryDeviceCount(
  baseTerms: UnknownRecord[],
  state: string | undefined,
  signal?: AbortSignal,
): Promise<number> {
  const response = await countDeviceInstances({
    terms: [
      ...baseTerms,
      ...(state ? [{ column: 'state', termType: 'eq', value: state }] : []),
    ],
  }, { signal, hiddenError: true })
  assertResponseSuccess(response)
  const result = unwrapResult(response)
  return finiteNumber(isRecord(result) ? result.total ?? result.count : result) ?? 0
}

function normalizeLocationRow(row: UnknownRecord): DeviceLocationRow | undefined {
  const properties = asRecord(row.properties)
  const source = { ...row, ...properties }
  const coordinates = resolveCoordinates(row, properties)
  if (!coordinates) return undefined

  const state = enumValue(source.state)
  return {
    deviceId: textOrNull(source.deviceId ?? source.id),
    deviceName: textOrNull(source.deviceName ?? source.name),
    longitude: coordinates[0],
    latitude: coordinates[1],
    state,
    stateText: enumText(source.state) ?? state,
    productId: textOrNull(source.productId),
    productName: textOrNull(source.productName),
    lastOnlineTime: toTimestamp(source.lastOnlineTime),
  }
}

function resolveCoordinates(row: UnknownRecord, properties: UnknownRecord): [number, number] | undefined {
  const geometry = asRecord(row.geometry)
  const location = asRecord(row.location)
  const candidates = [
    geometry.coordinates,
    location.coordinates,
    row.coordinates,
    row.geoPoint,
    properties.coordinates,
    properties.geoPoint,
  ]
  for (const candidate of candidates) {
    const value = toCoordinates(candidate)
    if (value) return value
  }
  const longitude = finiteNumber(row.longitude ?? row.lon ?? properties.longitude ?? properties.lon)
  const latitude = finiteNumber(row.latitude ?? row.lat ?? properties.latitude ?? properties.lat)
  return longitude === undefined || latitude === undefined ? undefined : [longitude, latitude]
}

function toCoordinates(value: unknown): [number, number] | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = finiteNumber(value[0])
    const latitude = finiteNumber(value[1])
    if (longitude !== undefined && latitude !== undefined) return [longitude, latitude]
  }
  if (typeof value === 'string' && value.includes(',')) {
    const [longitude, latitude] = value.split(',').map(finiteNumber)
    if (longitude !== undefined && latitude !== undefined) return [longitude, latitude]
  }
  const record = asRecord(value)
  const longitude = finiteNumber(record.longitude ?? record.lon)
  const latitude = finiteNumber(record.latitude ?? record.lat)
  return longitude === undefined || latitude === undefined ? undefined : [longitude, latitude]
}

function resolveAggregation(startTime: number, endTime: number) {
  const duration = endTime - startTime
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  const year = 365 * day
  if (duration <= hour) return { time: '1m', format: 'yyyy-MM-dd HH:mm:ss', limit: 60 }
  if (duration <= day) return { time: '1h', format: 'yyyy-MM-dd HH:mm:ss', limit: 24 }
  if (duration < year) return { time: '1d', format: 'yyyy-MM-dd', limit: Math.ceil(duration / day) + 1 }
  return { time: '1M', format: 'yyyy-MM', limit: Math.ceil(duration / (30 * day)) + 1 }
}

function clampPercentage(value: number): number {
  return Math.min(Math.max(Number(value.toFixed(2)), 0), 100)
}

function toDistributionRate(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
}

function assertResponseSuccess(response: unknown) {
  if (!isRecord(response)) return
  if (response.success === false || (response.status !== undefined && Number(response.status) !== 200)) {
    throw new Error(text(response.message) || t('DeviceDataCapability.error.loadFailed'))
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
      : Array.isArray(record.features)
        ? record.features
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
  const parsed = dayjs(String(raw)).valueOf()
  return Number.isFinite(parsed) ? parsed : null
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
