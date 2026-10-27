import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..')
const epoch = Date.UTC(2026, 9, 26, 1), flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)); await vue.nextTick() }
function loader(api = {}) {
  const cache = new Map()
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => {
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

function harness(fetch = async (node, signal, hour) => raw({ hour })) {
  const calls = [], api = { queryDeviceMessageRecording: (node, signal, hour) => { calls.push({ node, signal, hour }); return fetch(node, signal, hour) } }
  const module = loader(api)(resolve(root, 'views/link/RuntimeMonitor/device-runtime/useDeviceMessageRecording.ts'))
  const node = vue.ref('a'), enabled = vue.ref(true), scope = vue.ref('alice'), interval = vue.ref(3), generation = vue.ref('42'), effect = vue.effectScope()
  return { ...effect.run(() => module.useDeviceMessageRecording(node, enabled, scope, interval, generation)), node, enabled, scope, interval, generation, effect, calls }
}

test('recent history polls after completion; hour history is fetched only on demand and focus survives tab pause', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const h = harness()
  try {
    await flush(); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].hour, undefined)
    const selection = { peak: h.view.value.data.hourPeaks[0], scope: 'hour' }
    await h.select(selection); assert.equal(h.calls.length, 1)
    assert.equal(h.view.value.focus.peak.sequence, 30)
    h.enabled.value = false; await flush(); assert.equal(h.view.value.focus.peak.sequence, 30)
    t.mock.timers.tick(60000); await flush(); assert.equal(h.calls.length, 1)
    h.enabled.value = true; await flush(); assert.equal(h.calls.length, 2)
    await h.select({ peak: { ...selection.peak, sequence: -100 }, scope: 'today' })
    assert.equal(h.calls.at(-1).hour, true); assert.equal(h.view.value.outside, true)
    assert.equal(h.view.value.points.length, 60)
    h.live(); assert.equal(h.view.value.focus, undefined)
  } finally { h.effect.stop() }
})

test('node changes cancel late responses, restore completed evidence and isolate identity', async () => {
  const pending = [], h = harness((node, signal) => new Promise(done => pending.push({ node, signal, done })))
  try {
    pending[0].done(raw()); await flush()
    h.node.value = 'b'; await flush(); assert.equal(h.view.value.data, undefined)
    h.node.value = 'a'; await flush(); assert.equal(pending[1].signal.aborted, true)
    assert.equal(h.view.value.data.generation, '42')
    pending[1].done(raw({ generation: 99 })); await flush(); assert.equal(h.view.value.data.generation, '42')
    h.scope.value = 'bob'; await flush(); assert.equal(h.view.value.data, undefined)
    assert.equal(pending[2].signal.aborted, true)
  } finally { h.effect.stop() }
})

test('temporary failure retains evidence and malformed history cannot overwrite a completed curve', async () => {
  let attempt = 0
  const h = harness(async () => { if (attempt++ === 0) return raw(); throw new Error('offline') })
  try {
    await flush(); await h.refresh()
    assert.equal(h.view.value.state, 'stale'); assert.equal(h.view.value.points.length, 60)
  } finally { h.effect.stop() }
})

test('authorization denial clears retained evidence and stops automatic retries', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let attempt = 0
  const h = harness(async () => { if (attempt++ === 0) return raw(); throw { status: 403 } })
  try {
    await flush(); await h.refresh()
    assert.equal(h.view.value.state, 'error'); assert.equal(h.view.value.data, undefined)
    t.mock.timers.tick(60000); await flush(); assert.equal(attempt, 2)
  } finally { h.effect.stop() }
})

test('malformed MBean source stays retryable and retains the last completed history', async () => {
  for (const invalid of [null, [], { 'org.jetlinks': [] }, { 'org.jetlinks': { DeviceMessageMonitor: { invalid: null } } }]) {
    let attempt = 0
    const h = harness(async () => attempt++ === 0 ? raw() : invalid)
    try {
      await flush(); await h.refresh()
      assert.equal(h.view.value.state, 'stale'); assert.equal(h.view.value.points.length, 60)
    } finally { h.effect.stop() }
  }
})

test('a node without the history capability returns to live data without keeping a previous peak marker', async () => {
  let attempt = 0
  const h = harness(async () => attempt++ === 0 ? raw() : {})
  try {
    await flush()
    await h.select({ peak: h.view.value.data.hourPeaks[0], scope: 'hour' })
    assert.ok(h.view.value.focus)
    await h.refresh()
    assert.equal(h.view.value.state, 'unsupported'); assert.equal(h.view.value.data, undefined)
    assert.equal(h.view.value.focus, undefined); assert.equal(h.view.value.outside, false)
  } finally { h.effect.stop() }
})

test('hour history denial also cancels a concurrent refresh and clears all retained evidence', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let attempt = 0, late
  const h = harness((node, signal, hour) => {
    attempt++
    if (hour) return Promise.reject({ response: { status: 403 } })
    return attempt === 1 ? Promise.resolve(raw()) : new Promise(done => { late = done })
  })
  try {
    await flush()
    const selection = { peak: { ...h.view.value.data.hourPeaks[0], sequence: -100 }, scope: 'today' }
    const refresh = h.refresh()
    await h.select(selection)
    assert.equal(h.calls[1].signal.aborted, true)
    late(raw()); await refresh; await flush()
    assert.equal(h.view.value.state, 'error'); assert.equal(h.view.value.data, undefined)
    assert.equal(h.view.value.focus, undefined)
    t.mock.timers.tick(60000); await flush(); assert.equal(attempt, 3)
  } finally { h.effect.stop() }
})
