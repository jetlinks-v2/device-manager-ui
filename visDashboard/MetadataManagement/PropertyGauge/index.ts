import { defineAsyncComponent } from 'vue'
import { propertyGaugeConfig } from './config'

const PropertyGauge = {
  name: 'propertyGauge',
  component: defineAsyncComponent(() => import('./PropertyGauge.vue'))
}

const PropertyGaugeConfig = [
  {
    name: 'propertyGauge',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyGaugeConfigProps = {
  ...propertyGaugeConfig
}

export { PropertyGauge, PropertyGaugeConfig, PropertyGaugeConfigProps }
