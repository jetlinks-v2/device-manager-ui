import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailUpstream = { name: config.type, component: defineAsyncComponent(() => import('./Upstream.vue')) }
export const DeviceDetailUpstreamConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailUpstreamConfigProps = config
