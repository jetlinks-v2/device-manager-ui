import type { RealtimePropertyRow } from '../../views/device/list/components/device-detail/iotDeviceDetail.types'

export const kinds = ['ActiveDuration', 'Upstream', 'Downstream', 'Traffic', 'MessageTrend', 'Properties', 'RecentAlarms'] as const
export type DeviceDetailKind = typeof kinds[number]
export type { RealtimePropertyRow }
export interface DeviceDetailInfo { type?: string; componentProps?: Record<string, unknown> }
export interface DeviceDetailConfig {
  title: string
  deviceId: string
  refreshSeconds: number
  pageSize: number
  limit: number
}
export interface SummaryPoint { time?: number; value: number }
export interface SummarySeries { total: number; peak: number; buckets: SummaryPoint[] }
export interface OverviewSummary {
  activeDuration: SummarySeries
  upstream: SummarySeries
  downstream: SummarySeries
  traffic: SummarySeries & { upstreamBytes: number; downstreamBytes: number }
}
export interface RecentAlarmRecord {
  id: string; title: string; time: string; duration: string; level: string; trigger: string; summary: string
}
export const typeOf = (kind: DeviceDetailKind) => `deviceDetail${kind}`
export const titleKeys: Record<DeviceDetailKind, string> = {
  ActiveDuration: 'IotDeviceDetail.overview.stat.activeDuration',
  Upstream: 'IotDeviceDetail.overview.stat.todayUpstream',
  Downstream: 'IotDeviceDetail.overview.stat.todayDownstream',
  Traffic: 'IotDeviceDetail.overview.stat.todayTraffic',
  MessageTrend: 'IotDeviceDetail.overview.messageTrendTitle',
  Properties: 'IotDeviceDetail.overview.keyPropertySnapshot',
  RecentAlarms: 'IotDeviceDetail.overview.recentAlarms',
}
export const defaultSettings: DeviceDetailConfig = { title: '', deviceId: '', refreshSeconds: 60, pageSize: 6, limit: 4 }

/** 配置归一化防止无效间隔产生高频轮询，0表示只在进入、切换和重试时刷新。 */
export function settingsOf(kind: DeviceDetailKind, info?: DeviceDetailInfo): DeviceDetailConfig {
  const raw = info?.componentProps?.[typeOf(kind)] as Partial<DeviceDetailConfig> | undefined
  const seconds = Number(raw?.refreshSeconds ?? defaultSettings.refreshSeconds)
  return {
    title: typeof raw?.title === 'string' ? raw.title : '',
    deviceId: typeof raw?.deviceId === 'string' ? raw.deviceId.trim() : '',
    refreshSeconds: Number.isFinite(seconds) ? seconds === 0 ? 0 : Math.max(15, Math.min(3600, seconds)) : 60,
    pageSize: Math.max(1, Math.min(12, Math.floor(Number(raw?.pageSize) || 6))),
    limit: Math.max(1, Math.min(20, Math.floor(Number(raw?.limit) || 4))),
  }
}
