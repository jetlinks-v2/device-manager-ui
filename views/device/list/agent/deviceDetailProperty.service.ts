import {
  createDomainAgentClaim,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentMessage,
  resolveDomainAgentInteger,
  resolveDomainAgentStringList,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { deviceAnalysisService } from '../../../../agentCapabilities/deviceAnalysis/deviceAnalysis.service'
import type { IotDevice } from '../types'
import {
  asRecord,
  inputError,
  normalizeText,
  runDetailTool,
  withDeviceDetailModelSample,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'
import {
  iotDeviceDetailRealApi,
  parseMetadata,
} from '../services/iotDeviceDetailReal.service'

export const createDeviceDetailPropertyService = (device: IotDevice) => {
  const withSubject = (args: DeviceDetailAgentArgs) => ({ ...args, deviceId: device.id })

  const modelGet = (args: DeviceDetailAgentArgs) => deviceAnalysisService.getModel(withSubject(args))

  const latestProperties = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    let propertyIds = resolveDomainAgentStringList(args.propertyIds, { name: 'propertyIds', max: 20 })
    if (!propertyIds.length) {
      const limit = resolveDomainAgentInteger(args.limit, { name: 'limit', defaultValue: 10, min: 1, max: 20 })
      const response = await iotDeviceDetailRealApi.getDeviceDetail(device.id)
      const detail = asRecord(asRecord(response).result ?? response)
      const metadata = parseMetadata(detail.metadata || detail.deriveMetadata || detail.productMetadata)
      propertyIds = metadata.properties
        .map(value => normalizeText(asRecord(value).id || asRecord(value).property || asRecord(value).key))
        .filter(Boolean)
        .slice(0, limit)
    }
    if (!propertyIds.length) throw inputError('DEVICE_PROPERTY_REQUIRED', 'propertyListEmpty')
    return deviceAnalysisService.latestProperties({ deviceIds: [device.id], propertyIds })
  })

  const propertyHistorySummary = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const sampleLimit = resolveDomainAgentInteger(args.sampleLimit, {
      name: 'sampleLimit', defaultValue: 3, min: 1, max: 10,
    })
    const result = await deviceAnalysisService.propertyHistory({
      ...withSubject(args),
      pageIndex: 0,
      pageSize: sampleLimit,
    })
    if (result.success === false) return result
    const samples = Array.isArray(result.data) ? result.data : []
    const total = Number(result.total || 0)
    return withDeviceDetailModelSample(createDomainAgentToolResult({
      domain: 'device',
      status: total === 0 ? 'empty' : 'ok',
      timeRange: result.timeRange,
      summary: {
        deviceId: device.id,
        propertyId: normalizeText(args.propertyId),
        total,
        sampleCount: samples.length,
      },
      facts: {
        deviceId: device.id,
        propertyId: normalizeText(args.propertyId),
        total,
        sampleCount: samples.length,
      },
      claims: [createDomainAgentClaim(
        'recordCount',
        resolveDomainAgentMessage('components.AiChat.domainAgent.claims.recordCount'),
        total,
        'integer',
      )],
      data: { total, samples },
      total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: total,
        totalCount: total,
      }),
      supportsAbsenceClaim: result.evidence?.supportsAbsenceClaim,
      warnings: result.warnings,
    }), samples.length)
  })

  return {
    modelGet,
    latestProperties,
    propertyHistorySummary,
    propertyHistory: (
      args: DeviceDetailAgentArgs,
    ) => deviceAnalysisService.propertyHistoryRecords(withSubject(args)),
    propertyAggregate: (args: DeviceDetailAgentArgs) => deviceAnalysisService.propertyAggregate(withSubject(args)),
  }
}
