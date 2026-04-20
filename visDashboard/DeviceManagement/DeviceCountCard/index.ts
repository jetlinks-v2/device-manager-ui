import { defineAsyncComponent } from 'vue'
import { deviceCountCardConfig } from './config'

const DeviceCountCard = {
  name: 'deviceCountCard',
  component: defineAsyncComponent(() => import('./DeviceCountCard.vue'))
}

const DeviceCountCardConfig = [
  {
    name: 'deviceCountCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceCountCardConfigProps = {
  ...deviceCountCardConfig
}

export { DeviceCountCard, DeviceCountCardConfig, DeviceCountCardConfigProps }
