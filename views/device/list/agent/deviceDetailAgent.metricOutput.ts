import i18n from '@jetlinks-web-core/locales'
import { clientToolOutput } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'

const t = (key: string) => i18n.global.t(`IotDeviceDetailAgent.${key}`)

const DEVICE_METRIC_ORDERING = {
  keys: [{ field: 'time', direction: 'asc' as const }],
  producerGuaranteed: true,
}

const measureField = (
  name: string,
  labelKey: string,
  measure: string,
  unit: string,
  unitLabelKey: string,
  options?: { format?: 'integer' | 'decimal'; type?: 'number' | 'integer' },
) => ({
  name,
  type: options?.type ?? 'number' as const,
  role: 'measure' as const,
  label: t(labelKey),
  measure,
  unit,
  unitLabel: t(unitLabelKey),
  aggregation: 'sum' as const,
  ...(options?.format ? { format: options.format } : {}),
})

export type DeviceMetricToolId =
  | 'device_activity_aggregate'
  | 'device_message_aggregate'
  | 'device_traffic_aggregate'

export const deviceMetricSeriesName = <T extends DeviceMetricToolId>(id: T): `${T}-series` => (
  `${id}-series`
)

/**
 * Keep device metrics renderer-neutral at the domain boundary. The shared presentation compiler owns ECharts
 * materialization; these tools only publish the observed time-series fields and their semantics.
 */
export const createDeviceMetricOutput = (
  id: DeviceMetricToolId,
) => {
  const fields = id === 'device_activity_aggregate'
    ? [
      measureField('value', 'metrics.activeDuration', 'active_duration', 'h', 'units.hours'),
    ]
    : id === 'device_message_aggregate'
      ? [
        measureField('upstream', 'metrics.upstreamMessages', 'upstream_messages', 'count', 'units.messages', {
          format: 'integer',
          type: 'integer',
        }),
        measureField('downstream', 'metrics.downstreamMessages', 'downstream_messages', 'count', 'units.messages', {
          format: 'integer',
          type: 'integer',
        }),
      ]
      : [
        measureField('upstream', 'metrics.upstreamTraffic', 'upstream_traffic', 'MB', 'units.megabytes'),
        measureField('downstream', 'metrics.downstreamTraffic', 'downstream_traffic', 'MB', 'units.megabytes'),
      ]
  const timeField = {
    name: 'time', type: 'timestamp' as const, role: 'temporal_dimension' as const,
    axis: 'time', encoding: 'epoch-millis' as const, format: 'datetime',
  }
  const declaredFields = [timeField, ...fields]
  return clientToolOutput.aggregateSeries({
    name: deviceMetricSeriesName(id),
    shape: 'metric.time-series',
    label: t(`tools.${id}.name`),
    delivery: 'auto',
    optional: true,
    select: (result: { data?: { points?: unknown } }) => (
      Array.isArray(result?.data?.points) ? result.data.points : []
    ),
    recordPath: '$',
    fields: [timeField],
    resolveFields: () => declaredFields.map(field => ({ ...field })),
    ordering: DEVICE_METRIC_ORDERING,
  })
}
