import { defineAsyncComponent } from 'vue'
import { deviceMapCardConfig } from './config'

const DeviceMapCard = {
  name: 'deviceMapCard',
  component: defineAsyncComponent(() => import('./DeviceMapCard.vue'))
}

const DeviceMapCardConfig = [
  {
    name: 'deviceMapCard',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceMapCardConfigProps = {
  ...deviceMapCardConfig
}

export { DeviceMapCard, DeviceMapCardConfig, DeviceMapCardConfigProps }
