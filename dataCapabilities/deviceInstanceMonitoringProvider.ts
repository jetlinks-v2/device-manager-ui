import i18n from '@jetlinks-web-core/locales'
import type {
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceRequest,
  RuntimeContext,
} from '@jetlinks-web-core/data-capability'
import { defer, map } from 'rxjs'
import {
  loadDeviceDetail,
  loadDeviceStates,
} from './deviceInstanceMonitoring.service'
import type {
  DeviceDetailQuery,
  DeviceStateBatchQuery,
} from './deviceInstanceMonitoring.types'

const MODULE_ID = 'device-manager-ui'
const PROVIDER_ID = 'device-manager:instance-monitoring'
const STATE_BATCH_SOURCE_ID = 'device.state.batch'
const DETAIL_SOURCE_ID = 'device.detail'
const MAX_DEVICE_IDS = 200

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

const deviceInstanceMonitoringProvider: DataCapabilityProvider = {
  id: PROVIDER_ID,
  owner,
  capabilityIds: [STATE_BATCH_SOURCE_ID, DETAIL_SOURCE_ID],
  load: () => ({
    sources: [stateBatchSource, detailSource],
  }),
}

export default deviceInstanceMonitoringProvider
