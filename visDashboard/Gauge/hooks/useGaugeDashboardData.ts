import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'
import type { Ref } from 'vue'
import type { GaugeDataItem, GaugeWidgetProps } from '../shared'

type GaugeDashboardProps = Readonly<GaugeWidgetProps>

interface GaugeDashboardDataResult {
  dataSourceList: Ref<GaugeDataItem[]>
  getValue: (record: GaugeDataItem) => unknown
  setValue: (record: GaugeDataItem, value: unknown) => void
}

type DashboardDataHook = (
  props: GaugeDashboardProps,
  componentKey: string
) => GaugeDashboardDataResult

const getDashboardDataHook = () => {
  const { useDashboardData } = moduleRegistry.getResource('visualization-dashboard-ui', 'hooks') as {
    useDashboardData?: DashboardDataHook
  }

  if (!useDashboardData) {
    throw new Error('[device-manager-ui] visualization-dashboard-ui hooks.useDashboardData is not registered')
  }

  return useDashboardData
}

export const useGaugeDashboardData = (props: GaugeDashboardProps, componentKey: string) =>
  getDashboardDataHook()(props, componentKey)
