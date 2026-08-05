import { defineAsyncComponent } from 'vue'
import { historyLineChartConfig } from './config'

const HistoryLineChart = {
  name: 'historyLineChart',
  component: defineAsyncComponent(() => import('./HistoryLineChart.vue'))
}

const HistoryLineChartConfig = [
  {
    name: 'historyLineChart',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const HistoryLineChartConfigProps = {
  ...historyLineChartConfig
}

export { HistoryLineChart, HistoryLineChartConfig, HistoryLineChartConfigProps }
