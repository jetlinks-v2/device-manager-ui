import { defineAsyncComponent } from 'vue'
import { propertySwitchConfig } from './config'

const PropertySwitch = {
  name: 'propertySwitch',
  component: defineAsyncComponent(() => import('./PropertySwitch.vue'))
}

const PropertySwitchConfig = [
  {
    name: 'propertySwitch',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertySwitchConfigProps = {
  ...propertySwitchConfig
}

export { PropertySwitch, PropertySwitchConfig, PropertySwitchConfigProps }
