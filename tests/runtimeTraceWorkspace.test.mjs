import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const module = { exports: {} }, { code } = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => {
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
    if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/tracePresentation') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/tracePresentation.ts'))
    return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
  }, module, module.exports)
  cache.set(path, module.exports); return module.exports
}
const { parseTraceInput } = load(resolve(import.meta.dirname, '../views/link/Tracing/parseTraceInput.ts'))
const { useTraceWorkspace, traceEntryName, traceTabLabel, traceTabId } = load(resolve(import.meta.dirname, '../views/link/Tracing/useTraceWorkspace.ts'))
const { traceRecentDuration } = load(resolve(import.meta.dirname, '../views/link/Tracing/traceRecentPresentation.ts'))
const flush = async () => { await vue.nextTick(); await new Promise(done => setImmediate(done)) }
const id = 'abcdef0123456789abcdef0123456789', parent = '0123456789abcdef'

test('trace inputs accept complete IDs and W3C version 00 headers, canonicalizing only valid input', () => {
  for (const value of [id, `  ${id.toUpperCase()}\n`, `00-${id}-${parent}-01`, ` TraceParent: 00-${id.toUpperCase()}-${parent.toUpperCase()}-FF `]) {
    assert.deepEqual(parseTraceInput(value), { valid: true, traceId: id })
  }
  for (const value of ['', '0'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), `log trace=${id}`, `traceparent: ${id}`, `00-${'0'.repeat(32)}-${parent}-01`, `00-${id}-${'0'.repeat(16)}-01`, `00-${id}-${parent}-0g`, `00-${id}-${parent}-1`, `00-${id}-${parent}-001`, `01-${id}-${parent}-01`, `ff-${id}-${parent}-01`, `00-${id}-${parent}-01-extra`, `traceparent:\n00-${id}-${parent}-01`, `00-${id}-${parent.slice(1)}-01`]) {
    assert.deepEqual(parseTraceInput(value), { valid: false }, value)
  }
})

test('merged response headers resolve only complete contexts belonging to the same trace', () => {
  const first = `00-${id}-${parent}-01`, second = `00-${id.toUpperCase()}-fedcba9876543210-00`
  const observed = '00-a16b8b024cd66080f3a1635dba3ec7a3-37f5c96098db5711-01, 00-a16b8b024cd66080f3a1635dba3ec7a3-e7e4962cf4061b60-01'
  assert.deepEqual(parseTraceInput(observed), { valid: true, traceId: 'a16b8b024cd66080f3a1635dba3ec7a3' })
  for (const value of [`${first}, ${second}`, ` TraceParent:\t${first},\t${second} `, `${first}, ${second}, ${first}`]) {
    assert.deepEqual(parseTraceInput(value), { valid: true, traceId: id }, value)
  }
  for (const value of [
    `${first}, 00-${'f'.repeat(32)}-${parent}-01`, `${first},`, `,${first}`, `${first},,${second}`,
    `${first}, \t`, `${first},\r\n${second}`, `${first},\n${second}`, `${first},\r${second}`,
    `${first}, ${id}`, `${first}, log trace=${id}`, `${first}, traceparent: ${second}`,
    `${first}, 01-${id}-${parent}-01`, `${first}, 00-${id}-${'0'.repeat(16)}-01`,
    `${first}, 00-${'0'.repeat(32)}-${parent}-01`, `${first}, 00-${id}-${parent}-0g`,
    `${first}, 00-${id}-${parent.slice(1)}-01`, `${first}, 00-${id}-${parent}-01-extra`,
  ]) {
    assert.deepEqual(parseTraceInput(value), { valid: false }, value)
  }
})

function workspace(options = {}) {
  const scope = vue.effectScope(), requests = [], allowed = vue.ref(true)
  const view = scope.run(() => useTraceWorkspace({
    allowed: () => allowed.value, errorState: error => ({ status: error?.status === 403 ? 'forbidden' : 'error', message: error?.message }),
    load: (id, signal) => new Promise((resolve, reject) => requests.push({ id, signal, resolve, reject })), ...options,
  }))
  return { view, requests, scope, allowed }
}

test('workspace keeps per-trace state, deduplicates IDs and keeps a draft outside recent records', async () => {
  const h = workspace()
  try {
    const a = h.view.open('a'); a.selectedId = 'child'; a.focusNode = 'node-a'
    h.requests[0].resolve([{ name: 'A' }]); await flush()
    const b = h.view.open('b'); h.requests[1].resolve([]); await flush()
    assert.equal(h.view.open('a').key, a.key); assert.equal(h.requests.length, 2)
    assert.equal(h.view.active.value.selectedId, 'child'); assert.equal(h.view.active.value.data[0].name, 'A')
    h.view.newQuery(); h.view.input.value = 'draft'
    assert.equal(h.view.active.value, undefined); assert.equal(h.view.tabs.value.length, 2); assert.equal(h.view.input.value, 'draft')
    const converted = h.view.open('c'); assert.equal(h.view.tabs.value.length, 3)
    h.view.close(converted.key); assert.equal(h.requests[2].signal.aborted, true); assert.equal(h.view.active.value.key, b.key)
    h.requests[2].resolve([{ name: 'closed' }]); await flush(); assert.equal(h.view.tabs.value.length, 2)
    h.view.close(b.key); assert.equal(h.view.active.value.key, a.key)
    h.view.close(a.key); assert.equal(h.view.active.value, undefined)
  } finally { h.scope.stop() }
})

test('capacity never silently evicts evidence; errors retry, refresh cancels and disposal invalidates requests', async () => {
  const h = workspace({ limit: 2 })
  try {
    const first = h.view.open('a'); h.view.open('b')
    assert.equal(h.view.open('c'), undefined); assert.equal(h.view.capacityReached.value, true)
    assert.equal(h.view.tabs.value.length, 2); assert.equal(h.view.active.value.traceId, 'b')
    h.requests[1].reject(new Error('offline')); await flush(); assert.equal(h.view.active.value.state.status, 'error')
    void h.view.refresh(); assert.equal(h.requests.length, 3)
    void h.view.refresh(); assert.equal(h.requests[2].signal.aborted, true)
    h.requests[2].resolve([{ name: 'stale' }]); await flush(); assert.equal(h.view.active.value.data, undefined)
    h.requests[3].resolve([]); await flush(); assert.equal(h.view.active.value.state.status, 'empty')
    h.view.close(first.key); assert.equal(h.requests[0].signal.aborted, true)
    h.view.open('c'); h.scope.stop(); assert.equal(h.requests[4].signal.aborted, true)
    h.requests[4].resolve([{ name: 'late' }]); await flush(); assert.equal(h.view.tabs.value.length, 0)
  } finally { h.scope.stop() }
})

test('deactivation stops pending work and resuming requests only the visible unfinished tab', async () => {
  const h = workspace()
  try {
    const a = h.view.open('a'), b = h.view.open('b')
    h.view.suspend(); assert.ok(h.requests.every(request => request.signal.aborted))
    h.view.resume(); assert.equal(h.requests.length, 3); assert.equal(h.requests[2].id, 'b')
    h.requests[0].resolve([{ name: 'late a' }]); await flush(); assert.equal(a.data, undefined)
    h.requests[2].resolve([{ name: 'B' }]); await flush()
    h.view.activate(a.key); h.view.resume(); assert.equal(h.requests.length, 4)
    h.view.activate(b.key); h.view.resume(); assert.equal(h.requests.length, 4)
    h.allowed.value = false; h.view.reset(); assert.equal(h.requests[3].signal.aborted, true)
    assert.equal(h.view.open('denied'), undefined); assert.equal(h.view.newQuery(), undefined)
  } finally { h.scope.stop() }
})

test('trace tab title uses the earliest root, or earliest valid span when no root exists', () => {
  const span = (name, start, parentSpanId) => ({ name, startWithNanos: start, parentSpanId })
  const tab = data => ({ traceId: 'id', data })
  assert.equal(traceEntryName(tab([span('leaf', '1', 'root'), span('root', '20'), span('earlier root', '10', '0000000000000000')])), 'earlier root')
  assert.equal(traceEntryName(tab([span('bad', 'invalid', 'missing'), span('later', '1790000000000000002', 'missing'), span('earliest', '1790000000000000001', 'missing')])), 'earliest')
  assert.equal(traceEntryName(tab([])), 'id')
})

test('refresh retains existing evidence while loading, but a forbidden response discards it', async () => {
  const h = workspace()
  try {
    const tab = h.view.open('a'); h.requests[0].resolve([{ name: 'A' }]); await flush()
    void h.view.refresh(); assert.equal(tab.state.status, 'loading'); assert.equal(tab.data[0].name, 'A')
    h.requests[1].resolve([{ name: 'updated' }]); await flush(); assert.equal(tab.data[0].name, 'updated')
    void h.view.refresh(); h.requests[2].reject({ status: 403 }); await flush()
    assert.equal(tab.state.status, 'forbidden'); assert.equal(tab.data, undefined)
  } finally { h.scope.stop() }
})


test('tab labels simplify only explicit platform HTTP names and preserve the original entry for tooltips', () => {
  const full = '/http/POST/visualization/resource/latest/_query'
  const tab = { traceId: 'id', data: [{ name: full, startWithNanos: '1' }] }
  assert.equal(traceEntryName(tab), full)
  assert.equal(traceTabLabel(traceEntryName(tab)), 'POST /visualization/resource/latest/_query')
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT']) assert.equal(traceTabLabel(`/http/${method}/path?a=1`), `${method} /path?a=1`)
  for (const name of ['/http/get/path', '/http/GET', '/http/CUSTOM/path', '/http/GETT/path', 'prefix/http/GET/path', '/_sql/query/logger', '/java/Handler/query', '/http/GET/path with space']) assert.equal(traceTabLabel(name), name)
  assert.equal(traceTabLabel('/http/GET/'), 'GET /')
  assert.equal(traceTabLabel('/http/GET/mbean/org.jetlinks%3Atype%3DPersistenceBuffer%2C*'), 'GET /mbean/org.jetlinks:type=PersistenceBuffer,*')
  for (const path of ['/bad%2', '/line%0Abreak', '/null%00value']) assert.equal(traceTabLabel(`/http/GET${path}`), `GET ${path}`)
  assert.equal(traceTabLabel('/java/query%20value'), '/java/query%20value')
})

test('trace tabs display distinct suffixes even when their shortest IDs collide', () => {
  const tabs = [{ traceId: '1111111111111111aaaaaaaa12345678' }, { traceId: '2222222222222222bbbbbbbb12345678' }, { traceId: '33333333333333333333333387654321' }, { traceId: '' }]
  assert.equal(traceTabId(tabs[0].traceId, tabs), 'aaaa12345678')
  assert.equal(traceTabId(tabs[1].traceId, tabs), 'bbbb12345678')
  assert.equal(traceTabId(tabs[2].traceId, tabs), '87654321')
  assert.equal(new Set(tabs.slice(0, 3).map(tab => traceTabId(tab.traceId, tabs))).size, 3)
})

test('recent duration shares locale formatting and uses exact text over unsafe numbers', () => {
  const tab = data => ({ data, state: { status: 'ready' } })
  const precise = [{
    startWithNanos: 1790000000000000000, endWithNanos: 1790000000000000000,
    startWithNanosText: '1790000000000000001', endWithNanosText: '1790000000000555556',
  }]
  assert.equal(traceRecentDuration(tab(precise), 'en'), '555.555 µs')
  assert.equal(traceRecentDuration(tab(precise), 'de-DE'), '555,555 µs')
  assert.equal(traceRecentDuration(tab([{ startWithNanos: '1000000', endWithNanos: '3000000' }]), 'en'), '2 ms')
  assert.equal(traceRecentDuration(tab([{ startWithNanos: 1790000000000000000, endWithNanos: 1790000000001000000 }])), undefined)
})

test('recent duration excludes inverted, invalid and unfinished ranges without inventing elapsed time', () => {
  const tab = data => ({ data, state: { status: 'ready' } })
  for (const span of [
    { startWithNanos: '3', endWithNanos: '2' }, { startWithNanos: 'bad', endWithNanos: '4' },
    { startWithNanos: '100', endWithNanos: '0' }, { startWithNanos: '0', endWithNanos: '0' },
  ]) assert.equal(traceRecentDuration(tab([span])), undefined)
  assert.equal(traceRecentDuration(tab([
    { startWithNanos: '0', endWithNanos: '0' }, { startWithNanos: '1000000', endWithNanos: '1250000' },
  ])), '250 µs')
})

test('recent records keep a stable MRU order when accesses share one clock millisecond', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 })
  const h = workspace()
  try {
    const a = h.view.open('a'), b = h.view.open('b')
    h.view.activate(a.key)
    assert.ok(a.accessedAt > b.accessedAt)
    h.view.open('b', { preserveInput: true })
    assert.ok(b.accessedAt > a.accessedAt)
  } finally { h.scope.stop() }
})

test('trace workspace uses one query row with recent records, refresh, and help rather than editable tabs', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../views/link/Tracing/index.vue'), 'utf8')
  assert.match(source, /:enter-button="t\('runtimeDiagnostics\.query'\)"/)
  assert.match(source, /Tracing\.recent/)
  assert.match(source, /<a-tooltip v-if="workspace\.active\.value" :title="t\('runtimeDiagnostics\.refresh'\)">\s*<a-button\s+type="text"/)
  assert.match(source, /:aria-label="t\('runtimeDiagnostics\.refresh'\)"/)
  assert.match(source, /ReloadOutlined/)
  assert.doesNotMatch(source, /editable-card|a-tabs|newQuery\)/)
  assert.match(source, /workspace\.capacityReached\.value/)
  assert.match(source, /:aria-pressed="record\.key === workspace\.activeKey\.value"/)
  assert.match(source, /:title="traceEntryName\(record\)"/)
  assert.match(source, /Tracing\.closeNamedTrace/)
  assert.doesNotMatch(source, /box-shadow:\s*inset/)
})

function overlayHarness() {
  const props = vue.reactive({ active: true }), access = vue.ref({ trace: true }), calls = []
  const view = { access, active: vue.toRef(props, 'active'), workspace: { tabs: vue.ref([]) },
    activate: key => calls.push(['activate', key]), close: key => calls.push(['close', key]) }
  const source = readFileSync(resolve(import.meta.dirname, '../views/link/Tracing/index.vue'), 'utf8')
  const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)[1]
    + '\nmodule.exports = { recentOpen, helpOpen, recentTrigger, helpTrigger, setRecentOpen, setHelpOpen, closeRecent, closeHelp, selectRecent, closeRecord }'
  const { code } = transformSync(script, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  const imports = name => name === 'vue' ? vue : name === 'vue-i18n' ? { useI18n: () => ({ t: key => key, locale: vue.ref('en') }) }
    : name === './useClusterTrace' ? { useClusterTrace: () => view } : {}
  const scope = vue.effectScope()
  scope.run(() => new Function('require', 'module', 'exports', 'defineProps', code)(imports, module, module.exports, () => props))
  return { ...module.exports, scope, props, access, calls }
}

test('recent and help overlays close and restore focus without stealing focus after deactivation or revoke', async () => {
  const h = overlayHarness(), focused = []
  h.recentTrigger.value = { focus: () => focused.push('recent') }
  h.helpTrigger.value = { focus: () => focused.push('help') }
  try {
    h.setRecentOpen(true); assert.equal(h.recentOpen.value, true)
    await h.closeRecent(true); assert.deepEqual(focused, ['recent'])
    h.setRecentOpen(true); h.selectRecent('a'); await flush()
    assert.equal(h.recentOpen.value, false); assert.deepEqual(h.calls, [['activate', 'a']])
    h.setRecentOpen(true); h.closeRecord('a'); await flush()
    assert.equal(h.recentOpen.value, false); assert.deepEqual(h.calls.at(-1), ['close', 'a'])
    h.setHelpOpen(true); await h.closeHelp(true); assert.equal(focused.at(-1), 'help')
    h.setRecentOpen(true); h.setHelpOpen(true); assert.equal(h.recentOpen.value, false)
    h.props.active = false
    assert.equal(h.helpOpen.value, false)
    const count = focused.length
    await h.closeHelp(true); h.setRecentOpen(true); assert.equal(h.recentOpen.value, false)
    assert.equal(focused.length, count)
    h.props.active = true; h.setRecentOpen(true); h.access.value = { trace: false }
    assert.equal(h.recentOpen.value, false)
    h.setHelpOpen(true); assert.equal(h.helpOpen.value, false)
  } finally { h.scope.stop() }
})

test('empty trace presentation has one owner: TraceTabPanel always delegates to TraceViewer', () => {
  const source = readFileSync(resolve(import.meta.dirname, '../views/link/Tracing/TraceTabPanel.vue'), 'utf8')
  assert.match(source, /<TraceViewer :active="active"/)
  assert.doesNotMatch(source, /trace-no-records|noTraceRecords|<a-empty/)
})
