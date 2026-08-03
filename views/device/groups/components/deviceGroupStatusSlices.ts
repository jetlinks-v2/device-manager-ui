import type { DeviceGroupSummary } from '@device-manager-ui/api/deviceGroup'

import type { GroupDashboardStatusSlice } from './groupDetailDashboard.types'

type Translate = (key: string, params?: Record<string, unknown>) => string

function statusSliceDescription(
  t: Translate,
  value: number,
  label: string,
) {
  return value
    ? t('IotDeviceGroups.statusSlice.description', { value, label })
    : t('IotDeviceGroups.statusSlice.empty', { label })
}

function createStatusSlice(
  key: GroupDashboardStatusSlice['key'],
  label: string,
  value: number,
  total: number,
  tone: GroupDashboardStatusSlice['tone'],
  t: Translate,
): GroupDashboardStatusSlice {
  return {
    key,
    label,
    value,
    tone,
    share: Math.round((value / Math.max(total, 1)) * 1000) / 10,
    description: statusSliceDescription(t, value, label),
  }
}

function resolveNotActiveCount(summary: DeviceGroupSummary) {
  const total = summary.deviceCount || summary.total || 0
  if (typeof summary.notActive === 'number') return summary.notActive

  // 旧 summary 只返回在线/离线数量；禁用数按总数差值兜底，匹配设备明细 state=notActive。
  return Math.max(total - summary.online - summary.offline, 0)
}

export function buildDeviceGroupStatusSlices(input: {
  summary: DeviceGroupSummary
  t: Translate
}): GroupDashboardStatusSlice[] {
  const { summary, t } = input
  const total = summary.deviceCount || summary.total || 0

  return [
    createStatusSlice('online', t('IotDeviceGroups.status.online'), summary.online, total, 'ok', t),
    createStatusSlice('offline', t('IotDeviceGroups.status.offline'), summary.offline, total, 'err', t),
    createStatusSlice('notActive', t('IotDeviceGroups.status.notActive'), resolveNotActiveCount(summary), total, 'warn', t),
  ]
}
