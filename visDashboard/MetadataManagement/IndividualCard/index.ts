import { defineAsyncComponent } from 'vue'
import { individualCardConfig } from './config'

const IndividualCard = {
  name: 'individualCard',
  component: defineAsyncComponent(() => import('./IndividualCard.vue'))
}

const IndividualCardConfig = [
  {
    name: 'individualCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const IndividualCardConfigProps = {
  ...individualCardConfig
}

export { IndividualCard, IndividualCardConfig, IndividualCardConfigProps }
