import { pluginCheckResult, type PluginInstallProgress } from '../../../api/link/pluginInstallProgress'

type Translate = (key: string, values?: Record<string, unknown>) => string

const phases: Record<string, string> = {
  'plugin.check': 'checking', 'plugin.download': 'downloading', 'plugin.validate': 'validating',
  'plugin.resolve': 'resolving', 'plugin.cleanup': 'finishing',
  'plugin.apply': 'applying',
}

export function progressLabel(event: PluginInstallProgress, t: Translate): string {
  if (event.attributes?.applicable === false) return t('pluginInstall.unsupported')
  if (event.status === 'FAILED') return t('pluginInstall.failed')
  if (event.status === 'CANCELLED') return t('pluginInstall.cancelled')
  if (pluginCheckResult(event)) return t('pluginInstall.checked')
  return t(`pluginInstall.${phases[event.name] || 'checking'}`)
}

export function progressAmount(event: PluginInstallProgress, locale: string, t: Translate): string {
  const reading = event.measurable?.current
  if (reading == null) return ''
  const current = Number(reading)
  if (!Number.isFinite(current) || current < 0) return ''
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (event.measurable?.unitValue === 'bytes') {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    const index = Math.min(units.length - 1, current > 0 ? Math.floor(Math.log(current) / Math.log(1024)) : 0)
    return `${number.format(current / 1024 ** index)} ${units[index]}`
  }
  return t('pluginInstall.items', { count: number.format(current) })
}

export function uploadError(error: { code?: string; message?: string; status?: number; response?: { status?: number } } | undefined, t: Translate): string {
  const messages: Record<string, string> = { UPLOAD_IDLE: 'uploadIdle', UPLOAD_RESPONSE: 'uploadResponse',
    CHECK_STREAM_ENDED: 'checkIncomplete', NDJSON_RESPONSE: 'progressResponse' }
  const status = error?.status || error?.response?.status
  const statuses: Record<number, string> = { 401: 'unauthorized', 403: 'forbidden', 404: 'endpointMissing',
    413: 'tooLarge', 502: 'gatewayFailed', 503: 'gatewayFailed', 504: 'gatewayFailed' }
  return status && statuses[status] ? t(`pluginInstall.${statuses[status]}`)
    : error?.code && messages[error.code] ? t(`pluginInstall.${messages[error.code]}`)
    : error?.message || t('pluginInstall.failed')
}
