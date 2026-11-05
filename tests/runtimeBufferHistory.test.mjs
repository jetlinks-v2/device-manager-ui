import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const host = resolve(import.meta.dirname, '..')
function harness() {
  const shared = runtimeModules(), requests = []
  const source = readFileSync(resolve(host, 'views/link/diagnostics/NodeBufferHistory.vue'), 'utf8')
  const script = compileScript(parse(source).descriptor, { id: 'buffer-history-test' }).content
  const module = { exports: {} }
  const imports = id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.startsWith('@ant-design/icons')) return {}
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return { ...shared.load('../../jetlinks-web-core/src/components/RuntimeDiagnostics/buffer/observation.ts'), BufferObservationHistory: {} }
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return shared.load('../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts')
    if (id === '@jetlinks-web-core/hooks/useDiagnosticQuery') return shared.load('../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts')
    if (id.endsWith('api/link/diagnostics')) return { queryMBeans: (nodeId, signal, objectName, attributes) => new Promise(resolve => requests.push({ nodeId, signal, objectName, attributes, resolve })) }
    return shared.load(`views/link/diagnostics/${id.slice(2)}.ts`)
  }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(imports, module, module.exports)
  const name = 'org.jetlinks:type=PersistenceBuffer,name=queue'
  const snapshot = { StartTime: 1, StatisticsStartTime: 1, SampleTime: 2000, ReadTime: 2100, Generation: 1, WindowMillis: 1000,
    RowsEnabled: true, ZoneId: 'Asia/Shanghai', TodayStartTime: 1, Written: '1', Attempted: '0', Values: {}, TodayPeaks: {} }
  const props = vue.reactive({ nodeId: 'node', scopeKey: 'alice:p1', active: true, permitted: true,
    beans: [{ objectName: name, domain: 'org.jetlinks', type: 'PersistenceBuffer', name: 'queue', attributes: [{ name: 'ObservationSnapshot', available: true, value: snapshot }] }] })
  const scope = vue.effectScope()
  const view = scope.run(() => module.exports.default.setup(props, { expose() {} }))
  const raw = hour => ({ 'org.jetlinks': { PersistenceBuffer: { [name]: { '@objectName': name, '@name': 'queue',
    '@attributes': [{ name: hour ? 'HourHistory' : 'RecentHistory', available: true, readable: true }],
    [hour ? 'HourHistory' : 'RecentHistory']: { Snapshot: snapshot, Points: {} } } } } })
  return { props, scope, view, requests, raw }
}
const flush = () => new Promise(done => setImmediate(done))

test('history requests one exact queue only on open, switch and refresh, with cancellation', async () => {
  const h = harness()
  try {
    assert.equal(h.requests.length, 0)
    h.view.open.value = true
    assert.equal(h.requests.length, 1)
    assert.deepEqual(h.requests[0].attributes, ['RecentHistory'])
    assert.equal(h.requests[0].objectName, 'org.jetlinks:type=PersistenceBuffer,name=queue')
    h.view.range.value = 'hour'
    assert.equal(h.requests[0].signal.aborted, true)
    assert.deepEqual(h.requests[1].attributes, ['HourHistory'])
    h.requests[1].resolve(h.raw(true)); await flush()
    assert.equal(h.view.query.data.value.hour, true)
    h.requests[0].resolve(h.raw(false)); await flush()
    assert.equal(h.view.query.data.value.hour, true, 'late response cannot replace current range')
    h.props.beans[0].attributes[0].value = { ...h.props.beans[0].attributes[0].value, ReadTime: 2200 }
    assert.equal(h.requests.length, 2, 'ordinary summary updates do not fetch full histories')
    h.view.open.value = false
    assert.equal(h.view.query.data.value, undefined)
  } finally { h.scope.stop() }
})

test('identity, node, permission loss and disposal clear history and abort in-flight requests', () => {
  for (const change of [h => h.props.scopeKey = 'bob:p2', h => h.props.nodeId = 'other', h => h.props.permitted = false, h => h.props.active = false, h => h.scope.stop()]) {
    const h = harness()
    try {
      h.view.open.value = true
      const request = h.requests[0]
      change(h)
      assert.equal(request.signal.aborted, true)
      assert.equal(h.view.query.data.value, undefined)
      assert.equal(h.view.query.state.value.status, 'ready')
    } finally { h.scope.stop() }
  }
})
