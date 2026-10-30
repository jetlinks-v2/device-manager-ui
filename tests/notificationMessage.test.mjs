import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createI18n } from 'vue-i18n'
import zh from '../locales/lang/zh.json'
import en from '../locales/lang/en.json'
import { buildPreprocessPayload, createEmptyNotification, setNotificationMessageTemplate, toDeviceAlarmRow } from '../views/device/alarm/utils'
import { createDefaultNotificationMessageTemplate, notificationMessageVariables, renderNotificationMessagePreview } from '../views/device/alarm/notificationMessageVariables'

function model() {
  return { source: 'device', targetId: 'd1', deviceId: 'd1', productId: 'p1', property: 'temperature',
    propertyName: '温度', propertyUnit: '℃', name: '用户名称', level: 4, trigger: 'outside', limit: { lower: 0, upper: 80 },
    autoRelieve: true, notification: { ...createEmptyNotification(), enabled: true, includeRelieve: true,
      userIds: ['u1'], channelProviders: ['inside-mail'] } }
}

test('notification dates get readable defaults, preserve explicit formats and round-trip with recovery', () => {
  const form = model()
  form.notification.parameters = { variableDefinitions: [{ id: 'alarmTime', type: 'date', format: 'yyyy' }], other: true }
  const message = '${eventText}|${propertyValue}|${alarmTime}|${relieveTime}|${notifyTime}'
  setNotificationMessageTemplate(form.notification, message)
  const definitions = form.notification.parameters.variableDefinitions
  assert.deepEqual(definitions, [
    { id: 'alarmTime', type: 'date', format: 'yyyy' },
    { id: 'relieveTime', type: 'date', format: 'yyyy-MM-dd HH:mm:ss' },
    { id: 'notifyTime', type: 'date', format: 'yyyy-MM-dd HH:mm:ss' },
  ])
  assert.equal(form.notification.parameters.other, true)
  const saved = buildPreprocessPayload(form)
  const loaded = toDeviceAlarmRow(saved, 'device', 'Device')
  assert.deepEqual(loaded.notification.parameters, form.notification.parameters)
  assert.deepEqual(buildPreprocessPayload(loaded), saved)
})

test('both locales preserve template tokens and localize system text, never user names or raw identifiers', () => {
  for (const [locale, messages] of Object.entries({ zh, en })) {
    const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } })
    const t = i18n.global.t
    const form = model()
    const template = createDefaultNotificationMessageTemplate(t)
    assert.ok(template.includes('${targetName}'))
    assert.ok(template.includes('${eventText}'))
    assert.ok(!template.includes('$${'))
    setNotificationMessageTemplate(form.notification, template)
    for (const variable of notificationMessageVariables) assert.notEqual(t(variable.labelKey), variable.labelKey)
    const trigger = renderNotificationMessagePreview(template, form, t, 'trigger')
    const relieve = renderNotificationMessagePreview(template, form, t, 'relieve')
    assert.ok(trigger.includes(locale === 'en' ? 'Alarm triggered' : '触发告警'))
    assert.ok(relieve.includes(locale === 'en' ? 'Alarm cleared' : '解除告警'))
    assert.ok(trigger.includes('用户名称') && relieve.includes('用户名称'))
    assert.ok(trigger.includes('90℃') && !trigger.includes('℃℃'))
  }
})

test('event preview uses the recovery value, renders dates and leaves absent fields empty', () => {
  const form = model()
  const labels = { 'DeviceAlarm.notification.preview.trigger': 'trigger', 'DeviceAlarm.notification.preview.relieve': 'relieve' }
  const t = key => labels[key] || key
  const template = '${event}|${propertyValue}|${alarmTime}|${relieveTime}|${notifyTime}|${missing}'
  setNotificationMessageTemplate(form.notification, template)
  assert.equal(renderNotificationMessagePreview(template, form, t, 'trigger'), 'trigger|90|2026-01-01 12:00:00||2026-01-01 12:00:00|')
  assert.equal(renderNotificationMessagePreview(template, form, t, 'relieve'), 'relieve|25|2026-01-01 12:00:00|2026-01-01 12:01:00|2026-01-01 12:01:00|')
  form.notification.parameters.variableDefinitions = [{ id: 'propertyValue', type: 'double', format: '%.2f' }]
  assert.equal(renderNotificationMessagePreview('${propertyValue}', form, t, 'trigger'), '90.00')
})
