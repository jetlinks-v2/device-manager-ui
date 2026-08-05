import { defineAsyncComponent } from 'vue'
import { onlineCountCardConfig } from './config'

const OnlineCountCard = {
  name: 'onlineCountCard',
  component: defineAsyncComponent(() => import('./OnlineCountCard.vue'))
}

const OnlineCountCardConfig = [
  {
    name: 'onlineCountCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const OnlineCountCardConfigProps = {
  ...onlineCountCardConfig
}

export { OnlineCountCard, OnlineCountCardConfig, OnlineCountCardConfigProps }
