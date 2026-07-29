import i18n from '@jetlinks-web-core/locales'
import type {
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceRequest,
  DataSourceResult,
} from '@jetlinks-web-core/data-capability'
import { defer, map } from 'rxjs'
import {
  loadDeviceLocationList,
  loadDeviceOnlineHistory,
  loadDeviceSummary,
} from './deviceMonitoring.service'
import type {
  DeviceLocationPageData,
  DeviceLocationQuery,
  DeviceMonitoringState,
  DeviceOnlineHistoryQuery,
} from './deviceMonitoring.types'

const MODULE_ID = 'device-manager-ui'
const PROVIDER_ID = 'device-manager:monitoring'
const SUMMARY_SOURCE_ID = 'device.summary'
const LOCATION_SOURCE_ID = 'device.location.list'
const HISTORY_SOURCE_ID = 'device.online.history'

const DEFAULT_PAGE_INDEX = 0
const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 1000
const STATES: DeviceMonitoringState[] = ['online', 'offline', 'notActive']

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
  outputSchema: objectOutputSchema,
  create: () => ({
    query(request, context) {
      return defer(() => loadDeviceSummary(request.signal || context.signal))
        .pipe(map(data => ({ data })))
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
    query(request, context) {
      return defer(() => loadDeviceLocationList(
        toLocationQuery(request),
        request.signal || context.signal,
      )).pipe(map(toPageResult))
    },
  }),
}

const historySource: DataSourceDefinition = {
  id: HISTORY_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceDataCapability.history.name'),
  description: t('DeviceDataCapability.history.description'),
  owner,
  tags: ['device', 'online', 'history'],
  facets: { category: 'device-monitoring' },
  modes: ['snapshot'],
  querySchema: {
    type: 'object',
    properties: {
      startTime: { type: 'integer', title: t('DeviceDataCapability.query.startTime') },
      endTime: { type: 'integer', title: t('DeviceDataCapability.query.endTime') },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query(request, context) {
      return defer(() => loadDeviceOnlineHistory(
        toHistoryQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data })))
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

function toHistoryQuery(request: DataSourceRequest): DeviceOnlineHistoryQuery {
  const startTime = optionalTimestamp(request.query?.startTime)
  const endTime = optionalTimestamp(request.query?.endTime)
  if (startTime !== undefined && endTime !== undefined && startTime > endTime) {
    throw new Error(t('DeviceDataCapability.error.invalidTimeRange'))
  }
  return { startTime, endTime }
}

function toPageResult(page: DeviceLocationPageData): DataSourceResult<DeviceLocationPageData['data']> {
  return {
    data: page.data,
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
  capabilityIds: [SUMMARY_SOURCE_ID, LOCATION_SOURCE_ID, HISTORY_SOURCE_ID],
  load: () => ({ sources: [summarySource, locationSource, historySource] }),
}

export default deviceMonitoringProvider
