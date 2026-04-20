import { defineAsyncComponent } from 'vue'
import { eventShowCardConfig } from './config'

const EventShowCard = {
  name: 'eventShowCard',
  component: defineAsyncComponent(() => import('./EventShowCard.vue'))
}

const EventShowCardConfig = [
  {
    name: 'eventShowCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const EventShowCardConfigProps = {
  ...eventShowCardConfig
}

export { EventShowCard, EventShowCardConfig, EventShowCardConfigProps }
