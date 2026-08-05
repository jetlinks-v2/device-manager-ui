import { defineAsyncComponent } from 'vue'
import { deviceCardConfig } from './config'

const DeviceCard = {
  name: 'deviceCard',
  component: defineAsyncComponent(() => import('./DeviceCard.vue'))
}

const DeviceCardConfig = [
  {
    name: 'deviceCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceCardConfigProps = {
  ...deviceCardConfig
}

export { DeviceCard, DeviceCardConfig, DeviceCardConfigProps }
