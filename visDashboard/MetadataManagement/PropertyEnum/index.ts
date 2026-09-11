import { defineAsyncComponent } from 'vue'
import { propertyEnumConfig } from './config'

const PropertyEnum = {
  name: 'propertyEnum',
  component: defineAsyncComponent(() => import('./PropertyEnum.vue'))
}

const PropertyEnumConfig = [
  {
    name: 'propertyEnum',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyEnumConfigProps = {
  ...propertyEnumConfig
}

export { PropertyEnum, PropertyEnumConfig, PropertyEnumConfigProps }
