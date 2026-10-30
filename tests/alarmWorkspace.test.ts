import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, ref } from 'vue'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { queryRuleRecords, queryRecordHistory, queryActiveRuleCounts } from '../views/device/alarm/workspaceApi'
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
  selectAlarmNotificationTypes,
  toDeviceAlarmRow,
} from '../views/device/alarm/utils'
import type { DeviceAlarmFormModel, DeviceAlarmNotifyMethod } from '../views/device/alarm/types'
import { useDeviceAlarmRuleSearch } from '../views/device/alarm/hooks/useDeviceAlarmRuleSearch'
import i18n from '@jetlinks-web-core/locales'
import { localizeDeviceLibraryPreprocessors } from '../views/device/alarm/deviceLibraryI18n'
import { queryDeviceAlarmNotifyMethods, toNotifyMethods } from '../views/device/alarm/api'

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

test('notification options are types with event-specific template status, never concrete channels', () => {
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
  assert.deepEqual(methods.map(method => method.id), ['inside-mail', 'notifier-email', 'notifier-sms'])
  const email = methods[1]
  assert.equal(email.label, 'Email')
  assert.equal('channelId' in email, false)
  assert.deepEqual(email.channelIds, ['email-a', 'email-b'])
  assert.deepEqual(email.templates, { trigger: 'ready', relieve: 'missing' })
  assert.deepEqual(methods[2].templates, { trigger: 'missing', relieve: 'missing' })
  assert.deepEqual(methods[0].templates, { trigger: 'unneeded', relieve: 'unneeded' })
  assert.equal(toNotifyMethods(types)[1].templates?.trigger, 'unknown')
  assert.equal(toNotifyMethods(types)[0].templates?.trigger, 'unneeded')
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

test('template lookup failures stay unknown while supported types remain selectable', async () => {
  const calls: string[] = []
  setAlarmRequestHandler(async url => {
    calls.push(url)
    return url === '/notify/channel/providers'
      ? { result: [{ id: 'notifier-email', name: 'Email' }] } : { success: false, status: 403, result: [] }
  })
  const methods = await queryDeviceAlarmNotifyMethods()
  assert.equal(methods[0].templates?.relieve, 'unknown')
  assert.deepEqual(calls.sort(), ['/notify/channel/all', '/notify/channel/providers'])
  setAlarmRequestHandler(async () => ({ success: false, status: 403, result: [] }))
  await assert.rejects(queryDeviceAlarmNotifyMethods())
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
  app.mount({})
  return { state, unmount: () => app.unmount() }
}

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
