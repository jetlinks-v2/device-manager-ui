import { defineAsyncComponent } from 'vue'
import type { DashboardConfigEntry } from '@jetlinks-web-core/components/DashBoardCanvas'
import { config } from './config'

export const SystemMonitorNetworkTrend = { name: config.type, component: defineAsyncComponent(() => import('./NetworkTrend.vue')) }
// Match overview: live widgets support personal layout editing without a business-config drawer.
export const SystemMonitorNetworkTrendConfig: DashboardConfigEntry[] = []
export const SystemMonitorNetworkTrendConfigProps = config
