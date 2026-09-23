import { useDashboardData } from '@jetlinks-web-core/components/DashBoardCanvas/runtime'
import type { Ref } from 'vue'
import type { GaugeDataItem, GaugeWidgetProps } from '../shared'

type GaugeDashboardProps = Readonly<GaugeWidgetProps>

interface GaugeDashboardDataResult {
  dataSourceList: Ref<GaugeDataItem[]>
  getValue: (record: GaugeDataItem) => unknown
  setValue: (record: GaugeDataItem, value: unknown) => void
}

export const useGaugeDashboardData = (props: GaugeDashboardProps, componentKey: string): GaugeDashboardDataResult =>
  useDashboardData(props, componentKey)
