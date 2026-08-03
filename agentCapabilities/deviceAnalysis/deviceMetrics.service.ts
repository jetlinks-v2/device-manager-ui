import {
  createDomainAgentAggregateCardinality,
  createDomainAgentClaim,
  createDomainAgentErrorResult,
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  DomainAgentInputError,
  resolveDomainAgentTimeRange,
  resolveDomainAgentMessage,
  type DomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { countDevice_api } from '@device-manager-ui/api/device'
import {
  getDeviceSummary_api,
  queryAllDeviceMetricTrend_api,
  type DeviceGroupTrendPoint,
} from '@device-manager-ui/api/deviceGroup'
import { buildDeviceAnalysisSearchTerms } from './deviceAnalysisScope'

const run = async <T>(
  data: T,
  action: () => Promise<DomainAgentToolResult<T>>,
): Promise<DomainAgentToolResult<T>> => {
  try {
    return await action()
  } catch (error) {
    if (error instanceof DomainAgentInputError) throw error
    return createDomainAgentErrorResult('device', data, error)
  }
}

const trendSummary = (points: DeviceGroupTrendPoint[]) => {
  const first = points[0]
  const last = points.at(-1)
  const peak = points.reduce<DeviceGroupTrendPoint | undefined>((result, point) => (
    !result || point.value > result.value ? point : result
  ), undefined)
  return {
    bucketCount: points.length,
    first: first?.value,
    last: last?.value,
    change: first && last ? last.value - first.value : undefined,
    peak: peak ? { label: peak.label, value: peak.value, timestamp: peak.timestamp } : undefined,
  }
}

const trendInputs = (args: Record<string, unknown>) => resolveDomainAgentTimeRange(args)

export const deviceMetricsService = {
  stateSummary: (args: Record<string, unknown>) => run<Record<string, unknown>>({}, async () => {
    const terms = await buildDeviceAnalysisSearchTerms(args)
    const summary = await getDeviceSummary_api({ terms })
    // Newer summary APIs include notActive; older deployments only expose it through the count endpoint.
    const disabled = summary.notActive ?? await countDevice_api({
      terms: [...terms, { column: 'state', termType: 'eq', value: 'notActive' }],
    })
    const total = Number(summary.total || summary.deviceCount || 0)
    const data = {
      snapshotAt: Date.now(),
      total,
      online: Number(summary.online || 0),
      offline: Number(summary.offline || 0),
      disabled,
      noData: Number(summary.noData || 0),
      onlineRate: Number(summary.onlineRate || (total ? (summary.online / total) * 100 : 0)),
    }
    return createDomainAgentToolResult({
      domain: 'device',
      filters: {
        productId: args.productId,
        productName: args.productName,
        area: args.area,
        group: args.group,
      },
      summary: data,
      facts: data,
      claims: [
        createDomainAgentClaim('deviceTotal', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.deviceTotal'), data.total, 'integer'),
        createDomainAgentClaim('onlineDevices', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.onlineDevices'), data.online, 'integer'),
        createDomainAgentClaim('offlineDevices', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.offlineDevices'), data.offline, 'integer'),
        createDomainAgentClaim('onlineRate', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.onlineRate'), data.onlineRate, 'percent'),
      ],
      data,
      total,
      cardinality: createDomainAgentRecordSetCardinality({ returnedCount: total }),
    })
  }),

  onlineRateTrend: (args: Record<string, unknown>) => run<Record<string, unknown>>({}, async () => {
    const timeRange = trendInputs(args)
    const metric = await queryAllDeviceMetricTrend_api('onlineRate', timeRange)
    const summary = trendSummary(metric.points)
    return createDomainAgentToolResult({
      domain: 'device',
      status: metric.points.length ? undefined : 'empty',
      timeRange,
      summary: { metric: 'onlineRate', ...summary },
      facts: { metric: 'onlineRate', ...summary },
      claims: [createDomainAgentClaim(
        'dataPointCount',
        resolveDomainAgentMessage('components.AiChat.domainAgent.claims.dataPointCount'),
        metric.points.length,
        'integer',
      )],
      data: { metric: 'onlineRate', points: metric.points },
      cardinality: createDomainAgentAggregateCardinality({
        bucketCount: metric.points.length,
        populatedBucketCount: metric.points.length,
        measurementCount: metric.points.length,
      }),
    })
  }),

  messageTrend: (args: Record<string, unknown>) => run<Record<string, unknown>>({}, async () => {
    const timeRange = trendInputs(args)
    const metric = await queryAllDeviceMetricTrend_api('uplink', timeRange)
    const totalMessages = metric.points.reduce((total, point) => total + point.value, 0)
    const summary = trendSummary(metric.points)
    return createDomainAgentToolResult({
      domain: 'device',
      status: metric.points.length ? undefined : 'empty',
      timeRange,
      summary: { metric: 'uplinkMessages', totalMessages, ...summary },
      facts: { metric: 'uplinkMessages', totalMessages, ...summary },
      claims: [
        createDomainAgentClaim('messageTotal', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.messageTotal'), totalMessages, 'integer'),
        createDomainAgentClaim('dataPointCount', resolveDomainAgentMessage('components.AiChat.domainAgent.claims.dataPointCount'), metric.points.length, 'integer'),
      ],
      data: { metric: 'uplinkMessages', totalMessages, points: metric.points },
      cardinality: createDomainAgentAggregateCardinality({
        bucketCount: metric.points.length,
        populatedBucketCount: metric.points.length,
        measurementCount: metric.points.length,
      }),
    })
  }),
}
