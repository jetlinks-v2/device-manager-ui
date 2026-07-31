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
  loadDeviceGroupDevices,
  loadDeviceGroups,
  loadDeviceGroupSummaries,
} from './deviceGroupMonitoring.service'
import type {
  DeviceGroupDevicePageData,
  DeviceGroupDevicesQuery,
  DeviceGroupListQuery,
  DeviceGroupSummaryBatchQuery,
} from './deviceGroupMonitoring.types'

const MODULE_ID = 'device-manager-ui'
const PROVIDER_ID = 'device-manager:group-monitoring'
const GROUP_LIST_SOURCE_ID = 'device.group.list'
const GROUP_SUMMARY_BATCH_SOURCE_ID = 'device.group.summary.batch'
const GROUP_DEVICES_PAGE_SOURCE_ID = 'device.group.devices.page'

const DEFAULT_GROUP_LIMIT = 5
const MAX_GROUP_LIMIT = 100
const MAX_GROUP_IDS = 100
const DEFAULT_PAGE_INDEX = 0
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 200

const owner = { moduleId: MODULE_ID, providerId: PROVIDER_ID }
const t = (key: string) => String(i18n.global.t(key))
const objectOutputSchema = { type: 'object' as const }
const arrayOutputSchema = { type: 'array' as const, items: objectOutputSchema }

const groupListSource: DataSourceDefinition = {
  id: GROUP_LIST_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceGroupDataCapability.list.name'),
  description: t('DeviceGroupDataCapability.list.description'),
  owner,
  tags: ['device', 'group', 'list'],
  facets: { category: 'device-group-monitoring' },
  modes: ['snapshot'],
  querySchema: {
    type: 'object',
    properties: {
      limit: { type: 'integer', default: DEFAULT_GROUP_LIMIT },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceGroups(
        toGroupListQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

const groupSummaryBatchSource: DataSourceDefinition = {
  id: GROUP_SUMMARY_BATCH_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceGroupDataCapability.summary.name'),
  description: t('DeviceGroupDataCapability.summary.description'),
  owner,
  tags: ['device', 'group', 'summary', 'batch'],
  facets: { category: 'device-group-monitoring' },
  modes: ['snapshot'],
  querySchema: {
    type: 'object',
    required: ['groupIds'],
    properties: {
      groupIds: {
        type: 'array',
        items: { type: 'string' },
        title: t('DeviceGroupDataCapability.query.groupIds'),
      },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceGroupSummaries(
        toGroupSummaryBatchQuery(request),
        request.signal || context.signal,
      )).pipe(map(data => ({ data: data as T })))
    },
  }),
}

const groupDevicesPageSource: DataSourceDefinition = {
  id: GROUP_DEVICES_PAGE_SOURCE_ID,
  kind: 'data-source',
  version: 1,
  name: t('DeviceGroupDataCapability.devices.name'),
  description: t('DeviceGroupDataCapability.devices.description'),
  owner,
  tags: ['device', 'group', 'page'],
  facets: { category: 'device-group-monitoring' },
  modes: ['page', 'snapshot'],
  querySchema: {
    type: 'object',
    required: ['groupId'],
    properties: {
      groupId: { type: 'string', title: t('DeviceGroupDataCapability.query.groupId') },
      pageIndex: { type: 'integer', default: DEFAULT_PAGE_INDEX },
      pageSize: { type: 'integer', default: DEFAULT_PAGE_SIZE },
    },
  },
  outputSchema: arrayOutputSchema,
  create: () => ({
    query<T = unknown>(request: DataSourceRequest, context: RuntimeContext) {
      return defer(() => loadDeviceGroupDevices(
        toGroupDevicesQuery(request),
        request.signal || context.signal,
      )).pipe(map(page => toPageResult<T>(page)))
    },
  }),
}

function toGroupListQuery(request: DataSourceRequest): DeviceGroupListQuery {
  return {
    limit: integerInRange(
      request.query?.limit ?? request.limit,
      DEFAULT_GROUP_LIMIT,
      1,
      MAX_GROUP_LIMIT,
    ),
  }
}

function toGroupSummaryBatchQuery(
  request: DataSourceRequest,
): DeviceGroupSummaryBatchQuery {
  const groupIds = uniqueTexts(request.query?.groupIds)
  if (!groupIds.length || groupIds.length > MAX_GROUP_IDS) {
    throw new Error(t('DeviceGroupDataCapability.error.invalidGroupIds'))
  }
  return { groupIds }
}

function toGroupDevicesQuery(request: DataSourceRequest): DeviceGroupDevicesQuery {
  const groupId = optionalText(request.query?.groupId)
  if (!groupId) throw new Error(t('DeviceGroupDataCapability.error.invalidGroupId'))
  return {
    groupId,
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
  }
}

function toPageResult<T>(
  page: DeviceGroupDevicePageData,
): DataSourceResult<T> {
  return {
    data: page.data as T,
    total: page.total,
    pageIndex: page.pageIndex,
    pageSize: page.pageSize,
  }
}

function uniqueTexts(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error(t('DeviceGroupDataCapability.error.invalidGroupIds'))
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
    throw new Error(t('DeviceGroupDataCapability.error.invalidPagination'))
  }
  return number
}

const deviceGroupMonitoringProvider: DataCapabilityProvider = {
  id: PROVIDER_ID,
  owner,
  capabilityIds: [
    GROUP_LIST_SOURCE_ID,
    GROUP_SUMMARY_BATCH_SOURCE_ID,
    GROUP_DEVICES_PAGE_SOURCE_ID,
  ],
  load: () => ({
    sources: [groupListSource, groupSummaryBatchSource, groupDevicesPageSource],
  }),
}

export default deviceGroupMonitoringProvider
