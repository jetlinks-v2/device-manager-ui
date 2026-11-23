import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, reactive, ref } from 'vue'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import { createI18n } from 'vue-i18n'
import { useDeviceAlarmEditor } from '../views/device/alarm/components/editor/useDeviceAlarmEditor'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { queryRuleRecords, queryRecordHistory, queryActiveRuleCounts } from '../views/device/alarm/workspaceApi'
import { useDeviceAlarmDetail } from '../views/device/list/components/device-detail/useDeviceAlarmDetail'
import type { IotDevice } from '../views/device/list/types'
import { useDeviceAlarmRecords } from '../views/device/alarm/hooks/useDeviceAlarmRecords'
import { handleDeviceAlarm } from '../views/device/alarm/workspaceApi'
import { alarmDeviceId, alarmDuration, canHandleRecord } from '../views/device/alarm/workspaceUtils'
import { useDeviceAlarmHistory } from '../views/device/alarm/hooks/useDeviceAlarmHistory'
import {
  buildPreprocessPayload,
  clearNotificationMessageTemplate,
  createEmptyNotification,
  getNotificationMessageMode,
  isDeviceAlarmPreprocess,
  matchesAlarmNotifyMethod,
  hasFixedNotification, hasNotificationRecipients,
  selectAlarmNotificationTypes,
  toDeviceAlarmRow,
} from '../views/device/alarm/utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../views/device/alarm/types'
import { useDeviceAlarmRuleSearch } from '../views/device/alarm/hooks/useDeviceAlarmRuleSearch'
import i18n from '@jetlinks-web-core/locales'
import { localizeDeviceLibraryPreprocessors } from '../views/device/alarm/deviceLibraryI18n'
import { queryDeviceAlarmNotifyMethods, toNotifyMethods } from '../views/device/alarm/api'
import { aggregateTemplateState, hasTemplateBinding, verifiedTemplateState } from '../views/device/alarm/notificationTemplateStatus'
import { useAlarmNotification } from '../views/device/alarm/hooks/useAlarmNotification'
import { useDeviceAlarmPage } from '../views/device/alarm/hooks/useDeviceAlarmPage'
import type { DeviceAlarmRow, DeviceAlarmTargetOption } from '../views/device/alarm/types'

const response = (id: string, total = 1) => ({ result: { data: [{ id, sourceName: id }], total } })
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }

test('alarm record resolves a device id from source first and device target as a compatibility fallback', () => {
  assert.equal(alarmDeviceId({ id: 'record-a', sourceType: 'device', sourceId: ' device-a ', targetType: 'device', targetId: 'device-b' }), 'device-a')
  assert.equal(alarmDeviceId({ id: 'record-b', targetType: 'device', targetId: ' device-b ' }), 'device-b')
  assert.equal(alarmDeviceId({ id: 'record-c', sourceType: 'product', sourceId: 'product-a', targetType: 'product', targetId: 'product-b' }), undefined)
  assert.equal(alarmDeviceId({ id: 'record-d', targetType: 'device', targetId: '   ' }), undefined)
})

test('rule keyword search groups three existing conditions and clears only the rule query', () => {
  let page = 3
  let requests = 0
  const search = useDeviceAlarmRuleSearch(() => { page = 0; requests += 1 })
  search.updateKeyword('  温度_50%\\探头  ')
  assert.deepEqual(search.terms.value, [])
  assert.equal(page, 3)
  search.submit()
  const value = '%温度\\_50\\%\\\\探头%'
  assert.deepEqual(search.terms.value, [{ terms: [
    { column: 'templateId', termType: 'product-info', value: [{ column: 'name', termType: 'like', value }] },
    { column: 'thingId', termType: 'dev-instance', type: 'or', value: [{ column: 'name', termType: 'like', value }] },
    { column: 'property', termType: 'like', type: 'or', value },
  ] }])
  assert.equal(page, 0)
  assert.equal(requests, 1)
  search.submit()
  assert.equal(requests, 1)
  search.updateKeyword('未提交的草稿')
  assert.equal(search.terms.value[0].terms[2].value, value)
  search.updateKeyword('')
  search.submit()
  assert.deepEqual(search.terms.value, [])
  assert.equal(requests, 2)
  search.updateKeyword('   ')
  search.submit()
  assert.equal(requests, 2)
})

test('read-only notification names use the same type identity as the editor and resolve legacy channel IDs', () => {
  const notification = { ...createEmptyNotification(), channelProviders: ['email'], parameters: {
    email: { notifierId: 'account-a', templateId: 'template-a' },
  } }
  const method: DeviceAlarmNotifyMethod = { id: 'email', providerId: 'email', channelIds: ['channel-a'],
    key: 'email', label: 'Email', desc: '', icon: '' }
  assert.equal(matchesAlarmNotifyMethod(notification, method), true)
  assert.equal(matchesAlarmNotifyMethod({ ...notification, channelProviders: ['sms'] }, method), false)
  assert.equal(matchesAlarmNotifyMethod({ ...notification, channelProviders: [], notifyChannelIds: ['channel-a'] }, method), true)
})

test('notification content remains visible only for a legacy custom edit session', () => {
  const defaultNotification = createEmptyNotification()
  assert.equal(getNotificationMessageMode(defaultNotification) === 'custom', false)

  const customNotification = {
    ...createEmptyNotification(),
    parameters: { template: { message: '${targetName}触发告警' } },
  }
  const showLegacyMessageTemplate = getNotificationMessageMode(customNotification) === 'custom'
  assert.equal(showLegacyMessageTemplate, true)

  clearNotificationMessageTemplate(customNotification)
  assert.equal(getNotificationMessageMode(customNotification), 'default')
  assert.equal(showLegacyMessageTemplate, true)
})

test('notification options require accessible enabled trigger templates and keep event-specific status', () => {
  const types = [{ id: 'inside-mail', name: 'Inbox' }, { id: 'notifier-email', name: 'Email', receiverPolicy: 'subscriber' },
    { id: 'notifier-sms', name: 'SMS' }, { id: 'notifier-webhook', receiverPolicy: 'explicit' }]
  const channel = (id: string, type: string, config = { templateId: 'template', notifierId: 'sender' }) => ({
    id, name: 'Private channel name', channelProvider: type, state: { value: 'enabled' }, channelConfiguration: config,
  })
  const methods = toNotifyMethods(types, [
    { provider: 'alarm-device', state: 'enabled', channels: [channel('email-a', 'notifier-email'), channel('email-b', 'notifier-email')] },
    { provider: 'alarm-device-relieve', channels: [channel('recovery-email', 'notifier-email', { templateId: '', notifierId: '' })] },
    { provider: 'alarm-device-relieve', state: 'disabled', channels: [channel('disabled-email', 'notifier-email')] },
    { provider: 'alarm-other', channels: [channel('other-sms', 'notifier-sms')] },
  ])
  assert.deepEqual(methods.map(method => method.id), ['inside-mail', 'notifier-email'])
  const email = methods[1]
  assert.equal(email.label, 'Email')
  assert.equal('channelId' in email, false)
  assert.deepEqual(email.channelIds, ['email-a', 'email-b'])
  assert.deepEqual(email.templates, { trigger: 'unknown', relieve: 'missing' })
  assert.deepEqual(methods[0].templates, { trigger: 'unneeded', relieve: 'unneeded' })
  assert.deepEqual(toNotifyMethods(types), [])
  assert.deepEqual(toNotifyMethods(types, []), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', state: 'disabled', channels: [channel('e', 'notifier-email')] }]), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device-relieve', channels: [channel('e', 'notifier-email')] }]), [])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', channels: [] }]).map(method => method.id), ['inside-mail'])
  assert.deepEqual(toNotifyMethods(types, [{ provider: 'alarm-device', channels: [
    { ...channel('e', 'notifier-email'), state: 'disabled' },
    channel('s', 'notifier-sms', { templateId: '', notifierId: 'sender' }),
  ] }]).map(method => method.id), ['inside-mail'])
  assert.equal(matchesAlarmNotifyMethod({ ...createEmptyNotification(), notifyChannelIds: ['email-b'] }, email), true)
})

test('explicit type selection drops channel bindings but preserves recipients and custom message formats', () => {
  const original = { ...createEmptyNotification(), includeRelieve: true, relieveTopicProvider: 'alarm-device' as const,
    userIds: ['u1'], notifyChannelIds: ['private-channel'], channelProviders: ['notifier-email'], parameters: {
      'notifier-email': { templateId: 'old-template', notifierId: 'old-notifier' },
      template: { message: '${targetName} ${eventText}' }, variableDefinitions: [{ id: 'alarmTime', format: 'yyyy' }],
    } }
  const before = JSON.stringify(original)
  const selected = selectAlarmNotificationTypes(original, ['notifier-email', 'notifier-sms', 'notifier-email'])
  assert.equal(JSON.stringify(original), before)
  assert.deepEqual(selected.channelProviders, ['notifier-email', 'notifier-sms'])
  assert.deepEqual(selected.notifyChannelIds, [])
  assert.deepEqual(selected.userIds, ['u1'])
  assert.equal(selected.relieveTopicProvider, 'alarm-device-relieve')
  assert.deepEqual(selected.parameters, { template: original.parameters.template, variableDefinitions: original.parameters.variableDefinitions })
})

test('template lookup failures reject instead of exposing unconfigured notification types', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async url => {
    calls.push(url)
    return url === '/notify/channel/providers'
      ? { result: [{ id: 'notifier-email', name: 'Email' }] } : { success: false, status: 403, result: [] }
  })
  await assert.rejects(queryDeviceAlarmNotifyMethods())
  assert.deepEqual(calls.sort(), ['/notify/channel/all', '/notify/channel/providers'])
  setAlarmRequestHandler(async () => ({ success: false, status: 403, result: [] }))
  await assert.rejects(queryDeviceAlarmNotifyMethods())
})

test('notification readiness verifies actual templates and keeps missing, unknown and template-free states distinct', async () => {
  const channel = { id: 'email-a', channelProvider: 'notifier-email', state: 'enabled',
    channelConfiguration: { templateId: 'template-a', notifierId: 'sender-a' } }
  const detail = { provider: { id: 'trigger-a', state: 'enabled' },
    channels: [{ channel, template: { id: 'template-a', configId: 'sender-a' } }] }
  assert.equal(hasTemplateBinding({ channelConfiguration: { templateId: '  ', notifierId: 'sender' } }), false)
  assert.equal(verifiedTemplateState(undefined, channel), 'unknown')
  assert.equal(verifiedTemplateState({ channels: [] }, channel), 'missing')
  assert.equal(verifiedTemplateState(detail, channel), 'ready')
  for (const template of [null, { id: 'other', configId: 'sender-a' }, { id: 'template-a', configId: 'other' }]) {
    assert.equal(verifiedTemplateState({ ...detail, channels: [{ channel, template }] }, channel), 'missing')
  }
  assert.equal(verifiedTemplateState({ ...detail, provider: { state: 'disabled' } }, channel), 'missing')
  assert.equal(verifiedTemplateState({ channels: [{ channel: { ...channel, state: { value: 'disabled' } }, template: detail.channels[0].template }] }, channel), 'missing')
  assert.equal(aggregateTemplateState(['unneeded']), 'unneeded')
  assert.equal(aggregateTemplateState(['ready', 'unneeded']), 'ready')
  assert.equal(aggregateTemplateState(['ready', 'unknown']), 'unknown')
  assert.equal(aggregateTemplateState(['unknown', 'missing']), 'missing')
  assert.equal(aggregateTemplateState([]), 'unknown')
  let templateResponse: unknown = { result: detail }
  const requests: string[] = []
  setAlarmRequestHandler(async url => {
    requests.push(url)
    if (url === '/notify/channel/providers') return { result: [{ id: 'inside-mail' }, { id: 'notifier-email' }] }
    if (url === '/notify/channel/all') return { result: [{ id: 'trigger-a', provider: 'alarm-device', state: 'enabled', channels: [channel] }] }
    if (url === '/notify/channel/trigger-a/_query-with-templates') return templateResponse
    throw new Error(`Unexpected request ${url}`)
  })
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'ready')
  assert.equal(requests.length, 3, 'one bounded template query for the relevant enabled provider')
  templateResponse = { result: { channels: [{ channel, template: null }] } }
  const missing = await queryDeviceAlarmNotifyMethods()
  assert.equal(missing[1].templates?.trigger, 'missing')
  assert.deepEqual(missing.map(item => item.id), ['inside-mail', 'notifier-email'], 'status verification does not change picker eligibility')
  templateResponse = { success: false, status: 403, result: detail }
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'unknown')
  templateResponse = { result: [] }
  assert.equal((await queryDeviceAlarmNotifyMethods())[1].templates?.trigger, 'unknown')
})

test('selected notification status preserves template-free delivery, recovery events and legacy trigger topics', () => {
  const model = reactive<DeviceAlarmFormModel>({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true, channelProviders: ['inside-mail'] } })
  const props = reactive({ model, methods: [
    { id: 'inside-mail', providerId: 'inside-mail', templates: { trigger: 'unneeded', relieve: 'unneeded' } },
    { id: 'email', providerId: 'email', templates: { trigger: 'ready', relieve: 'missing' } },
  ] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.selectedTemplateStatus.value, { trigger: 'unneeded', relieve: 'unneeded' })
    model.notification.channelProviders = ['inside-mail', 'email']
    assert.deepEqual(state.selectedTemplateStatus.value, { trigger: 'ready', relieve: 'missing' })
    model.notification.relieveTopicProvider = 'alarm-device'
    assert.equal(state.selectedTemplateStatus.value.relieve, 'ready')
    model.notification.channelProviders = ['unavailable']
    assert.equal(state.selectedTemplateStatus.value.trigger, 'unknown')
  } finally { unmount() }
})

test('automatic relief uses complementary matchers and remains editable', () => {
  const form: DeviceAlarmFormModel = {
    name: '温度异常',
    source: 'product',
    targetId: 'product-a',
    productId: 'product-a',
    property: 'temperature',
    propertyName: '温度',
    level: 2,
    trigger: 'outside',
    limit: { lower: 10, upper: 20 },
    autoRelieve: true,
    notification: createEmptyNotification(),
  }

  const payload = buildPreprocessPayload(form)
  assert.equal(payload.provider, 'composite')
  const [alarmBranch, relieveBranch] = payload.configuration.processors
  assert.deepEqual(alarmBranch.configuration.matcher.configuration, { min: 10, max: 20, not: true })
  assert.deepEqual(relieveBranch.configuration.matcher.configuration, { min: 10, max: 20, not: false })
  assert.equal(relieveBranch.configuration.processors[0].provider, 'device-alarm-relieve')
  assert.deepEqual(relieveBranch.configuration.processors[0].configuration, {
    alarmName: '温度异常',
    alarmLevel: 2,
  })

  const row = toDeviceAlarmRow({
    id: 'alarm-a',
    templateId: 'product-a',
    thingId: '@all',
    property: 'temperature',
    provider: payload.provider,
    configuration: payload.configuration,
  }, 'product', '产品 A')
  assert.equal(row?.autoRelieve, true)
  assert.equal(row?.trigger, 'outside')
  assert.deepEqual(row?.limit, { lower: 10, upper: 20 })

  const simplePayload = buildPreprocessPayload({ ...form, autoRelieve: false })
  assert.equal(simplePayload.provider, 'simple')
  assert.equal('processors' in simplePayload.configuration, true)
  assert.equal(JSON.stringify(simplePayload).includes('device-alarm-relieve'), false)
  assert.equal(toDeviceAlarmRow({
    provider: simplePayload.provider,
    configuration: simplePayload.configuration,
  }, 'product', '产品 A')?.autoRelieve, false)

  const insidePayload = buildPreprocessPayload({ ...form, trigger: 'inside' })
  const [insideAlarm, insideRelieve] = insidePayload.configuration.processors
  assert.equal(insideAlarm.configuration.matcher.configuration.not, false)
  assert.equal(insideRelieve.configuration.matcher.configuration.not, true)
})

test('alarm editor ignores composite preprocessors outside its canonical shape', () => {
  const customComposite = {
    provider: 'composite',
    configuration: {
      processors: [{
        provider: 'simple',
        configuration: {
          matcher: { provider: 'number-range', configuration: { min: 10, max: 20, not: true } },
          processors: [{ provider: 'device-alarm', configuration: { alarmName: '温度异常', alarmLevel: 2 } }],
        },
      }, {
        provider: 'simple',
        configuration: {
          matcher: { provider: 'number-range', configuration: { min: 10, max: 20, not: false } },
          processors: [{ provider: 'device-alarm-relieve', configuration: { alarmName: '温度异常', alarmLevel: 2 } }],
        },
      }, {
        provider: 'scale',
        configuration: { scale: 0.1 },
      }],
    },
  }

  assert.equal(isDeviceAlarmPreprocess(customComposite), false)
  assert.equal(toDeviceAlarmRow(customComposite, 'product', '产品 A'), null)
})

test('device library localizes nested alarm processor without dropping relief branch', () => {
  i18n.global.locale.value = 'en-US'
  const [localized] = localizeDeviceLibraryPreprocessors([{
    id: 'alarm-a',
    name: '温度异常',
    property: 'temperature',
    provider: 'composite',
    i18nMessages: { name: { zh_CN: '温度异常', en_US: 'Temperature alarm' } },
    configuration: {
      processors: [{
        provider: 'simple',
        configuration: {
          processors: [{ provider: 'device-alarm', configuration: { alarmName: '温度异常' } }],
        },
      }, {
        provider: 'simple',
        configuration: {
          processors: [{
            provider: 'device-alarm-relieve',
            configuration: { alarmName: '温度异常', alarmLevel: 2 },
          }],
        },
      }],
    },
  } as any], {
    thingModel: { properties: [{ id: 'temperature', name: '温度', i18nMessages: { name: { en_US: 'Temperature' } } }] },
  })

  assert.equal(localized.name, 'Temperature alarm')
  assert.equal(localized.propertyName, 'Temperature')
  const [alarmBranch, relieveBranch] = (localized.configuration as any).processors
  assert.equal(alarmBranch.configuration.processors[0].configuration.alarmName, 'Temperature alarm')
  assert.equal(relieveBranch.configuration.processors[0].provider, 'device-alarm-relieve')
  assert.equal(relieveBranch.configuration.processors[0].configuration.alarmName, 'Temperature alarm')
  assert.equal(relieveBranch.configuration.processors[0].configuration.alarmLevel, 2)
  i18n.global.locale.value = 'zh'
})

test('rule query preserves stable identity and caller filters; global history remains reachable', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  setAlarmRequestHandler(async (url, body) => { calls.push({ url, body }); return response('record', 27) })
  const result = await queryRuleRecords('product-property-id', { pageIndex: 2, pageSize: 10,
    terms: [{ column: 'targetName', termType: 'like', value: '%device%' }] })
  assert.equal(result.total, 27)
  assert.equal(calls[0].url, '/alarm/record/device/_query')
  assert.deepEqual(calls[0].body.terms, [
    { column: 'alarmConfigId', termType: 'eq', value: 'product-property-id' },
    { column: 'alarmConfigSource', termType: 'eq', value: 'device-property-preprocessor' },
    { terms: [{ column: 'targetName', termType: 'like', value: '%device%' }] },
  ])
  await queryRuleRecords(undefined, { pageIndex: 0, pageSize: 10 })
  assert.equal(JSON.stringify(calls[1].body).includes('alarmConfigId'), false)
})

test('history uses permission-checked record endpoints with real pagination', async () => {
  const urls: string[] = []
  setAlarmRequestHandler(async (url, body) => { urls.push(url); assert.equal(body.pageIndex, 4); return response('history', 52) })
  assert.equal((await queryRecordHistory('record/a', 'logs', { pageIndex: 4, pageSize: 10 })).total, 52)
  await queryRecordHistory('record/a', 'handles', { pageIndex: 4, pageSize: 10 })
  assert.deepEqual(urls, ['/alarm/history/alarm-record/record%2Fa/_query', '/alarm/record/record%2Fa/handle-history/_query'])
})

test('counts are aggregated for the requested page only; invalid counts cannot appear as zero', async () => {
  setAlarmRequestHandler(async (_url, body) => {
    assert.deepEqual(body.groupBy, [{ column: 'alarmConfigId', alias: 'alarmConfigId' }])
    assert.equal(body.limit, 2)
    assert.ok(JSON.stringify(body).includes('rule-a'))
    return { result: [{ alarmConfigId: 'rule-a', count: '3' }] }
  })
  assert.deepEqual(await queryActiveRuleCounts(['rule-a', 'rule-b']), { 'rule-a': 3, 'rule-b': 0 })
  setAlarmRequestHandler(async () => ({ result: [{ alarmConfigId: 'rule-a' }] }))
  await assert.rejects(queryActiveRuleCounts(['rule-a']))
  setAlarmRequestHandler(async () => ({ status: 403 }))
  await assert.rejects(queryActiveRuleCounts(['rule-a']))
  await assert.rejects(queryRuleRecords('rule', { pageIndex: 0, pageSize: 10 }))
})

function mount<T>(setup: () => T) {
  const renderer = createRenderer({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}),
    createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
  let state!: T
  const app = renderer.createApp(defineComponent({ setup() { state = setup(); return () => null } }))
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false }))
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

const alarmProperty = (id: string) => ({ id, name: id, valueType: { type: 'double', unit: '%' } })
const alarmTarget = (id: string, source: 'product' | 'device' = 'device') => {
  const data: DeviceAlarmTargetOption = { label: id, value: id, source, productId: 'product-a',
    ...(source === 'device' ? { deviceId: id } : {}), metadata: { properties: [alarmProperty('product-property')] } }
  return { label: id, value: id, data }
}

test('single-device alarms load effective detail metadata, clear old selections and return to product scope', async () => {
  const requests: string[] = []
  setAlarmRequestHandler(async url => {
    requests.push(url)
    if (url === '/device-instance/device-a/detail') return { result: { metadata: JSON.stringify({ properties: [alarmProperty('device-only')] }) } }
    if (url === '/device-instance/device-inherited/detail') return { result: { independentMetadata: false,
      metadata: { properties: [alarmProperty('inherited-property')] } } }
    if (url.includes('/property/_list') || url === '/protocol/units') return { result: [] }
    throw new Error(`Unexpected request: ${url}`)
  })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    await state.onProductChange(alarmTarget('product-a', 'product'))
    state.onPropertyChange('product-property')
    const selecting = state.onDeviceChange('device-a', alarmTarget('device-a'))
    assert.equal(state.form.value.property, '')
    assert.equal(state.form.value.propertyName, '')
    assert.equal(state.form.value.propertyUnit, '')
    assert.deepEqual(state.propertyOptions.value, [])
    await selecting
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['device-only'])
    state.onPropertyChange('device-only')
    await state.onDeviceChange('device-inherited', alarmTarget('device-inherited'))
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['inherited-property'])
    await state.onDeviceChange('__all__')
    assert.equal(state.form.value.source, 'product')
    assert.equal(state.form.value.property, '')
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['product-property'])
    assert.equal(requests.some(url => url.startsWith('/device-product/')), false)
  } finally { unmount() }
})

test('editing a device alarm reloads its effective model without losing the selected property', async () => {
  setAlarmRequestHandler(async url => url === '/device-instance/device-a/detail'
    ? { result: { metadata: { properties: [alarmProperty('device-only')] } } }
    : { result: [] })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const row: DeviceAlarmRow = { ...state.form.value, key: 'alarm-a', id: 'alarm-a', name: 'Device alarm', source: 'device',
      targetId: 'device-a', deviceId: 'device-a', productId: 'product-a', property: 'device-only' }
    await state.openEdit(row)
    assert.equal(state.editorOpen.value, true)
    assert.equal(state.form.value.property, 'device-only')
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['device-only'])
  } finally { unmount() }
})

test('late device metadata and configured-rule responses cannot replace the current device properties', async () => {
  const pending = new Map<string, (value: unknown) => void>()
  setAlarmRequestHandler(async url => url === '/protocol/units' ? { result: [] }
    : new Promise(resolve => { pending.set(url, resolve) }))
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const first = state.onDeviceChange('device-a', alarmTarget('device-a'))
    pending.get('/device-instance/device-a/detail')!({ result: { metadata: { properties: [alarmProperty('old-a')] } } })
    await flush()
    const second = state.onDeviceChange('device-b', alarmTarget('device-b'))
    const third = state.onDeviceChange('device-c', alarmTarget('device-c'))
    pending.get('/device-instance/device-c/detail')!({ result: { metadata: { properties: [alarmProperty('current-c')] } } })
    await flush()
    pending.get('/message/preprocessor/product/product-a/device-c/property/_list')!({ result: [] })
    await third
    pending.get('/device-instance/device-b/detail')!({ result: { metadata: { properties: [alarmProperty('old-b')] } } })
    await second
    pending.get('/message/preprocessor/product/product-a/device-a/property/_list')!({ result: [] })
    await first
    assert.deepEqual(state.propertyOptions.value.map(item => item.id), ['current-c'])
    assert.equal(pending.has('/message/preprocessor/product/product-a/device-b/property/_list'), false)
  } finally { unmount() }
})

test('a failed or empty device model never falls back to stale product properties', async () => {
  setAlarmRequestHandler(async url => {
    if (url === '/device-instance/device-a/detail') throw new Error('Device unavailable')
    return { result: [] }
  })
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    await state.onProductChange(alarmTarget('product-a', 'product'))
    await assert.rejects(state.onDeviceChange('device-a', alarmTarget('device-a')), /Device unavailable/)
    assert.deepEqual(state.propertyOptions.value, [])
    setAlarmRequestHandler(async url => url === '/device-instance/device-a/detail'
      ? { result: { metadata: { properties: [] } } } : { result: [] })
    await state.onDeviceChange('device-a', alarmTarget('device-a'))
    assert.deepEqual(state.propertyOptions.value, [])
  } finally { unmount() }
})

test('clearing a product invalidates a pending device metadata request', async () => {
  let complete!: (value: unknown) => void
  setAlarmRequestHandler(async url => url === '/protocol/units' ? { result: [] }
    : new Promise(resolve => { complete = resolve }))
  const { state, unmount } = mount(() => useDeviceAlarmPage(key => key))
  try {
    const selecting = state.onDeviceChange('device-a', alarmTarget('device-a'))
    await state.onProductChange()
    complete({ result: { metadata: { properties: [alarmProperty('old-device')] } } })
    await selecting
    assert.deepEqual(state.propertyOptions.value, [])
    assert.equal(state.form.value.targetId, '')
  } finally { unmount() }
})

test('record queries default to all; scope switches preserve search and discard late responses', async () => {
  const pending: { body: Record<string, unknown>; resolve: (value: unknown) => void }[] = []
  setAlarmRequestHandler((_url, body) => new Promise(resolve => pending.push({ body, resolve })))
  const rule = ref<string>()
  const { state, unmount } = mount(() => useDeviceAlarmRecords(rule, key => key))
  const staleRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(!JSON.stringify(pending[0].body).includes('alarmConfigId'))
  rule.value = 'rule-a'
  await flush()
  const scopedRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  pending[1].resolve(response('new-record'))
  assert.equal((await scopedRequest).result?.data[0].id, 'new-record')
  pending[0].resolve(response('stale-record'))
  assert.equal((await staleRequest).success, false)
  state.search({ terms: [], where: '', filter: { terms: [{ column: 'sourceName', termType: 'like', value: '%device%', type: 'and' }] } })
  await flush()
  const filteredRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('sourceName'))
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('"value":"%device%"'))
  rule.value = undefined
  await flush()
  const allRequest = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  const last = pending.at(-1)!
  assert.ok(!JSON.stringify(last.body).includes('alarmConfigId'))
  assert.ok(JSON.stringify(last.body).includes('sourceName'))
  last.resolve(response('all-filtered'))
  assert.equal((await allRequest).result?.data[0].id, 'all-filtered')
  pending.at(-2)!.resolve(response('stale-filtered'))
  assert.equal((await filteredRequest).success, false)
  unmount()
})

test('history opens on the chosen record, isolates tabs and invalidates closed modal requests', async () => {
  const pending: { url: string; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = []
  setAlarmRequestHandler(url => new Promise((resolve, reject) => pending.push({ url, resolve, reject })))
  const { state, unmount } = mount(useDeviceAlarmHistory)
  assert.equal(pending.length, 0)
  state.show({ id: 'record-a' }, 'logs')
  state.show({ id: 'record-b', alarmName: '原始设备温度告警' }, 'handles')
  assert.ok(pending[1].url.includes('/record-b/handle-history/'))
  pending[1].resolve(response('handle-b'))
  await flush()
  pending[0].resolve(response('stale-log-a'))
  await flush()
  assert.equal(state.history.rows[0].id, 'handle-b')
  assert.equal(state.history.rows[0].alarmName, '原始设备温度告警')
  state.show({ id: 'record-c', alarmName: '父记录名称' }, 'handles')
  pending.at(-1)!.resolve({ result: { data: [{ id: 'handle-c', alarmName: '接口快照名称' }], total: 1 } })
  await flush()
  assert.equal(state.history.rows[0].alarmName, '接口快照名称')
  const failed = state.loadHistory()
  pending.at(-1)!.reject(new Error('Forbidden'))
  await failed
  assert.equal(state.history.error, true)
  assert.deepEqual(state.history.rows, [])
  state.changeTab('logs')
  state.close()
  pending.at(-1)!.resolve(response('closed-log'))
  await flush()
  assert.deepEqual(state.history.rows, [])
  unmount()
})

test('handling targets one record and its alarm cycle, validates description, and retains errors', async () => {
  const record = { id: 'device-a', alarmConfigId: 'rule-a', alarmTime: 1000, state: { value: 'warning', text: '告警中' } }
  let count = 0
  setAlarmRequestHandler(async (url, body) => {
    count++
    assert.equal(url, '/alarm/record/device/_handle')
    assert.deepEqual(body, { alarmRecordId: 'device-a', alarmConfigId: 'rule-a', alarmTime: 1000,
      describe: '已排查', type: 'user', state: 'normal' })
    return { status: 200 }
  })
  await handleDeviceAlarm(record, ' 已排查 ')
  await assert.rejects(handleDeviceAlarm(record, '   '))
  await assert.rejects(handleDeviceAlarm({ ...record, id: '' }, '已排查'))
  assert.equal(count, 1)
  setAlarmRequestHandler(async () => ({ status: 403 }))
  await assert.rejects(handleDeviceAlarm(record, '已排查'))
  assert.equal(canHandleRecord(record), true)
  assert.equal(canHandleRecord({ ...record, state: 'normal' }), false)
  assert.equal(alarmDuration(record, 61000), '1.0 min')
  assert.equal(alarmDuration({ ...record, state: 'normal' }, 61000), '—')
})


function editorProps() {
  const model: DeviceAlarmFormModel = {
    name: '', source: 'product', targetId: '', property: '', level: 4,
    trigger: 'outside', limit: {}, autoRelieve: false, notification: createEmptyNotification(),
  }
  return reactive({ open: true, saving: false, model,
    levelOptions: [{ label: 'General', value: 4 }, { label: 'Critical', value: 1 }],
    propertyOptions: [{ id: 'temperature', name: 'Temperature', valueType: { type: 'double' } }],
  })
}

test('editor preview follows completeness without losing zero, false, or pending recovery values', () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.panelStates.value.target, 'pending')
  assert.equal(state.previewText.value, 'DeviceAlarm.editor.pending')
  props.model.targetId = 'product-a'
  props.model.property = 'temperature'
  props.model.trigger = 'eq'
  props.model.value = 0
  assert.equal(state.panelStates.value.target, 'complete')
  assert.equal(state.panelStates.value.trigger, 'complete')
  assert.match(state.previewText.value, /0/)
  props.model.autoRelieve = true
  props.model.relieveCondition = { trigger: 'gt', value: 0, limit: {} }
  assert.equal(state.panelStates.value.trigger, 'complete')
  props.model.relieveCondition.value = -1
  assert.equal(state.panelStates.value.trigger, 'pending')
  assert.equal(state.relievePreviewText.value, 'DeviceAlarm.editor.pending')
  props.model.autoRelieve = false
  props.model.property = 'boolean-property'
  props.model.value = false
  assert.match(state.previewText.value, /false/)
  props.model.trigger = 'outside'
  props.model.limit = { lower: 0 }
  assert.equal(state.previewText.value, 'DeviceAlarm.editor.pending')
  unmount()
})

test('editor notifications distinguish off from incomplete and accept persisted recipient dimensions', () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.panelStates.value.notification, 'off')
  props.model.notification.enabled = true
  props.model.notification.channelProviders = ['email']
  assert.equal(state.panelStates.value.notification, 'pending')
  props.model.notification.dimensions = [{ id: 'tenant-a' }]
  assert.equal(state.panelStates.value.notification, 'complete')
  props.model.source = 'device'
  props.model.notification.parameters = { template: { message: '' } }
  assert.equal(state.panelStates.value.notification, 'pending')
  props.model.notification.enabled = false
  assert.equal(state.panelStates.value.notification, 'off')
  unmount()
})

test('hidden alarm panels disappear from navigation and preview without clearing saved notification settings', () => {
  const getRegistry = componentsRegistry.getRegistry
  componentsRegistry.getRegistry = code => code === 'device/alarm:alarm-editor'
    ? [{ targetPage: 'device/alarm', targetModule: 'alarm-editor', target: 'notification', mode: 'hide', code: 'hide-device-alarm-notification', key: 'notification' }]
    : []
  const props = editorProps()
  props.model.notification = { ...createEmptyNotification(), enabled: true, channelProviders: ['email'], userIds: ['user-a'] }
  const savedNotification = JSON.stringify(props.model.notification)
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  try {
    assert.deepEqual(state.panels.map(panel => panel.key), ['level', 'target', 'trigger'])
    assert.equal(state.summaryItems.value.some(item => item.panel === 'notification'), false)
    state.selectPanel('notification')
    assert.equal(state.activePanel.value, 'level')
    assert.equal(JSON.stringify(props.model.notification), savedNotification)
  } finally {
    unmount()
    componentsRegistry.getRegistry = getRegistry
  }
})

test('editor preview destinations preserve drafts, block navigation during save and reset on reopen', async () => {
  const props = editorProps()
  const { state, unmount } = mount(() => useDeviceAlarmEditor(props, key => key))
  assert.equal(state.activePanel.value, 'level')
  props.model.name = 'Unsaved alarm'
  props.model.level = 1
  for (const item of state.summaryItems.value) {
    state.selectPanel(item.panel)
    assert.equal(state.activePanel.value, item.panel)
  }
  assert.equal(state.summaryItems.value.find(item => item.key === 'property')?.panel, 'target')
  assert.equal(state.summaryItems.value.find(item => item.key === 'relieve')?.panel, 'trigger')
  props.saving = true
  state.selectPanel('level')
  assert.equal(state.activePanel.value, 'notification')
  props.saving = false
  props.open = false
  await nextTick()
  props.open = true
  await nextTick()
  assert.equal(state.activePanel.value, 'level')
  assert.equal(props.model.name, 'Unsaved alarm')
  assert.equal(props.model.level, 1)
  unmount()
})


test('device alarm records and rule counts always constrain the requested device', async () => {
  const calls: { url: string; body: Record<string, any> }[] = []
  setAlarmRequestHandler(async (url, body) => {
    calls.push({ url, body })
    return url.endsWith('_aggregation') ? { result: [{ alarmConfigId: 'inherited-rule', count: 1 }] } : response('device-record')
  })
  await queryRuleRecords(undefined, { pageIndex: 0, pageSize: 10, terms: [{ column: 'sourceId', termType: 'eq', value: 'other-device' }] }, 'device-a')
  assert.deepEqual(calls[0].body.terms.slice(0, 2), [
    { column: 'sourceId', termType: 'eq', value: 'device-a' },
    { column: 'targetType', termType: 'eq', value: 'device' },
  ])
  assert.deepEqual(calls[0].body.terms[2], { terms: [{ column: 'sourceId', termType: 'eq', value: 'other-device' }] })
  await queryRuleRecords('inherited-rule', { pageIndex: 1, pageSize: 10 }, 'device-a')
  assert.deepEqual(calls[1].body.terms[0], { column: 'alarmConfigId', termType: 'eq', value: 'inherited-rule' })
  assert.ok(calls[1].body.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-a'))
  await queryActiveRuleCounts(['inherited-rule'], 'device-a')
  assert.ok(calls[2].body.filter.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-a'))
})

test('changing the device rebuilds record pagination and discards an old device response', async () => {
  const pending: { body: Record<string, any>; resolve: (value: unknown) => void }[] = []
  setAlarmRequestHandler((_url, body) => new Promise(resolve => pending.push({ body, resolve })))
  const device = ref('device-a'), rule = ref<string>()
  const { state, unmount } = mount(() => useDeviceAlarmRecords(rule, key => key, device))
  const old = state.table.value.request({ pageIndex: 2, pageSize: 10 })
  const key = state.table.value.key
  device.value = 'device-b'
  await flush()
  assert.notEqual(state.table.value.key, key)
  const current = state.table.value.request({ pageIndex: 0, pageSize: 10 })
  assert.ok(pending[1].body.terms.some((term: any) => term.column === 'sourceId' && term.value === 'device-b'))
  pending[1].resolve(response('device-b-record'))
  assert.equal((await current).result?.data[0].id, 'device-b-record')
  pending[0].resolve(response('device-a-record'))
  assert.equal((await old).success, false)
  unmount()
})


test('device alarm sidebar includes inherited rules while explicit and empty device overrides suppress product rules', async () => {
  const make = (id: string, property: string, thingId = '@all') => ({
    ...buildPreprocessPayload({ name: id, source: 'product', targetId: 'product-a', productId: 'product-a',
      property, propertyName: property, level: 2, trigger: 'outside', limit: { lower: 10, upper: 20 },
      autoRelieve: true, notification: createEmptyNotification() }),
    id, property, templateId: 'product-a', thingId,
  })
  setAlarmRequestHandler(async url => {
    if (url === '/alarm/config/default/level') return { result: { levels: [] } }
    if (url.endsWith('/product-a/property/_list')) return { result: [make('inherited-1', 'p1'), make('inherited-2', 'p2'), make('inherited-3', 'p3')] }
    if (url.endsWith('/product-a/device-a/property/_list')) return { result: [make('override-1', 'p1', 'device-a'),
      { id: 'disabled-2', property: 'p2', templateId: 'product-a', thingId: 'device-a', provider: 'composite', configuration: { processors: [] } }] }
    if (url.endsWith('_aggregation')) return { result: [] }
    throw new Error(url)
  })
  const device = ref({ id: 'device-a', productKey: 'product-a', name: 'Device', productName: 'Product', thingModelMetadata: { properties: [] } } as unknown as IotDevice)
  const { state, unmount } = mount(() => useDeviceAlarmDetail(device))
  await flush()
  assert.equal(state.error.value, false)
  assert.deepEqual(state.rows.value.map(row => row.id), ['inherited-3', 'override-1'])
  assert.deepEqual(state.rows.value.map(row => row.source), ['product', 'device'])
  unmount()
})


test('DingTalk robots remain separate instances alongside work notifications with their own recovery templates', () => {
  const channel = (id: string, notifierId: string, templateId = `${id}-template`) => ({ id, name: id,
    channelProvider: 'notifier-dingTalk', channelConfiguration: { notifierId, templateId } })
  const trigger = [channel('robot-a', 'robot-a-config'), channel('robot-b', 'robot-b-config'), channel('work', 'work-config')]
  const recovery = [channel('robot-a-relieve', 'robot-a-config'), channel('work-relieve', 'work-config')]
  const providers = [{ id: 'trigger', provider: 'alarm-device', channels: trigger }, { id: 'relieve', provider: 'alarm-device-relieve', channels: recovery }]
  const detail = (channels: ReturnType<typeof channel>[]) => ({ channels: channels.map(channel => ({ channel,
    template: { id: channel.channelConfiguration.templateId, configId: channel.channelConfiguration.notifierId } })) })
  const notifiers = new Map(['robot-a-config', 'robot-b-config', 'work-config'].map(id => [id, { type: 'dingTalk', provider: id === 'work-config' ? 'dingTalkMessage' : 'dingTalkRobotWebHook' }]))
  const methods = toNotifyMethods([{ id: 'notifier-dingTalk', name: 'DingTalk' }], providers, new Map([
    ['trigger', detail(trigger)], ['relieve', detail(recovery)],
  ]), notifiers)
  assert.deepEqual(methods.map(method => method.id), ['notifier-dingTalk', 'robot-a', 'robot-b'])
  assert.equal(methods[1].fixedReceiver?.relieveTemplateId, 'robot-a-relieve-template')
  assert.equal(methods[2].templates?.relieve, 'missing')
  assert.deepEqual(methods[0].channelIds, ['work'])
  const fixed = selectAlarmNotificationTypes({ ...createEmptyNotification(), enabled: true }, ['robot-a', 'robot-b'], methods)
  assert.deepEqual(fixed.channelProviders, [])
  assert.equal(fixed.fixedReceiverChannels.length, 2)
  assert.equal(hasNotificationRecipients(fixed), true)
  assert.equal(matchesAlarmNotifyMethod(fixed, methods[1]), true)
  assert.equal(matchesAlarmNotifyMethod(fixed, methods[0]), false)
  const mixed = selectAlarmNotificationTypes(fixed, ['robot-a', 'notifier-dingTalk'], methods)
  assert.equal(hasNotificationRecipients(mixed), false)
  assert.equal(hasNotificationRecipients({ ...mixed, userIds: ['u1'] }), true)
  assert.equal(selectAlarmNotificationTypes(mixed, [], methods).fixedReceiverChannels.length, 0)
})

test('fixed-only alarms retain selection and templates through trigger/recovery payload and readback', () => {
  const model = editorProps().model
  model.property = 'temperature'
  model.trigger = 'gt'
  model.value = 50
  model.autoRelieve = true
  model.notification = { ...createEmptyNotification(), enabled: true, includeRelieve: true,
    fixedReceiverChannels: [{ channelId: 'robot-a', templateId: 'trigger-template', relieveTemplateId: 'recovery-template' }] }
  const payload = buildPreprocessPayload(model)
  const restored = toDeviceAlarmRow({ ...payload, property: model.property }, model.source, model.targetId)
  if (!restored) throw new Error('Fixed notification payload must remain editable after readback')
  assert.equal(restored.notification.enabled, true)
  assert.equal(hasFixedNotification(restored.notification), true)
  assert.deepEqual(restored.notification.fixedReceiverChannels, model.notification.fixedReceiverChannels)
  const editor = useDeviceAlarmEditor({ ...editorProps(), model }, key => key)
  assert.equal(editor.panelStates.value.notification, 'complete')
  const selected = reactive({ model, methods: [{ id: 'robot-a', providerId: 'notifier-dingTalk', key: 'dingtalk', label: 'Robot A', desc: '', icon: '',
    fixedReceiver: model.notification.fixedReceiverChannels![0] }] as DeviceAlarmNotifyMethod[] })
  const { state: notification, unmount } = mount(() => useAlarmNotification(selected, () => {}, () => {}))
  assert.deepEqual(notification.channelIds.value, ['robot-a'])
  assert.equal(notification.requiresRecipients.value, false)
  notification.channelIds.value = []
  assert.equal(hasFixedNotification(model.notification), false)
  unmount()
})


test('notify resources load robot identities once per config and retain work-only recovery status', async () => {
  const calls: string[] = []
  const channel = (id: string, notifierId: string) => ({ id, name: id, channelProvider: 'notifier-dingTalk',
    channelConfiguration: { notifierId, templateId: `${id}-template` } })
  const trigger = [channel('robot-a', 'robot'), channel('robot-b', 'robot'), channel('work', 'work')]
  setAlarmRequestHandler(async url => {
    calls.push(url)
    if (url === '/notify/channel/providers') return { result: [{ id: 'notifier-dingTalk', name: 'DingTalk' }] }
    if (url === '/notify/channel/all') return { result: [{ id: 'trigger', provider: 'alarm-device', channels: trigger }] }
    if (url === '/notify/channel/trigger/_query-with-templates') return { result: { channels: trigger.map(channel => ({ channel,
      template: { id: channel.channelConfiguration.templateId, configId: channel.channelConfiguration.notifierId } })) } }
    if (url.startsWith('/notifier/config/')) return { result: { type: 'dingTalk', provider: url.endsWith('/robot') ? 'dingTalkRobotWebHook' : 'dingTalkMessage' } }
    throw new Error(`Unexpected request ${url}`)
  })
  const methods = await queryDeviceAlarmNotifyMethods()
  assert.deepEqual(methods.map(method => method.id), ['notifier-dingTalk', 'robot-a', 'robot-b'])
  assert.equal(calls.filter(url => url === '/notifier/config/robot').length, 1)
  assert.deepEqual(methods[0].personnelChannels, { providerId: 'notifier-dingTalk', trigger: ['work'], relieve: [] })
  assert.equal(methods[0].templates?.relieve, 'missing')
})

test('missing robot resources keep a saved fixed selection removable without requiring personnel', () => {
  const model = reactive({ ...editorProps().model, id: 'saved', notification: { ...createEmptyNotification(), enabled: true,
    fixedReceiverChannels: [{ channelId: 'missing-robot', templateId: 'saved-template' }] } })
  const props = reactive({ model, methods: [] as DeviceAlarmNotifyMethod[] })
  const { state, unmount } = mount(() => useAlarmNotification(props, () => {}, () => {}))
  try {
    assert.deepEqual(state.channelIds.value, ['missing-robot'])
    assert.equal(state.requiresRecipients.value, false)
    state.channelIds.value = []
    assert.deepEqual(model.notification.fixedReceiverChannels, [])
  } finally { unmount() }
})
