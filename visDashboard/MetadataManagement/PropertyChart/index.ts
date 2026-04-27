import { defineAsyncComponent } from 'vue'
import { propertyChartConfig } from './config'

const PropertyChart = {
  name: 'propertyChart',
  component: defineAsyncComponent(() => import('./PropertyChart.vue'))
}

const PropertyChartConfig = [
  {
    name: 'propertyChart',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyChartConfigProps = {
  ...propertyChartConfig
}

export { PropertyChart, PropertyChartConfig, PropertyChartConfigProps }
