import { defineAsyncComponent } from 'vue'
import { propertyBatteryConfig } from './config'

const PropertyBattery = {
  name: 'propertyBattery',
  component: defineAsyncComponent(() => import('./PropertyBattery.vue'))
}

const PropertyBatteryConfig = [
  {
    name: 'propertyBattery',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyBatteryConfigProps = {
  ...propertyBatteryConfig
}

export { PropertyBattery, PropertyBatteryConfig, PropertyBatteryConfigProps }
