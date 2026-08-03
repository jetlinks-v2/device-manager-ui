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
  loadDeviceDetail,
  loadDeviceDetailPage,
  loadDeviceStates,
} from './deviceInstanceMonitoring.service'
import type {
  DeviceDetailPageData,
  DeviceDetailPageQuery,
  DeviceDetailQuery,
  DeviceStateBatchQuery,
} from './deviceInstanceMonitoring.types'
import type {
  DeviceMonitoringScope,
  DeviceMonitoringState,
} from './deviceMonitoring.types'

const MODULE_ID = 'device-manager-ui'
const PROVIDER_ID = 'device-manager:instance-monitoring'
const STATE_BATCH_SOURCE_ID = 'device.state.batch'
const DETAIL_SOURCE_ID = 'device.detail'
const DETAIL_PAGE_SOURCE_ID = 'device.detail.page'
const MAX_DEVICE_IDS = 200
const DEFAULT_PAGE_INDEX = 0
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 200
const STATES: DeviceMonitoringState[] = ['online', 'offline', 'notActive']
const SCOPES: DeviceMonitoringScope[] = ['iot']

const owner = { moduleId: MODULE_ID, providerId: PROVIDER_ID }
const t = (key: string) => String(i18n.global.t(key))
const objectOutputSchema = { type: 'object' as const }
const arrayOutputSchema = { type: 'array' as const, items: objectOutputSchema }

const stateBatchSource: DataSourceDefinition = {
  id: STATE_BATCH_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceInstanceDataCapability.state.name'),
  description: t('DeviceInstanceDataCapability.state.description'),
  owner,
  tags: ['device', 'state', 'batch'],
  facets: { category: 'device-instance-monitoring' },
  modes: ['snapshot'],
  querySchema: {
    type: 'object',
    required: ['deviceIds'],
    properties: {
      deviceIds: {
        type: 'array',
        items: { type: 'string' },
        title: t('DeviceInstanceDataCapability.query.deviceIds'),
      },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceStates(
        toStateBatchQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

const detailSource: DataSourceDefinition = {
  id: DETAIL_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceInstanceDataCapability.detail.name'),
  description: t('DeviceInstanceDataCapability.detail.description'),
  owner,
  tags: ['device', 'detail'],
  facets: { category: 'device-instance-monitoring' },
  modes: ['snapshot'],
  querySchema: {
    type: 'object',
    required: ['deviceId'],
    properties: {
      deviceId: {
        type: 'string',
        title: t('DeviceInstanceDataCapability.query.deviceId'),
      },
    },
  },
  outputSchema: objectOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceDetail(
        toDetailQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

const detailPageSource: DataSourceDefinition = {
  id: DETAIL_PAGE_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceInstanceDataCapability.detailPage.name'),
  description: t('DeviceInstanceDataCapability.detailPage.description'),
  owner,
  tags: ['device', 'detail', 'page'],
  facets: { category: 'device-instance-monitoring' },
  modes: ['page', 'snapshot'],
  querySchema: {
    type: 'object',
    properties: {
      pageIndex: { type: 'integer', default: DEFAULT_PAGE_INDEX },
      pageSize: { type: 'integer', default: DEFAULT_PAGE_SIZE },
      state: { type: 'string', enum: STATES },
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
      return defer(() => loadDeviceDetailPage(
        toDetailPageQuery(request),
        request.signal || context.signal,
      )).pipe(map(page => toPageResult<T>(page)))
    },
  }),
}

function toStateBatchQuery(request: DataSourceRequest): DeviceStateBatchQuery {
  const deviceIds = uniqueTexts(request.query?.deviceIds)
  if (!deviceIds.length || deviceIds.length > MAX_DEVICE_IDS) {
    throw new Error(t('DeviceInstanceDataCapability.error.invalidDeviceIds'))
  }
  return { deviceIds }
}

function toDetailQuery(request: DataSourceRequest): DeviceDetailQuery {
  const deviceId = optionalText(request.query?.deviceId)
  if (!deviceId) {
    throw new Error(t('DeviceInstanceDataCapability.error.invalidDeviceId'))
  }
  return { deviceId }
}

function toDetailPageQuery(request: DataSourceRequest): DeviceDetailPageQuery {
  const state = optionalText(request.query?.state)
  if (state && !STATES.includes(state as DeviceMonitoringState)) {
    throw new Error(t('DeviceDataCapability.error.invalidState'))
  }
  const scope = optionalText(request.query?.scope)
  if (scope && !SCOPES.includes(scope as DeviceMonitoringScope)) {
    throw new Error(t('DeviceDataCapability.error.invalidScope'))
  }
  return {
    pageIndex: integerInRange(
      request.query?.pageIndex,
      DEFAULT_PAGE_INDEX,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    pageSize: integerInRange(
      request.query?.pageSize ?? request.limit,
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE,
    ),
    state: state as DeviceMonitoringState | undefined,
    scope: scope as DeviceMonitoringScope | undefined,
  }
}

function toPageResult<T>(page: DeviceDetailPageData): DataSourceResult<T> {
  return {
    data: page.data as T,
    total: page.total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}

function uniqueTexts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error(t('DeviceInstanceDataCapability.error.invalidDeviceIds'))
  }
  return Array.from(new Set(
    value.map(optionalText).filter((item): item is string => Boolean(item)),
  ))
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const valueText = String(value).trim()
  return valueText || undefined
}

function integerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(t('DeviceDataCapability.error.invalidPagination'))
  }
  return number
}

const deviceInstanceMonitoringProvider: DataCapabilityProvider = {
  id: PROVIDER_ID,
  owner,
  capabilityIds: [STATE_BATCH_SOURCE_ID, DETAIL_SOURCE_ID, DETAIL_PAGE_SOURCE_ID],
  load: () => ({
    sources: [stateBatchSource, detailSource, detailPageSource],
  }),
}

export default deviceInstanceMonitoringProvider
