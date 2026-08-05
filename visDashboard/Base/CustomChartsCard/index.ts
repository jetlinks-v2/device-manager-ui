import { defineAsyncComponent } from 'vue'
import { customChartsCardConfig } from './config'

const CustomChartsCard = {
  name: 'customChartsCard',
  component: defineAsyncComponent(() => import('./CustomChartsCard.vue'))
}

const CustomChartsCardConfig = [
  {
    name: 'customChartsCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const CustomChartsCardConfigProps = {
  ...customChartsCardConfig
}

export { CustomChartsCard, CustomChartsCardConfig, CustomChartsCardConfigProps }
