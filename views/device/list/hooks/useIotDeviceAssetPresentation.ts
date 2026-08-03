import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import { type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { getIotDeviceBusinessStatuses, getIotDeviceConnectionStatus } from './useIotDeviceStatus'
import type { IotDevice, IotDeviceConnectionStatus } from '../types'

dayjs.extend(duration)

type ConnectionStatusMeta = (status: IotDeviceConnectionStatus) => { label: string; tone: string }

export function useIotDeviceAssetPresentation(
  _devices: Ref<IotDevice[]>,
  connectionStatusMeta: ConnectionStatusMeta,
) {
  const { t: $t } = useI18n()
  function connectionStatusOf(device: IotDevice) {
    return connectionStatusMeta(getIotDeviceConnectionStatus(device))
  }

  function alarmText(device: IotDevice) {
    const business = getIotDeviceBusinessStatuses(device)
    if (device.currentFaultCodes?.length) return $t('IotDeviceList.presentation.faultCode', { code: device.currentFaultCodes[0]?.payload.faultCode ?? '--' })
    if (device.alarms.length) return $t('IotDeviceList.presentation.alarmCount', { count: device.alarms.length })
    if (business.includes('no-data')) return $t('IotDeviceMeta.business.noData')
    return $t('IotDeviceDetail.common.none')
  }

  function productNameText(device: IotDevice) {
    return device.productName || '--'
  }

  function areaText(device: IotDevice) {
    return limitedText(areaItems(device))
  }

  function areaFullText(device: IotDevice) {
    return fullText(areaItems(device))
  }

  function groupText(device: IotDevice) {
    return limitedText(groupItems(device))
  }

  function groupFullText(device: IotDevice) {
    return fullText(groupItems(device))
  }

  function areaItems(device: IotDevice) {
    return uniqueTexts([
      ...(device.areaBindings ?? []).map((item) => item.area),
      device.area,
    ])
  }

  function groupItems(device: IotDevice) {
    return uniqueTexts([
      ...(device.groupBindings ?? []).map((item) => item.name),
      device.groupName,
    ])
  }

  function limitedText(values: string[]) {
    if (!values.length) return '--'
    const visible = joinValues(values.slice(0, 2))
    return values.length > 2 ? $t('IotDeviceList.presentation.moreItems', { value: visible, count: values.length }) : visible
  }

  function fullText(values: string[]) {
    return values.length ? joinValues(values) : '--'
  }

  function joinValues(values: string[]) {
    return values.join($t('IotDeviceList.presentation.separator'))
  }

  function uniqueTexts(values: Array<string | undefined>) {
    return [...new Set(values
      .map((value) => String(value ?? '').trim())
      .filter((value) => value && !['--', '未分组', '未设置位置'].includes(value)))]
  }

  function healthScoreOf(device: IotDevice) {
    let score = 96

    const connectionStatus = getIotDeviceConnectionStatus(device)
    const businessStatuses = getIotDeviceBusinessStatuses(device)

    if (connectionStatus === 'offline') score -= 36
    if (connectionStatus === 'disabled') score -= 18
    if (businessStatuses.includes('alarm')) score -= 18
    if (businessStatuses.includes('no-data')) score -= 16
    if (businessStatuses.includes('maintenance')) score -= 10
    if (device.risk === 'watch') score -= 14
    if (device.risk === 'urgent') score -= 32

    score -= Math.min(device.alarms.length * 4, 16)
    score -= Math.min(device.currentFaultCodes?.length ?? 0, 2) * 8

    return Math.max(18, Math.min(98, score))
  }

  function healthToneOf(device: IotDevice): 'good' | 'fair' | 'warn' | 'danger' {
    const score = healthScoreOf(device)
    if (score < 60) return 'danger'
    if (score < 80) return 'warn'
    if (score < 90) return 'fair'
    return 'good'
  }

  function onlineDurationText(device: IotDevice) {
    if (getIotDeviceConnectionStatus(device) !== 'online' || !device.onlineAt) {
      return '--'
    }

    const diff = Math.max(Date.now() - device.onlineAt, 0)
    const value = dayjs.duration(diff)
    const days = Math.floor(value.asDays())
    const hours = value.hours()
    const minutes = value.minutes()

    if (days > 0) return $t('IotDeviceList.presentation.durationDaysHours', { days, hours })
    if (hours > 0) return $t('IotDeviceList.presentation.durationHoursMinutes', { hours, minutes })
    return $t('IotDeviceList.presentation.durationMinutes', { minutes: Math.max(minutes, 1) })
  }

  function lastSeenText(device: IotDevice) {
    return device.lastSeen || '--'
  }

  return {
    connectionStatusOf,
    alarmText,
    productNameText,
    areaText,
    areaFullText,
    groupText,
    groupFullText,
    healthScoreOf,
    healthToneOf,
    onlineDurationText,
    lastSeenText,
  }
}
