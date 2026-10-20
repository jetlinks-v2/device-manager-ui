import { defineAsyncComponent } from 'vue'
import type { DashboardConfigEntry } from '@jetlinks-web-core/components/DashBoardCanvas'
import { config } from './config'

export const SystemMonitorCpuTrend = { name: config.type, component: defineAsyncComponent(() => import('./CpuTrend.vue')) }
// Match overview: live widgets support personal layout editing without a business-config drawer.
export const SystemMonitorCpuTrendConfig: DashboardConfigEntry[] = []
export const SystemMonitorCpuTrendConfigProps = config
