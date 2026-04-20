import { defineAsyncComponent } from 'vue'
import { propertyShowCardConfig } from './config'

const PropertyShowCard = {
  name: 'propertyShowCard',
  component: defineAsyncComponent(() => import('./PropertyShowCard.vue'))
}

const PropertyShowCardConfig = [
  {
    name: 'propertyShowCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const PropertyShowCardConfigProps = {
  ...propertyShowCardConfig
}

export { PropertyShowCard, PropertyShowCardConfig, PropertyShowCardConfigProps }
