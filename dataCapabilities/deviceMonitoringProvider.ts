import i18n from '@jetlinks-web-core/locales'
import type {
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceRequest,
  DataSourceResult,
  RuntimeContext,
} from '@jetlinks-web-core/data-capability'
import { defer, map } from 'rxjs'
import {
  loadDeviceCategoryDistribution,
  loadDeviceLocationList,
  loadDeviceRuntimeTrend,
  loadDeviceSummary,
} from './deviceMonitoring.service'
import type {
  DeviceCategoryDistributionQuery,
  DeviceLocationPageData,
  DeviceLocationQuery,
  DeviceMonitoringState,
  DeviceMonitoringScope,
  DeviceRuntimeTrendQuery,
  DeviceSummaryQuery,
} from './deviceMonitoring.types'

const MODULE_ID = 'device-manager-ui'
const PROVIDER_ID = 'device-manager:monitoring'
const SUMMARY_SOURCE_ID = 'device.summary'
const LOCATION_SOURCE_ID = 'device.location.list'
const RUNTIME_TREND_SOURCE_ID = 'device.runtime.trend'
const CATEGORY_SOURCE_ID = 'device.category.distribution'

const DEFAULT_PAGE_INDEX = 0
const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 1000
const DEFAULT_CATEGORY_LIMIT = 8
const MAX_CATEGORY_LIMIT = 20
const STATES: DeviceMonitoringState[] = ['online', 'offline', 'notActive']
const SCOPES: DeviceMonitoringScope[] = ['iot']

const owner = { moduleId: MODULE_ID, providerId: PROVIDER_ID }
const t = (key: string) => String(i18n.global.t(key))
const objectOutputSchema = { type: 'object' as const }
const arrayOutputSchema = { type: 'array' as const, items: objectOutputSchema }

const summarySource: DataSourceDefinition = {
  id: SUMMARY_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceDataCapability.summary.name'),
  description: t('DeviceDataCapability.summary.description'),
  owner,
  tags: ['device', 'monitoring', 'summary'],
  facets: { category: 'device-monitoring' },
  modes: ['snapshot', 'poll'],
  defaults: { pollInterval: 10_000 },
  querySchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: SCOPES,
        title: t('DeviceDataCapability.query.scope'),
      },
      deviceIds: {
        type: 'array',
        items: { type: 'string' },
        title: t('DeviceDataCapability.query.deviceIds'),
      },
    },
  },
  outputSchema: objectOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceSummary(
        toSummaryQuery(request),
        request.signal || context.signal,
      ))
        .pipe(map(data => ({ data: data as T })))
    },
  }),
}

const locationSource: DataSourceDefinition = {
  id: LOCATION_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceDataCapability.location.name'),
  description: t('DeviceDataCapability.location.description'),
  owner,
  tags: ['device', 'location', 'page'],
  facets: { category: 'device-monitoring' },
  modes: ['page', 'snapshot'],
  querySchema: {
    type: 'object',
    properties: {
      pageIndex: { type: 'integer', default: DEFAULT_PAGE_INDEX },
      pageSize: { type: 'integer', default: DEFAULT_PAGE_SIZE },
      state: { type: 'string', enum: STATES },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceLocationList(
        toLocationQuery(request),
        request.signal || context.signal,
      )).pipe(map(page => toPageResult<T>(page)))
    },
  }),
}

const runtimeTrendSource: DataSourceDefinition = {
  id: RUNTIME_TREND_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceDataCapability.runtimeTrend.name'),
  description: t('DeviceDataCapability.runtimeTrend.description'),
  owner,
  tags: ['device', 'runtime', 'trend'],
  facets: { category: 'device-monitoring' },
  modes: ['snapshot', 'poll'],
  defaults: { pollInterval: 60_000 },
  querySchema: {
    type: 'object',
    properties: {
      startTime: { type: 'integer', title: t('DeviceDataCapability.query.startTime') },
      endTime: { type: 'integer', title: t('DeviceDataCapability.query.endTime') },
      scope: {
        type: 'string',
        enum: SCOPES,
        title: t('DeviceDataCapability.query.scope'),
      },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceRuntimeTrend(
        toRuntimeTrendQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

const categorySource: DataSourceDefinition = {
  id: CATEGORY_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceDataCapability.category.name'),
  description: t('DeviceDataCapability.category.description'),
  owner,
  tags: ['device', 'category', 'distribution'],
  facets: { category: 'device-monitoring' },
  modes: ['snapshot', 'poll'],
  defaults: { pollInterval: 60_000, limit: DEFAULT_CATEGORY_LIMIT },
  querySchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', default: DEFAULT_CATEGORY_LIMIT },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceCategoryDistribution(
        toCategoryQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

function toLocationQuery(request: DataSourceRequest): DeviceLocationQuery {
  const state = optionalText(request.query?.state)
  if (state && !STATES.includes(state as DeviceMonitoringState)) {
    throw new Error(t('DeviceDataCapability.error.invalidState'))
  }
  return {
    pageIndex: integerInRange(request.query?.pageIndex, DEFAULT_PAGE_INDEX, 0),
    pageSize: integerInRange(request.query?.pageSize ?? request.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
    state: state as DeviceMonitoringState | undefined,
  }
}

function toSummaryQuery(request: DataSourceRequest): DeviceSummaryQuery {
  return {
    scope: toScope(request.query?.scope),
    deviceIds: optionalUniqueTexts(request.query?.deviceIds),
  }
}

function toRuntimeTrendQuery(request: DataSourceRequest): DeviceRuntimeTrendQuery {
  const startTime = optionalTimestamp(request.query?.startTime)
  const endTime = optionalTimestamp(request.query?.endTime)
  if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
    throw new Error(t('DeviceDataCapability.error.invalidTimeRange'))
  }
  return {
    startTime,
    endTime,
    scope: toScope(request.query?.scope),
  }
}

function toCategoryQuery(request: DataSourceRequest): DeviceCategoryDistributionQuery {
  return {
    limit: integerInRange(
      request.query?.limit ?? request.limit,
      DEFAULT_CATEGORY_LIMIT,
      1,
      MAX_CATEGORY_LIMIT,
    ),
  }
}

function toPageResult<T>(page: DeviceLocationPageData): DataSourceResult<T> {
  return {
    data: page.data as T,
    total: page.total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text || undefined
}

function toScope(value: unknown): DeviceMonitoringScope | undefined {
  const scope = optionalText(value)
  if (!scope) return undefined
  if (!SCOPES.includes(scope as DeviceMonitoringScope)) {
    throw new Error(t('DeviceDataCapability.error.invalidScope'))
  }
  return scope as DeviceMonitoringScope
}

function optionalUniqueTexts(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) {
    throw new Error(t('DeviceDataCapability.error.invalidDeviceIds'))
  }
  return Array.from(new Set(
    value.map(optionalText).filter((item): item is string => Boolean(item)),
  ))
}

function optionalTimestamp(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const timestamp = Number(value)
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new Error(t('DeviceDataCapability.error.invalidTimestamp'))
  }
  return timestamp
}

function integerInRange(value: unknown, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(t('DeviceDataCapability.error.invalidPagination'))
  }
  return number
}

const deviceMonitoringProvider: DataCapabilityProvider = {
  id: PROVIDER_ID,
  owner,
  capabilityIds: [
    SUMMARY_SOURCE_ID,
    LOCATION_SOURCE_ID,
    RUNTIME_TREND_SOURCE_ID,
    CATEGORY_SOURCE_ID,
  ],
  load: () => ({
    sources: [summarySource, locationSource, runtimeTrendSource, categorySource],
  }),
}

export default deviceMonitoringProvider
