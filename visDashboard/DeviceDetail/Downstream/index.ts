import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailDownstream = { name: config.type, component: defineAsyncComponent(() => import('./Downstream.vue')) }
export const DeviceDetailDownstreamConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailDownstreamConfigProps = config
