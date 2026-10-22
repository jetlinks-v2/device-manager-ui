import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailTraffic = { name: config.type, component: defineAsyncComponent(() => import('./Traffic.vue')) }
export const DeviceDetailTrafficConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailTrafficConfigProps = config
