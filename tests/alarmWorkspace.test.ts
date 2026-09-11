import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, ref } from 'vue'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { queryRuleRecords, queryRecordHistory, queryActiveRuleCounts } from '../views/device/alarm/workspaceApi'
import { useDeviceAlarmRecords } from '../views/device/alarm/hooks/useDeviceAlarmRecords'
import { handleDeviceAlarm } from '../views/device/alarm/workspaceApi'
import { alarmDuration, canHandleRecord } from '../views/device/alarm/workspaceUtils'
import { useDeviceAlarmHistory } from '../views/device/alarm/hooks/useDeviceAlarmHistory'
import { createEmptyNotification, matchesAlarmNotifyMethod } from '../views/device/alarm/utils'
import type { DeviceAlarmNotifyMethod } from '../views/device/alarm/types'

const response = (id: string, total = 1) => ({ result: { data: [{ id, sourceName: id }], total } })
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }

test('read-only notification names use the same configured channel identity as the editor', () => {
  const notification = { ...createEmptyNotification(), channelProviders: ['email'], parameters: {
    email: { notifierId: 'account-a', templateId: 'template-a' },
  } }
  const method: DeviceAlarmNotifyMethod = { id: 'channel-a', providerId: 'email', channelId: 'channel-a',
    key: 'email', label: 'Email', desc: '', icon: '', raw: { configuration: { notifierId: 'account-a', templateId: 'template-a' } } }
  assert.equal(matchesAlarmNotifyMethod(notification, method), true)
  assert.equal(matchesAlarmNotifyMethod(notification, { ...method, raw: { configuration: { notifierId: 'account-b' } } }), false)
  assert.equal(matchesAlarmNotifyMethod({ ...notification, notifyChannelIds: ['channel-a'] }, method), true)
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
  assert.ok(!JSON.stringify(pending[0].body).includes('alarmConfigId'))
  rule.value = 'rule-a'
  await flush()
  pending[1].resolve(response('new-record'))
  await flush()
  pending[0].resolve(response('stale-record'))
  await flush()
  assert.equal(state.rows.value[0].id, 'new-record')
  state.search({ terms: [], where: '', filter: { terms: [{ column: 'sourceName', termType: 'like', value: '%device%', type: 'and' }] } })
  await flush()
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('sourceName'))
  assert.ok(JSON.stringify(pending.at(-1)!.body).includes('"value":"%device%"'))
  rule.value = undefined
  await flush()
  const last = pending.at(-1)!
  assert.ok(!JSON.stringify(last.body).includes('alarmConfigId'))
  assert.ok(JSON.stringify(last.body).includes('sourceName'))
  last.resolve(response('all-filtered'))
  await flush()
  assert.equal(state.rows.value[0].id, 'all-filtered')
  unmount()
})

test('history opens on the chosen record, isolates tabs and invalidates closed modal requests', async () => {
  const pending: { url: string; resolve: (value: unknown) => void; reject: (error: Error) => void }[] = []
  setAlarmRequestHandler(url => new Promise((resolve, reject) => pending.push({ url, resolve, reject })))
  const { state, unmount } = mount(useDeviceAlarmHistory)
  assert.equal(pending.length, 0)
  state.show({ id: 'record-a' }, 'logs')
  state.show({ id: 'record-b' }, 'handles')
  assert.ok(pending[1].url.includes('/record-b/handle-history/'))
  pending[1].resolve(response('handle-b'))
  await flush()
  pending[0].resolve(response('stale-log-a'))
  await flush()
  assert.equal(state.history.rows[0].id, 'handle-b')
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
