import i18n from '@jetlinks-web-core/locales'
import type {
  CapabilityOption,
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceRequest,
  DataSourceResult,
  OptionSourceDefinition,
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
const GROUP_OPTION_SOURCE_ID = 'device.group.options'

const DEFAULT_GROUP_LIMIT = 5
const MAX_GROUP_LIMIT = 100
const MAX_GROUP_IDS = 100
const DEFAULT_PAGE_INDEX = 0
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 200

const owner = { moduleId: MODULE_ID, providerId: PROVIDER_ID }
const t = (key: string) => String(i18n.global.t(key))
const textOutput = (key: string) => ({
  type: 'string' as const,
  title: t(`DeviceGroupDataCapability.output.${key}`),
})
const numberOutput = (key: string) => ({
  type: 'number' as const,
  title: t(`DeviceGroupDataCapability.output.${key}`),
})
const integerOutput = (key: string, format?: string) => ({
  type: 'integer' as const,
  title: t(`DeviceGroupDataCapability.output.${key}`),
  ...(format ? { format } : {}),
})
const groupOptionRef = {
  type: 'provider' as const,
  capability: { capabilityId: GROUP_OPTION_SOURCE_ID, version: 1 },
}
const groupListOutputSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      groupId: textOutput('groupId'),
      groupName: textOutput('groupName'),
    },
  },
}
const groupSummaryOutputSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      groupId: textOutput('groupId'),
      total: integerOutput('total'),
      online: integerOutput('online'),
      offline: integerOutput('offline'),
      notActive: integerOutput('notActive'),
      onlineRate: numberOutput('onlineRate'),
    },
  },
}
const groupDevicesOutputSchema = {
  type: 'array' as const,
  items: {
    type: 'object' as const,
    properties: {
      deviceId: textOutput('deviceId'),
      identifier: textOutput('identifier'),
      deviceName: textOutput('deviceName'),
      productName: textOutput('productName'),
      state: textOutput('state'),
      lastReportTime: integerOutput('lastReportTime', 'timestamp-ms'),
    },
  },
}

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
      limit: {
        type: 'integer',
        default: DEFAULT_GROUP_LIMIT,
        title: t('DeviceGroupDataCapability.query.limit'),
      },
    },
  },
  outputSchema: groupListOutputSchema,
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
        description: t('DeviceGroupDataCapability.query.groupIdsDescription'),
        optionSource: groupOptionRef,
      },
    },
  },
  outputSchema: groupSummaryOutputSchema,
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
      groupId: {
        type: 'string',
        title: t('DeviceGroupDataCapability.query.groupId'),
        description: t('DeviceGroupDataCapability.query.groupIdDescription'),
        optionSource: groupOptionRef,
      },
    },
  },
  outputSchema: groupDevicesOutputSchema,
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
    keyword: optionalText(request.query?.keyword),
  }
}

const groupOptionSource: OptionSourceDefinition = {
  id: GROUP_OPTION_SOURCE_ID,
  kind: 'option-source',
  version: 1,
  name: t('DeviceGroupDataCapability.options.name'),
  owner,
  query: async (request): Promise<{ options: CapabilityOption[]; total: number }> => {
    const groups = await loadDeviceGroups({
      limit: MAX_GROUP_LIMIT,
      keyword: optionalText(request.keyword),
    }, request.signal)
    return {
      options: groups.map(group => ({ label: group.groupName, value: group.groupId })),
      total: groups.length,
    }
  },
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
    GROUP_OPTION_SOURCE_ID,
  ],
  load: () => ({
    sources: [groupListSource, groupSummaryBatchSource, groupDevicesPageSource],
    optionSources: [groupOptionSource],
  }),
}

export default deviceGroupMonitoringProvider
