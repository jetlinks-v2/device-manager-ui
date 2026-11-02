import i18n from '@jetlinks-web-core/locales'
import type { AiClientToolOutputField } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'

/** Home and general queries expose the same message metric to charts and reports. */
export const createDeviceMessageTrendFields = (): AiClientToolOutputField[] => [
  { name: 'timestamp', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding: 'epoch-millis' },
  {
    name: 'value', type: 'integer', role: 'measure',
    label: i18n.global.t('IotGeneralAgent.metrics.uplinkMessages'), format: 'integer',
    measure: 'uplink_messages', unit: 'count',
    unitLabel: i18n.global.t('IotDeviceGroups.unit.message'), aggregation: 'sum',
  },
]
