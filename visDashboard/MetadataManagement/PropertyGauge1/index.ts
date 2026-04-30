import { defineAsyncComponent } from 'vue'
import { propertyGauge1Config } from './config'

const PropertyGauge1 = {
  name: 'propertyGauge1',
  component: defineAsyncComponent(() => import('./PropertyGauge1.vue'))
}

const PropertyGauge1Config = [
  {
    name: 'propertyGauge1',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyGauge1ConfigProps = {
  ...propertyGauge1Config
}

export { PropertyGauge1, PropertyGauge1Config, PropertyGauge1ConfigProps }
