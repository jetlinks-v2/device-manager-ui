import { defineAsyncComponent } from 'vue'
import { config } from './config'
export const DeviceDetailRecentAlarms = { name: config.type, component: defineAsyncComponent(() => import('./RecentAlarms.vue')) }
export const DeviceDetailRecentAlarmsConfig = [{ name: config.type, direct: true, component: defineAsyncComponent(() => import('../components/DeviceDetailConfig.vue')) }]
export const DeviceDetailRecentAlarmsConfigProps = config
