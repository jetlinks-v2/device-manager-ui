import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailMessageTrend = { name: config.type, component: defineAsyncComponent(() => import('./MessageTrend.vue')) }
export const DeviceDetailMessageTrendConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailMessageTrendConfigProps = config
