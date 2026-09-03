import { defineAsyncComponent } from 'vue'
import { propertySignalConfig } from './config'

const PropertySignal = {
  name: 'propertySignal',
  component: defineAsyncComponent(() => import('./PropertySignal.vue'))
}

const PropertySignalConfig = [
  {
    name: 'propertySignal',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertySignalConfigProps = {
  ...propertySignalConfig
}

export { PropertySignal, PropertySignalConfig, PropertySignalConfigProps }
