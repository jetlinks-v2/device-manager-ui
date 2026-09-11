import { defineAsyncComponent } from 'vue'
import { propertyPieConfig } from './config'

const PropertyPie = {
  name: 'propertyPie',
  component: defineAsyncComponent(() => import('./PropertyPie.vue'))
}

const PropertyPieConfig = [
  {
    name: 'propertyPie',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyPieConfigProps = {
  ...propertyPieConfig
}

export { PropertyPie, PropertyPieConfig, PropertyPieConfigProps }
