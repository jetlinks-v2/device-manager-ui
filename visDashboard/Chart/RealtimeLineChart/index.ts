import { defineAsyncComponent } from 'vue'
import { realtimeLineChartConfig } from './config'

const RealtimeLineChart = {
  name: 'realtimeLineChart',
  component: defineAsyncComponent(() => import('./RealtimeLineChart.vue'))
}

const RealtimeLineChartConfig = [
  {
    name: 'realtimeLineChart',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const RealtimeLineChartConfigProps = {
  ...realtimeLineChartConfig
}

export { RealtimeLineChart, RealtimeLineChartConfig, RealtimeLineChartConfigProps }
