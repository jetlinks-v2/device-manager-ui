import { defineAsyncComponent } from 'vue'
import { deviceMessageConfig } from './config'

const DeviceMessage = {
  name: 'deviceMessage',
  component: defineAsyncComponent(() => import('./DeviceMessage.vue'))
}

const DeviceMessageConfig = [
  {
    name: 'deviceMessage',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceMessageConfigProps = {
  ...deviceMessageConfig
}

export { DeviceMessage, DeviceMessageConfig, DeviceMessageConfigProps }
