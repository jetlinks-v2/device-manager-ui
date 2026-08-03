import i18n from '@jetlinks-web-core/locales'
import type { DeviceGroupSummary } from '@device-manager-ui/api/deviceGroup'

import type { GroupDashboardEvent } from './groupDetailDashboard.types'
import type { GroupDetailDeviceRow } from './groupDetail.types'
import type { GroupItem } from './iotDeviceGroupsPage.types'

const $t = i18n.global.t

export function buildAreaHealthEvents(
  rows: GroupDetailDeviceRow[],
  group: GroupItem,
  summary?: DeviceGroupSummary,
): GroupDashboardEvent[] {
  const total = summary?.deviceCount ?? summary?.total ?? rows.length
  const offlineCount = summary
    ? summary.offline + summary.noData
    : rows.filter((item) => item.status === 'offline' || item.status === 'no-data').length
  const attentionCount = summary
    ? summary.watch + summary.offline + summary.noData
    : rows.filter((item) => item.risk === 'watch' || item.status !== 'online').length
  const onlineCount = summary?.online ?? rows.filter((item) => item.status === 'online').length
  const groupSeed = group.sourceId || group.id
  const areaLabel = group.area?.name || group.name
  const sampleDevice = rows.find((item) => item.status !== 'online') || rows[seededNumber(`${groupSeed}-area-device`, rows.length)]
  const recoveredCount = Math.min(onlineCount, 1 + seededNumber(`${groupSeed}-area-recovered`, 3))

  return [
    {
      id: 'area-health-score-down',
      timeLabel: '10:30',
      title: $t('IotDeviceGroups.healthEvent.areaScoreTitle'),
      summary: attentionCount
        ? $t('IotDeviceGroups.healthEvent.areaScoreDownSummary', { area: areaLabel, count: attentionCount })
        : $t('IotDeviceGroups.healthEvent.areaScoreStableSummary', { area: areaLabel }),
      tone: attentionCount ? 'warn' : 'ok',
    },
    {
      id: 'area-connection-health',
      timeLabel: '09:45',
      title: $t('IotDeviceGroups.healthEvent.connectionTitle'),
      summary: offlineCount
        ? $t('IotDeviceGroups.healthEvent.areaConnectionRiskSummary', { count: offlineCount })
        : $t('IotDeviceGroups.healthEvent.areaConnectionStableSummary', { count: total }),
      tone: offlineCount ? 'err' : 'ok',
    },
    {
      id: 'area-device-focus',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '16:20' }),
      title: $t('IotDeviceGroups.healthEvent.focusTitle'),
      summary: sampleDevice && attentionCount
        ? $t('IotDeviceGroups.healthEvent.areaFocusDeviceSummary', { device: sampleDevice.name })
        : $t('IotDeviceGroups.healthEvent.areaFocusStableSummary', { count: onlineCount }),
      tone: attentionCount ? 'warn' : 'ok',
    },
    {
      id: 'area-health-recovered',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '11:05' }),
      title: $t('IotDeviceGroups.healthEvent.recoveredTitle'),
      summary: recoveredCount
        ? $t('IotDeviceGroups.healthEvent.recoveredSummary', { count: recoveredCount })
        : $t('IotDeviceGroups.healthEvent.recoveredEmpty'),
      tone: recoveredCount ? 'ok' : 'info',
    },
  ]
}

export function buildTypeHealthEvents(summary: DeviceGroupSummary, group: GroupItem): GroupDashboardEvent[] {
  const attentionCount = summary.watch + summary.offline + summary.noData
  const offlineCount = summary.offline + summary.noData
  const groupSeed = group.sourceId || group.id
  const scoreDownCount = attentionCount || seededNumber(`${groupSeed}-health-down`, 4)
  const recoveredCount = Math.min(summary.online, 1 + seededNumber(`${groupSeed}-health-recovered`, 3))
  const sampleDeviceNo = 1000 + seededNumber(`${groupSeed}-device`, 8000)

  return [
    {
      id: 'health-score-down',
      timeLabel: '10:30',
      title: $t('IotDeviceGroups.healthEvent.typeScoreTitle'),
      summary: scoreDownCount
        ? $t('IotDeviceGroups.healthEvent.typeScoreDownSummary', { group: group.name, count: scoreDownCount })
        : $t('IotDeviceGroups.healthEvent.typeScoreStableSummary', { group: group.name }),
      tone: scoreDownCount ? 'warn' : 'ok',
    },
    {
      id: 'health-offline-risk',
      timeLabel: '09:45',
      title: $t('IotDeviceGroups.healthEvent.connectionTitle'),
      summary: offlineCount
        ? $t('IotDeviceGroups.healthEvent.typeConnectionRiskSummary', { count: offlineCount })
        : $t('IotDeviceGroups.healthEvent.typeConnectionStableSummary'),
      tone: offlineCount ? 'err' : 'ok',
    },
    {
      id: 'health-device-focus',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '16:20' }),
      title: $t('IotDeviceGroups.healthEvent.focusTitle'),
      summary: attentionCount
        ? $t('IotDeviceGroups.healthEvent.typeFocusDeviceSummary', { device: `${group.bizTypeMeta?.code || groupSeed}-${sampleDeviceNo}` })
        : $t('IotDeviceGroups.healthEvent.typeFocusStableSummary', { count: summary.online }),
      tone: attentionCount ? 'warn' : 'ok',
    },
    {
      id: 'health-recovered',
      timeLabel: $t('IotDeviceGroups.time.yesterdayTime', { time: '11:05' }),
      title: $t('IotDeviceGroups.healthEvent.recoveredTitle'),
      summary: recoveredCount
        ? $t('IotDeviceGroups.healthEvent.recoveredSummary', { count: recoveredCount })
        : $t('IotDeviceGroups.healthEvent.recoveredEmpty'),
      tone: recoveredCount ? 'ok' : 'info',
    },
  ]
}

function seededNumber(text: string, max: number) {
  if (max <= 0) return 0
  return Math.abs([...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7)) % max
}
