import { defineAsyncComponent } from 'vue'
import type { DashboardConfigEntry } from '@jetlinks-web-core/components/DashBoardCanvas'
import { config } from './config'

export const SystemMonitorRealtimeResources = { name: config.type, component: defineAsyncComponent(() => import('./RealtimeResources.vue')) }
// Match overview: live widgets support personal layout editing without a business-config drawer.
export const SystemMonitorRealtimeResourcesConfig: DashboardConfigEntry[] = []
export const SystemMonitorRealtimeResourcesConfigProps = config
