import dayjs from 'dayjs'
import type { DeviceAlarmFormModel } from './types'

export const notificationMessageVariables = [
  'targetId', 'targetName', 'productId', 'productName', 'alarmConfigName', 'property', 'propertyName',
  'propertyValue', 'propertyValueText', 'propertyUnit', 'event', 'eventText', 'level', 'levelText',
  'alarmTime', 'relieveTime', 'notifyTime',
].map(id => ({ id, labelKey: `DeviceAlarm.notification.variable.${id}` }))

export const notificationDateVariables = ['alarmTime', 'relieveTime', 'notifyTime']
export const notificationDateFormat = 'yyyy-MM-dd HH:mm:ss'
type Translate = (key: string, values?: Record<string, unknown>) => string

export function createDefaultNotificationMessageTemplate(t: Translate): string {
  // 语言包中的 $ 是普通文本，只将 {变量} 回填，保留原有 ${变量} 语法。
  return t('DeviceAlarm.messageTemplate.default', Object.fromEntries(
    notificationMessageVariables.map(({ id }) => [id, `{${id}}`]),
  ))
}

/** 只渲染本地样例，解除场景使用本次恢复值；不读取或修改真实设备规则。 */
export function renderNotificationMessagePreview(template: string, model: DeviceAlarmFormModel, t: Translate, event: 'trigger' | 'relieve') {
  const alarmTime = new Date(2026, 0, 1, 12, 0, 0).getTime()
  const value = event === 'relieve' ? 25 : 90
  const level = ['emergency', 'urgent', 'severity', 'ordinary', 'warn'][model.level - 1] || 'ordinary'
  const values: Record<string, string | number | undefined> = {
    targetId: model.deviceId || 'device-001',
    targetName: model.targetName || model.deviceId || t('DeviceAlarm.notification.preview.targetName'),
    productId: model.productId || 'product-001',
    productName: model.productName || t('DeviceAlarm.notification.preview.productName'),
    alarmConfigName: model.name || t('DeviceAlarm.notification.preview.alarmConfigName'),
    property: model.property,
    propertyName: model.propertyName || model.property || t('DeviceAlarm.notification.preview.propertyName'),
    propertyValue: value,
    propertyValueText: `${value}${model.propertyUnit || ''}`,
    propertyUnit: model.propertyUnit || '',
    event,
    eventText: t(`DeviceAlarm.notification.preview.${event}`),
    level: model.level,
    levelText: t(`DeviceAlarm.level.${level}`),
    alarmTime,
    relieveTime: event === 'relieve' ? alarmTime + 60000 : undefined,
    notifyTime: event === 'relieve' ? alarmTime + 60000 : alarmTime,
  }
  const definitions = Array.isArray(model.notification.parameters?.variableDefinitions)
    ? model.notification.parameters.variableDefinitions as Array<{ id: string; type?: string; format?: string }> : []
  return template.replace(/\$\{([^}]+)}/g, (_token, id: string) => {
    const value = values[id]
    if (value == null) return ''
    const definition = definitions.find(item => item.id === id)
    if (definition?.type === 'date' && definition.format !== 'timestamp') {
      return dayjs(Number(value)).format((definition.format || notificationDateFormat).replace(/yyyy/g, 'YYYY').replace(/dd/g, 'DD'))
    }
    const precision = definition?.type === 'double' && /^%\.(\d+)f$/.exec(definition.format || '')
    if (precision && Number.isFinite(Number(value))) return Number(value).toFixed(Math.min(Number(precision[1]), 100))
    return String(value)
  })
}
