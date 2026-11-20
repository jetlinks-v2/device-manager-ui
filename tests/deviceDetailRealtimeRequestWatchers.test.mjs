import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { computed, createSSRApp, effectScope, h, nextTick, ref, watch } from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const require = createRequire(import.meta.url)
const start = new Date(2026, 10, 19, 10).valueOf()
const propertyRow = (overrides = {}) => ({
  id: 'a', identifier: 'a', name: 'a', dataType: 'number', valueType: { type: 'double' },
  value: '--', updatedAt: '--', ...overrides,
})

// 使用真实 Vue watcher 和趋势 hook，只替换历史查询边界。
function sparklineHarness(t, initialRows = [propertyRow()]) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: start })
  const requests = []
  const modules = runtimeModules({
    '../../services/iotDeviceDetailReal.service': {
      extractRows: result => result?.data ?? result ?? [],
      iotDeviceDetailRealApi: { queryPropertyAggregation(device, query) {
        return new Promise((resolve, reject) => requests.push({ device, query, resolve, reject }))
      } },
    },
  })
  const { useIotDevicePropertySparklineData } = modules.load('views/device/list/components/device-detail/useIotDevicePropertySparklineData.ts')
  const device = ref('device-a'), range = ref('1h'), rows = ref(initialRows), scope = effectScope()
  const view = scope.run(() => useIotDevicePropertySparklineData(computed(() => device.value), rows, range))
  t.after(() => scope.stop())
  const points = (identifier = 'a') => view.getSparklineRows(propertyRow({ identifier }))
  const values = (identifier = 'a') => points(identifier).map(point => point.value)
  async function report(value, timestamp = Date.now(), identifier = 'a') {
    rows.value = rows.value.map(row => row.identifier === identifier ? { ...row, value: String(value), timestamp } : { ...row })
    await nextTick()
  }
  async function respond(index, data) {
    requests[index].resolve({ result: data })
    await nextTick()
  }
  return { modules, device, range, rows, scope, requests, view, points, values, report, respond }
}

const cases = [
  ['../views/device/list/components/device-detail/IotDevicePropertyHistoryChart.vue', 'queryCharts'],
  ['../views/device/list/components/device-detail/IotDevicePropertyMiniChart.vue', 'queryMiniChart'],
  ['../views/device/list/components/device-detail/useIotDevicePropertySparklineData.ts', 'scheduleLoad'],
  ['../views/device/list/components/device-detail/useIotDevicePropertyTrajectory.ts', 'queryTrajectory'],
  ['../views/device/list/components/device-detail/IotDevicePropertyDetailModal.vue', 'loadRows'],
]

function scriptContent(path, source) {
  if (!path.endsWith('.vue')) return source
  return source.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/)?.[1] ?? ''
}

function findRequestWatcher(source, callbackName) {
  let result
  const visit = node => {
    if (result || !ts.isCallExpression(node) || node.expression.getText(source) !== 'watch') {
      ts.forEachChild(node, visit)
      return
    }
    const callback = node.arguments[1]?.getText(source) ?? ''
    if (callback.includes(callbackName)) result = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

test('realtime property updates do not retrigger history queries through array identity', async t => {
  for (const [path, callbackName] of cases) {
    await t.test(path, async () => {
      const raw = await readFile(new URL(path, import.meta.url), 'utf8')
      const source = ts.createSourceFile(path, scriptContent(path, raw), ts.ScriptTarget.Latest, true)
      const watcher = findRequestWatcher(source, callbackName)
      assert.ok(watcher, `watcher for ${callbackName} exists`)
      assert.ok(ts.isArrayLiteralExpression(watcher.arguments[0]), `${callbackName} compares each query input independently`)
    })
  }
})

test('multi-source query watcher ignores a realtime value-only property replacement', async () => {
  const property = ref({ identifier: 'cpu', valueType: { type: 'float' }, value: 20, updatedAt: '10:00:00' })
  let queryCount = 0
  const stop = watch(
    [
      () => property.value.identifier,
      () => property.value.valueType.type,
    ],
    () => { queryCount += 1 },
  )

  property.value = { ...property.value, value: 21, updatedAt: '10:00:01' }
  await nextTick()
  assert.equal(queryCount, 0)

  property.value = { ...property.value, identifier: 'memory' }
  await nextTick()
  assert.equal(queryCount, 1)
  stop()
})

test('an empty history accumulates consecutive realtime reports, including zero and equal values', async t => {
  const h = sparklineHarness(t)
  assert.deepEqual(h.values(), [])
  t.mock.timers.tick(120)
  await h.respond(0, [])
  await h.report(33)
  assert.deepEqual(h.values(), [33], 'one report produces one point')
  t.mock.timers.tick(50)
  await h.report(36)
  t.mock.timers.tick(50)
  await h.report(36)
  t.mock.timers.tick(50)
  await h.report(0)
  assert.deepEqual(h.values(), [33, 36, 36, 0], 'reports in the same second remain separate')
  assert.equal(h.requests.length, 1, 'realtime changes do not issue history queries')
  await h.report(-1)
  assert.deepEqual(h.values(), [33, 36, 36, -1], 'repeated timestamps replace the point')
})

test('late history merges with reports received before and during the query, in time order', async t => {
  const h = sparklineHarness(t)
  await h.report('12.5℃', start)
  // formatValue 带单位时与卡片数值使用同一拆分规则。
  h.rows.value = h.rows.value.map(row => ({ ...row, unit: '℃' }))
  await nextTick()
  t.mock.timers.tick(120)
  await h.report(20)
  await h.respond(0, [{ time: start - 60_000, a: 5 }, { time: start, a: 10 }])
  assert.deepEqual(h.values(), [5, 12.5, 20])
  assert.deepEqual(h.points().map(point => point.time), [start - 60_000, start, start + 120])
})

test('buffers are isolated by property and retain only twelve valid numeric points in the selected range', async t => {
  const h = sparklineHarness(t, [propertyRow(), propertyRow({ id: 'b', identifier: 'b' }),
    propertyRow({ id: 'text', identifier: 'text', valueType: { type: 'string' }, value: '123', timestamp: start })])
  t.mock.timers.tick(120)
  assert.deepEqual(h.requests[0].query.columns.map(column => column.property), ['a', 'b'])
  await h.respond(0, [{ time: start - 3_600_001, a: 999 }, { time: start - 1000, a: null }])
  assert.deepEqual(h.values(), [])
  for (let i = 0; i < 15; i++) {
    t.mock.timers.tick(100)
    await h.report(i)
  }
  assert.deepEqual(h.values(), Array.from({ length: 12 }, (_, i) => i + 3))
  assert.deepEqual(h.values('b'), [])
  await h.report(-20, Date.now(), 'b')
  assert.deepEqual(h.values('b'), [-20])
  assert.deepEqual(h.values('text'), [])
  await h.report('not-a-number')
  assert.equal(h.values().length, 12)
  t.mock.timers.tick(3_600_001)
  await h.report(42)
  assert.deepEqual(h.values(), [42])
})

test('switching the range discards old query responses and realtime reports survive history failures', async t => {
  const h = sparklineHarness(t)
  t.mock.timers.tick(120)
  await h.report(1)
  h.range.value = '24h'
  await nextTick()
  t.mock.timers.tick(120)
  await h.report(2)
  await h.respond(0, [{ time: start - 1000, a: 999 }])
  assert.deepEqual(h.values(), [1, 2])
  h.requests[1].reject(new Error('history unavailable'))
  await nextTick()
  assert.deepEqual(h.values(), [1, 2])
  assert.equal(h.requests[1].query.query.interval, '1h')
})

test('device/page changes clear previous curves and disposal cancels pending queries', async t => {
  const h = sparklineHarness(t)
  t.mock.timers.tick(120)
  await h.report(1)
  h.device.value = 'device-b'
  h.rows.value = [propertyRow()]
  await nextTick()
  assert.deepEqual(h.values(), [])
  t.mock.timers.tick(120)
  await h.respond(0, [{ time: start, a: 999 }])
  assert.deepEqual(h.values(), [])
  await h.report(2)
  await h.respond(1, [{ time: start - 1000, a: 3 }])
  assert.deepEqual(h.values(), [3, 2])
  h.rows.value = []
  await nextTick()
  assert.deepEqual(h.values(), [])
  t.mock.timers.tick(120)
  assert.equal(h.requests.length, 2, 'no history request for hidden properties')
  h.rows.value = [propertyRow()]
  await nextTick()
  h.scope.stop()
  t.mock.timers.tick(120)
  assert.equal(h.requests.length, 2, 'unmount clears the debounce timer')
})

test('formatted report times remain supported and missing timestamps do not create points', async t => {
  const h = sparklineHarness(t, [propertyRow({ value: '10' })])
  assert.deepEqual(h.values(), [])
  h.rows.value = [propertyRow({ value: '10', updatedAt: '2026-11-19 09:59:59' })]
  await nextTick()
  assert.deepEqual(h.values(), [10])
  h.rows.value = [propertyRow({ value: '11', updatedAt: '2026-11-19 10:00:00' })]
  await nextTick()
  assert.deepEqual(h.values(), [10, 11])
})

test('the real sparkline component moves from empty to one point to a line without duplicating the latest value', async t => {
  const harness = sparklineHarness(t)
  const filename = '../views/device/list/components/device-detail/IotDevicePropertySparkline.vue'
  const { descriptor, errors } = parse(await readFile(new URL(filename, import.meta.url), 'utf8'), { filename })
  assert.deepEqual(errors, [])
  const compiled = compileScript(descriptor, { id: 'sparkline-regression', inlineTemplate: true })
  const code = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === '@device-manager-ui/api/deviceTrend') return harness.modules.load('api/deviceTrend.ts')
    if (id.startsWith('./')) return harness.modules.load(`views/device/list/components/device-detail/${id.slice(2)}.ts`)
    return require(id)
  }, module, module.exports)
  async function renderOption() {
    let option
    const app = createSSRApp({ render: () => h(module.exports.default, {
      property: harness.rows.value[0], rows: harness.points(),
    }) })
    app.component('JEcharts', { props: ['option'], setup(props) { option = props.option; return () => h('div') } })
    await renderToString(app)
    return option
  }
  assert.equal(await renderOption(), undefined)
  t.mock.timers.tick(120)
  await harness.respond(0, [])
  await harness.report(33)
  const single = await renderOption()
  assert.deepEqual(single.series[0].data, [33])
  assert.equal(single.xAxis.boundaryGap, true)
  t.mock.timers.tick(1000)
  await harness.report(36)
  const line = await renderOption()
  assert.deepEqual(line.series[0].data, [33, 36])
  assert.equal(line.series[0].type, 'line')
  assert.equal(line.xAxis.data.length, 2)
  assert.equal(line.xAxis.boundaryGap, false)
})
