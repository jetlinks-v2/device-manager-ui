import { defineAsyncComponent } from 'vue'
import { propertyLineConfig } from './config'

const PropertyLine = {
  name: 'propertyLine',
  component: defineAsyncComponent(() => import('./PropertyLine.vue'))
}

const PropertyLineConfig = [
  {
    name: 'propertyLine',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyLineConfigProps = {
  ...propertyLineConfig
}

export { PropertyLine, PropertyLineConfig, PropertyLineConfigProps }
