import type {
  IotDeviceCommandCategory,
  IotDeviceCommandExecutionStatus,
  IotDeviceCommandRiskLevel,
} from '../types'
import i18n from '@jetlinks-web-core/locales'

export interface IotDeviceCommandMeta {
  label: string
  icon: string
  tone?: 'ok' | 'warn' | 'err'
}

interface IotDeviceCommandMetaSource {
  labelKey: string
  icon: string
  tone?: 'ok' | 'warn' | 'err'
}

const $t = i18n.global.t

export const IOT_DEVICE_COMMAND_CATEGORY_META: Record<IotDeviceCommandCategory, IotDeviceCommandMetaSource> = {
  control: { labelKey: 'IotDeviceDetail.commandMeta.category.control', icon: 'ControlOutlined' },
  query: { labelKey: 'IotDeviceDetail.commandMeta.category.query', icon: 'CheckCircleOutlined' },
  maintenance: { labelKey: 'IotDeviceDetail.commandMeta.category.maintenance', icon: 'ToolOutlined' },
  security: { labelKey: 'IotDeviceDetail.commandMeta.category.security', icon: 'SafetyOutlined', tone: 'err' },
}

export const IOT_DEVICE_COMMAND_RISK_META: Record<IotDeviceCommandRiskLevel, IotDeviceCommandMetaSource> = {
  normal: { labelKey: 'IotDeviceDetail.commandMeta.risk.normal', icon: 'CheckCircleOutlined', tone: 'ok' },
  caution: { labelKey: 'IotDeviceDetail.commandMeta.risk.caution', icon: 'WarningOutlined', tone: 'warn' },
  critical: { labelKey: 'IotDeviceDetail.commandMeta.risk.critical', icon: 'WarningOutlined', tone: 'err' },
}

export const IOT_DEVICE_COMMAND_STATUS_META: Record<IotDeviceCommandExecutionStatus, IotDeviceCommandMetaSource> = {
  success: { labelKey: 'IotDeviceDetail.commandMeta.status.success', icon: 'CheckCircleOutlined', tone: 'ok' },
  waiting: { labelKey: 'IotDeviceDetail.commandMeta.status.waiting', icon: 'ClockCircleOutlined', tone: 'warn' },
  failed: { labelKey: 'IotDeviceDetail.commandMeta.status.failed', icon: 'CloseCircleOutlined', tone: 'err' },
}

const CATEGORY_FALLBACK: IotDeviceCommandMetaSource = { labelKey: 'IotDeviceDetail.commandMeta.category.fallback', icon: 'SendOutlined' }
const RISK_FALLBACK: IotDeviceCommandMetaSource = { labelKey: 'IotDeviceDetail.commandMeta.risk.normal', icon: 'CheckCircleOutlined', tone: 'ok' }
const STATUS_FALLBACK: IotDeviceCommandMetaSource = { labelKey: 'IotDeviceDetail.commandMeta.status.unknown', icon: 'QuestionCircleOutlined' }

function resolveCommandMeta(meta: IotDeviceCommandMetaSource): IotDeviceCommandMeta {
  return {
    label: $t(meta.labelKey),
    icon: meta.icon,
    tone: meta.tone,
  }
}

export function getIotDeviceCommandCategoryMeta(value: IotDeviceCommandCategory | string | undefined) {
  if (!value) return resolveCommandMeta(CATEGORY_FALLBACK)
  return resolveCommandMeta(IOT_DEVICE_COMMAND_CATEGORY_META[value as IotDeviceCommandCategory] ?? CATEGORY_FALLBACK)
}

export function getIotDeviceCommandRiskMeta(value: IotDeviceCommandRiskLevel | string | undefined) {
  if (!value) return resolveCommandMeta(RISK_FALLBACK)
  return resolveCommandMeta(IOT_DEVICE_COMMAND_RISK_META[value as IotDeviceCommandRiskLevel] ?? RISK_FALLBACK)
}

export function getIotDeviceCommandStatusMeta(value: IotDeviceCommandExecutionStatus | string | undefined) {
  if (!value) return resolveCommandMeta(STATUS_FALLBACK)
  return resolveCommandMeta(IOT_DEVICE_COMMAND_STATUS_META[value as IotDeviceCommandExecutionStatus] ?? STATUS_FALLBACK)
}
