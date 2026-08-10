import { formatDeviceTrendAxisLabels } from '@device-manager-ui/api/deviceTrend'

export function formatMessageTrendAxisLabels(values: readonly (number | string | undefined | null)[]) {
  return formatDeviceTrendAxisLabels(values, '1h')
}
