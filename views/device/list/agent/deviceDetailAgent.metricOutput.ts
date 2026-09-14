import i18n from '@jetlinks-web-core/locales'
import { clientToolOutput } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'

const t = (key: string) => i18n.global.t(`IotDeviceDetailAgent.${key}`)

const DEVICE_METRIC_ORDERING = {
  keys: [{ field: 'time', direction: 'asc' as const }],
  producerGuaranteed: true,
}

/**
 * Keep device metrics renderer-neutral at the domain boundary. The shared presentation compiler owns ECharts
 * materialization; these tools only publish the observed time-series fields and their semantics.
 */
export const createDeviceMetricOutput = (
  id: 'device_activity_aggregate' | 'device_message_aggregate' | 'device_traffic_aggregate',
) => {
  const fields = id === 'device_activity_aggregate'
    ? [
      { name: 'value', type: 'number' as const, role: 'measure' as const, label: t('metrics.activeDuration'), measure: 'active_duration', unit: 'ms', aggregation: 'sum' },
    ]
    : id === 'device_message_aggregate'
      ? [
        { name: 'upstream', type: 'number' as const, role: 'measure' as const, label: t('metrics.upstreamMessages'), measure: 'upstream_messages', unit: 'count', aggregation: 'sum' },
        { name: 'downstream', type: 'number' as const, role: 'measure' as const, label: t('metrics.downstreamMessages'), measure: 'downstream_messages', unit: 'count', aggregation: 'sum' },
      ]
      : [
        { name: 'upstreamBytes', type: 'number' as const, role: 'measure' as const, label: t('metrics.upstreamTraffic'), measure: 'upstream_traffic', unit: 'bytes', aggregation: 'sum' },
        { name: 'downstreamBytes', type: 'number' as const, role: 'measure' as const, label: t('metrics.downstreamTraffic'), measure: 'downstream_traffic', unit: 'bytes', aggregation: 'sum' },
      ]
  return clientToolOutput.aggregateSeries({
    name: `${id}-series`,
    shape: 'metric.time-series',
    label: t(`tools.${id}.name`),
    delivery: 'auto',
    select: (result: any) => (Array.isArray(result?.data?.points) ? result.data.points : []),
    recordPath: '$',
    fields: [
      {
        name: 'time', type: 'timestamp' as const, role: 'temporal_dimension' as const,
        axis: 'time', encoding: 'epoch-millis' as const, format: 'datetime',
      },
      ...fields,
    ],
    ordering: DEVICE_METRIC_ORDERING,
  })
}
