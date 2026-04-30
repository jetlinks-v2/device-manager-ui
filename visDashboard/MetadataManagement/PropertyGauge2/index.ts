import { defineAsyncComponent } from 'vue'
import { propertyGauge2Config } from './config'

const PropertyGauge2 = {
  name: 'propertyGauge2',
  component: defineAsyncComponent(() => import('./PropertyGauge2.vue'))
}

const PropertyGauge2Config = [
  {
    name: 'propertyGauge2',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyGauge2ConfigProps = {
  ...propertyGauge2Config
}

export { PropertyGauge2, PropertyGauge2Config, PropertyGauge2ConfigProps }
