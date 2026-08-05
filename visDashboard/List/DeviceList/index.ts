import { defineAsyncComponent } from 'vue'
import { deviceListConfig } from './config'

const DeviceList = {
  name: 'deviceList',
  component: defineAsyncComponent(() => import('./DeviceList.vue'))
}

const DeviceListConfig = [
  {
    name: 'deviceList',
    component: defineAsyncComponent(() => import('./Config.vue'))
  }
]

const DeviceListConfigProps = {
  ...deviceListConfig
}

export { DeviceList, DeviceListConfig, DeviceListConfigProps }
