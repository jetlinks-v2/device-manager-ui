import { defineAsyncComponent } from 'vue'
import { messageVolumeCardConfig } from './config'

const MessageVolumeCard = {
  name: 'messageVolumeCard',
  component: defineAsyncComponent(() => import('./MessageVolumeCard.vue'))
}

const MessageVolumeCardConfig = [
  {
    name: 'messageVolumeCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const MessageVolumeCardConfigProps = {
  ...messageVolumeCardConfig
}

export { MessageVolumeCard, MessageVolumeCardConfig, MessageVolumeCardConfigProps }
