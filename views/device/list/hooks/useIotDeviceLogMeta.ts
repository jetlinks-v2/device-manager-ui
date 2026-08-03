import type { IotDeviceLog, IotDeviceLogLevel } from '../types'
import i18n from '@jetlinks-web-core/locales'

export type IotDeviceLogSource = 'device' | 'event' | 'exception'

export interface IotDeviceLogLevelMeta {
  label: string
  tone: 'normal' | 'warning' | 'error'
}

export interface IotDeviceLogSourceMeta {
  label: string
}

interface IotDeviceLogLevelMetaSource {
  labelKey: string
  tone: 'normal' | 'warning' | 'error'
}

interface IotDeviceLogSourceMetaSource {
  labelKey: string
}

const $t = i18n.global.t

export const IOT_DEVICE_LOG_LEVEL_META: Record<IotDeviceLogLevel, IotDeviceLogLevelMetaSource> = {
  info: { labelKey: 'IotDeviceDetail.logMeta.level.info', tone: 'normal' },
  warning: { labelKey: 'IotDeviceDetail.logMeta.level.warning', tone: 'warning' },
  error: { labelKey: 'IotDeviceDetail.logMeta.level.error', tone: 'error' },
}

export const IOT_DEVICE_LOG_SOURCE_META: Record<IotDeviceLogSource, IotDeviceLogSourceMetaSource> = {
  device: { labelKey: 'IotDeviceDetail.logMeta.source.device' },
  event: { labelKey: 'IotDeviceDetail.logMeta.source.event' },
  exception: { labelKey: 'IotDeviceDetail.logMeta.source.exception' },
}

export const IOT_DEVICE_LOG_LEVEL_OPTIONS = (['info', 'warning', 'error'] as const).map((key) => ({
  key,
  label: resolveLogLevelMeta(IOT_DEVICE_LOG_LEVEL_META[key]).label,
})) satisfies ReadonlyArray<{ key: IotDeviceLogLevel; label: string }>

export const IOT_DEVICE_LOG_LEVEL_OPTIONS_WITH_ALL = [
  { key: 'all', label: $t('IotDeviceDetail.logMeta.level.all') } as const,
  ...IOT_DEVICE_LOG_LEVEL_OPTIONS,
] as const

export const IOT_DEVICE_LOG_SOURCE_OPTIONS = (['device', 'event', 'exception'] as const).map((key) => ({
  key,
  label: resolveLogSourceMeta(IOT_DEVICE_LOG_SOURCE_META[key]).label,
})) satisfies ReadonlyArray<{ key: IotDeviceLogSource; label: string }>

export const IOT_DEVICE_LOG_SOURCE_OPTIONS_WITH_ALL = [
  { key: 'all', label: $t('IotDeviceDetail.logMeta.source.all') } as const,
  ...IOT_DEVICE_LOG_SOURCE_OPTIONS,
] as const

const FALLBACK_LEVEL_META: IotDeviceLogLevelMetaSource = { labelKey: 'IotDeviceDetail.logMeta.level.info', tone: 'normal' }
const FALLBACK_SOURCE_META: IotDeviceLogSourceMetaSource = { labelKey: 'IotDeviceDetail.logMeta.source.device' }

function resolveLogLevelMeta(meta: IotDeviceLogLevelMetaSource): IotDeviceLogLevelMeta {
  return {
    label: $t(meta.labelKey),
    tone: meta.tone,
  }
}

function resolveLogSourceMeta(meta: IotDeviceLogSourceMetaSource): IotDeviceLogSourceMeta {
  return {
    label: $t(meta.labelKey),
  }
}

export function getIotDeviceLogLevelMeta(value: IotDeviceLogLevel | string | undefined): IotDeviceLogLevelMeta {
  if (!value) return resolveLogLevelMeta(FALLBACK_LEVEL_META)
  return resolveLogLevelMeta(IOT_DEVICE_LOG_LEVEL_META[value as IotDeviceLogLevel] ?? FALLBACK_LEVEL_META)
}

export function getIotDeviceLogSource(log: IotDeviceLog): IotDeviceLogSource {
  if (log.title.includes('事件')) return 'event'
  if (log.level === 'error') return 'exception'
  return 'device'
}

export function getIotDeviceLogSourceMeta(value: IotDeviceLogSource | string | undefined): IotDeviceLogSourceMeta {
  if (!value) return resolveLogSourceMeta(FALLBACK_SOURCE_META)
  return resolveLogSourceMeta(IOT_DEVICE_LOG_SOURCE_META[value as IotDeviceLogSource] ?? FALLBACK_SOURCE_META)
}
