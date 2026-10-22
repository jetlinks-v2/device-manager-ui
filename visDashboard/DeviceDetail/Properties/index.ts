import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailProperties = { name: config.type, component: defineAsyncComponent(() => import('./Properties.vue')) }
export const DeviceDetailPropertiesConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailPropertiesConfigProps = config
