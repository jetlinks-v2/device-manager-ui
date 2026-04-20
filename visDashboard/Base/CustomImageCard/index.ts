import { defineAsyncComponent } from 'vue'
import { customImageCardConfig } from './config'

const CustomImageCard = {
  name: 'customImageCard',
  component: defineAsyncComponent(() => import('./CustomImageCard.vue'))
}

const CustomImageCardConfig = [
  {
    name: 'customImageCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const CustomImageCardConfigProps = {
  ...customImageCardConfig
}

export { CustomImageCard, CustomImageCardConfig, CustomImageCardConfigProps }
