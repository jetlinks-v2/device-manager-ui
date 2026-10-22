import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailActiveDuration = { name: config.type, component: defineAsyncComponent(() => import('./ActiveDuration.vue')) }
export const DeviceDetailActiveDurationConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailActiveDurationConfigProps = config
