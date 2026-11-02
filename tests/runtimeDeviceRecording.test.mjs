import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { declarations } from './helpers/mbeanDeclarations.mjs'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..')
const epoch = Date.UTC(2026, 9, 26, 1), flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function loader(api = {}, collection) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
      if (id.endsWith('collection/useMBeanCollection')) return collection
      if (id === 'vue') return vue
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
      if (id.endsWith('api/link/diagnostics')) return api
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return {}
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }, module, module.exports)
    cache.set(path, module.exports)
    return module.exports
  }
  return load
}
const pure = loader()(resolve(root, 'views/link/RuntimeMonitor/device-runtime/deviceMessageRecording.ts'))
function bean({ generation = 42, peakSequence = 30, hour = false, empty = false } = {}) {
  const point = sequence => ({ Sequence: sequence, Time: epoch + (sequence + 1) * 1000, ReceivedPackets: sequence === peakSequence ? 20 : 0, SentPackets: 0, UpstreamMessages: 1, PropertyReports: 1, PropertyValues: 8, EventReports: 0, ReceivedBytes: 128, SentBytes: 0 })
  const summary = { StartTime: generation, StatisticsStartTime: epoch, SampleTime: epoch + 60000, WindowMillis: 1000, FirstSequence: 0, EndSequence: 60, ZoneId: 'Asia/Shanghai', TodayStartTime: epoch - 3600000, HourPeaks: { arbitrary: { Metric: 'Communication', Value: 20, Time: epoch + (peakSequence + 1) * 1000, Sequence: peakSequence } }, TodayPeaks: {} }
  const history = { StartTime: generation, StatisticsStartTime: epoch, SampleTime: epoch + 60000, WindowMillis: 1000, FirstSequence: 0, EndSequence: 60, Points: empty ? {} : Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`index-${i}`, point(i)]).reverse()) }
  return { domain: 'org.jetlinks', type: 'DeviceMessageMonitor', name: 'DeviceMessageMonitor', attributes: [{ name: 'HistorySummary', available: true, value: summary }, { name: hour ? 'HourHistory' : 'RecentHistory', available: true, value: history }] }
}
function raw(options) {
  const source = bean(options)
  return { 'org.jetlinks': { DeviceMessageMonitor: { DeviceMessageMonitor: { '@name': source.name, '@attributes': source.attributes.map(({ value, ...rest }) => rest), ...Object.fromEntries(source.attributes.map(item => [item.name, item.value])) } } } }
}

test('standard indexed JMX rows retain actual zero, independent peak time, and ordered one-second history', () => {
  const result = pure.readDeviceRecording(bean())
  assert.equal(result.generation, '42'); assert.equal(result.points.length, 60)
  assert.equal(result.points[0].values.Communication, 0)
  assert.equal(result.points[30].values.Communication, 20)
  assert.equal(result.hourPeaks[0].timestamp, epoch + 31000)
  assert.equal(result.points[59].values.PropertyValues, 8)
  assert.equal(pure.readDeviceRecording({ ...bean(), name: 'other' }), undefined)
  assert.equal(pure.readDeviceRecording({ ...bean(), attributes: [] }), undefined)
  assert.equal(pure.readDeviceRecording(bean({ empty: true })).points.length, 0)
})

test('invalid / unavailable history, precision loss, foreign generation and unknown metrics cannot become fake zeros', () => {
  for (const mutate of [
    b => { b.attributes[0].available = false },
    b => { b.attributes[1].value.StartTime = 43 },
    b => { b.attributes[1].value.Points['index-0'].ReceivedPackets = Number.MAX_SAFE_INTEGER + 1 },
    b => { b.attributes[1].value.Points['index-0'].Sequence = 99 },
    b => { b.attributes[1].value.Points['index-1'].Time = epoch + 1000 },
    b => { b.attributes[0].value.HourPeaks.arbitrary.Metric = 'device-id' },
    b => { b.attributes[0].value.ZoneId = 'invalid-zone' },
  ]) { const b = bean(); mutate(b); assert.throws(() => pure.readDeviceRecording(b)) }
})

test('peak neighborhood uses real sequence and expired daily peak does not fabricate surrounding history', () => {
  const data = pure.readDeviceRecording(bean())
  assert.equal(pure.peakNeighborhood(data.points, data.hourPeaks[0]).length, 60)
  assert.deepEqual(pure.peakNeighborhood(data.points, { ...data.hourPeaks[0], sequence: -100 }), [])
  assert.equal(pure.peakSeries('ReceivedPackets'), 'communicationQps')
  assert.equal(pure.peakSeries('PropertyValues'), 'propertyValues')
  assert.equal(pure.peakSeries('ReceivedBytes'), 'receivedBytes')
})

test('summary and history attributes can cross several second boundaries without using epoch as identity', () => {
  const b = bean(), summary = b.attributes[0].value
  summary.EndSequence = 50
  summary.SampleTime -= 10000
  assert.equal(pure.readDeviceRecording(b).points.at(-1).sequence, 59)
})

function harness(fetch = async () => raw({ hour: true })) {
  const collection = declarations(vue), calls = []
  const api = { queryDeviceMessageRecording: (node, signal, hour) => { calls.push({ node, signal, hour }); return fetch(node, signal, hour) } }
  const module = loader(api, collection)(resolve(root, 'views/link/RuntimeMonitor/device-runtime/useDeviceMessageRecording.ts'))
  const node = vue.ref('a'), enabled = vue.ref(true), scope = vue.ref('alice'), interval = vue.ref(3), generation = vue.ref('42'), effect = vue.effectScope()
  return { ...effect.run(() => module.useDeviceMessageRecording(node, enabled, scope, interval, generation)), node, enabled, scope, interval, generation, effect, calls, collection,
    push: (value = raw(), target = node.value) => collection.push(target, 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor', value),
    fail: reason => collection.fail(node.value, 'org.jetlinks:type=DeviceMessageMonitor,name=DeviceMessageMonitor', reason) }
}
test('recent history declares its projection; hour history stays on demand and focus survives pause', async () => {
  const h = harness()
  try {
    assert.deepEqual(h.collection.entries[0].demand.attributes, ['HistorySummary', 'RecentHistory'])
    assert.equal(h.calls.length, 0); h.push()
    const selection = { peak: h.view.value.data.hourPeaks[0], scope: 'hour' }
    await h.select(selection); assert.equal(h.calls.length, 0); assert.equal(h.view.value.focus.peak.sequence, 30)
    h.enabled.value = false; assert.equal(h.collection.entries[0].demand.enabled, false)
    assert.equal(h.view.value.focus.peak.sequence, 30)
    h.enabled.value = true; h.push()
    await h.select({ peak: { ...selection.peak, sequence: -100 }, scope: 'today' })
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].hour, true)
    assert.equal(h.view.value.outside, true); assert.equal(h.view.value.points.length, 60)
    h.live(); assert.equal(h.view.value.focus, undefined)
  } finally { h.effect.stop() }
})
test('node changes restore completed evidence, isolate identity and reject old-node samples', () => {
  const h = harness()
  try {
    h.push(); h.node.value = 'b'; assert.equal(h.view.value.data, undefined)
    h.node.value = 'a'; assert.equal(h.view.value.data.generation, '42')
    h.push(raw({ generation: 99 }), 'b'); assert.equal(h.view.value.data.generation, '42')
    h.scope.value = 'bob'; assert.equal(h.view.value.data, undefined)
    h.push(); h.generation.value = '99'; assert.equal(h.view.value.data, undefined)
  } finally { h.effect.stop() }
})
test('transient errors preserve completed curves and refresh delegates to page collection', () => {
  const h = harness()
  try {
    h.push(); h.fail(new Error('offline')); assert.equal(h.view.value.state, 'stale'); assert.equal(h.view.value.points.length, 60)
    h.refresh(); assert.equal(h.collection.refreshes.length, 1)
  } finally { h.effect.stop() }
})
test('authorization denial clears evidence and reactively withdraws the declaration until explicit retry', () => {
  const h = harness()
  try {
    h.push(); h.fail({ status: 403 })
    assert.equal(h.view.value.state, 'error'); assert.equal(h.view.value.data, undefined)
    assert.equal(h.collection.entries[0].demand.enabled, false)
    h.push(); assert.equal(h.view.value.data, undefined)
    h.refresh(); assert.equal(h.collection.entries[0].demand.enabled, true)
    h.push(); assert.equal(h.view.value.state, 'ready')
  } finally { h.effect.stop() }
})
test('malformed source stays retryable and never overwrites the completed curve', () => {
  for (const invalid of [null, [], { 'org.jetlinks': [] }, { 'org.jetlinks': { DeviceMessageMonitor: { invalid: null } } }]) {
    const h = harness()
    try {
      h.push(); h.push(invalid)
      assert.equal(h.view.value.state, 'stale'); assert.equal(h.view.value.points.length, 60)
    } finally { h.effect.stop() }
  }
})
test('withdrawn history capability clears previous peak marker and data', async () => {
  const h = harness()
  try {
    h.push(); await h.select({ peak: h.view.value.data.hourPeaks[0], scope: 'hour' }); assert.ok(h.view.value.focus)
    h.push({}); assert.equal(h.view.value.state, 'unsupported'); assert.equal(h.view.value.data, undefined)
    assert.equal(h.view.value.focus, undefined); assert.equal(h.view.value.outside, false)
  } finally { h.effect.stop() }
})
test('hour denial withdraws recent collection and canceled hour response cannot restore old identity', async () => {
  const pending = [], h = harness((_node, signal) => new Promise(done => pending.push({ signal, done })))
  try {
    h.push(); const selection = { peak: { ...h.view.value.data.hourPeaks[0], sequence: -100 }, scope: 'today' }
    const first = h.select(selection); h.node.value = 'b'; assert.equal(pending[0].signal.aborted, true)
    pending[0].done(raw({ hour: true })); await first; assert.equal(h.view.value.data, undefined)
    h.node.value = 'a'; h.push()
    const second = h.select(selection); h.fail({ response: { status: 403 } })
    assert.equal(pending[1].signal.aborted, true); assert.equal(h.collection.entries[0].demand.enabled, false)
    pending[1].done(raw({ hour: true })); await second
    assert.equal(h.view.value.state, 'error'); assert.equal(h.view.value.data, undefined)
  } finally { h.effect.stop() }
})
