import { defineAsyncComponent } from 'vue'
import { propertyProgressConfig } from './config'

const PropertyProgress = {
  name: 'propertyProgress',
  component: defineAsyncComponent(() => import('./PropertyProgress.vue'))
}

const PropertyProgressConfig = [
  {
    name: 'propertyProgress',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyProgressConfigProps = {
  ...propertyProgressConfig
}

export { PropertyProgress, PropertyProgressConfig, PropertyProgressConfigProps }
