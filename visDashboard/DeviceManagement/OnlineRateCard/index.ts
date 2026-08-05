import { defineAsyncComponent } from 'vue'
import { onlineRateCardConfig } from './config'

const OnlineRateCard = {
  name: 'onlineRateCard',
  component: defineAsyncComponent(() => import('./OnlineRateCard.vue'))
}

const OnlineRateCardConfig = [
  {
    name: 'onlineRateCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const OnlineRateCardConfigProps = {
  ...onlineRateCardConfig
}

export { OnlineRateCard, OnlineRateCardConfig, OnlineRateCardConfigProps }
