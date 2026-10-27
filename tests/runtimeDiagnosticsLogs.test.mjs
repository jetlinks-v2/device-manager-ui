import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { Observable } from 'rxjs'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const directory = { id: 'logs', name: 'logs', directory: true, providerId: 'log', operations: [] }
const archive = { id: 'archive', name: 'history.zip', directory: false, providerId: 'log', operations: ['download'] }
const current = { id: 'current', name: 'application.log', directory: false, providerId: 'log', operations: ['download'] }
const key = (id, entry = '') => JSON.stringify(['log', id, entry])
function harness(options = {}) {
  const cache = new Map(), reads = [], downloads = [], deactivations = [], activations = [], consoleObservers = []
  let consoleStops = 0
  const access = vue.ref({ logs: true, exportLogs: true })
  const node = vue.ref('node-a'), tab = vue.ref(options.tab ?? 'logs')
  const route = vue.reactive({ query: {} })
  const api = {
    logRoots: options.logRoots ?? (async () => [directory, current]), logChildren: async () => [archive], logEntries: async () => ['app.log'], statLog: async () => ({ size: 100 }),
    readLog: async (node, file, signal, position, direction) => {
      reads.push({ node, file, position, direction, signal })
      return { lines: ['ERROR traceId=0123456789abcdef failure'], previousPosition: 0, nextPosition: 100, truncated: false }
    },
    downloadLog: async (node, file) => { downloads.push({ node, file }); return new Blob(['archive']) },
    saveDiagnosticFile: (data, name) => downloads.push({ name }),
  }
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename)
    const module = { exports: {} }
    const source = readFileSync(filename, 'utf8')
    const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'log-context' }).content : source
    const { code } = transformSync(script, { loader: 'ts', format: 'cjs' })
    const imports = id => {
      if (id === 'vue') return { ...vue, onActivated: callback => activations.push(callback), onDeactivated: callback => deactivations.push(callback) }
      if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
      if (id === 'vue-router') return { useRoute: () => route, useRouter: () => ({ push() {} }) }
      if (id === '@vueuse/core') return { useElementVisibility: () => vue.ref(false) }
      if (id.endsWith('.vue')) return {}
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return { LogViewer: {} }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === './useDiagnosticPreferences') return { useDiagnosticPreferences: () => undefined }
      if (id.endsWith('api/link/diagnostics')) return api
      if (id.endsWith('api/link/runtimeLogStream')) return { runtimeLogStream: () => new Observable(observer => { consoleObservers.push(observer); return () => consoleStops++ }) }
      if (id === './useDiagnosticsAccess') return { useDiagnosticsAccess: () => access }
      if (id === '@jetlinks-web-core/hooks/useDiagnosticQuery') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/hooks/useDiagnosticQuery.ts'))
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils') return load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts'))
      return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
    }
    new Function('require', 'module', 'exports', code)(imports, module, module.exports)
    cache.set(filename, module.exports)
    return module.exports
  }
  const { useNodeLogs } = load(resolve(import.meta.dirname, '../views/link/diagnostics/useNodeLogs.ts'))
  const scope = vue.effectScope(), view = scope.run(() => useNodeLogs(node, tab))
  const { normalizeLogs } = load(resolve(import.meta.dirname, '../views/link/diagnostics/normalize.ts'))
  return { view, scope, reads, downloads, access, node, tab, deactivations, activations, api, normalizeLogs, route,
    consoleObservers, consoleStops: () => consoleStops,
    console: () => scope.run(() => load(resolve(import.meta.dirname, '../views/link/diagnostics/useRuntimeConsole.ts')).useRuntimeConsole(node, vue.computed(() => tab.value === 'logs'), vue.computed(() => access.value.logs))),
    panel: () => scope.run(() => load(resolve(import.meta.dirname, '../views/link/diagnostics/NodeLogPanel.vue')).default.setup({ nodeId: 'node-a', traceId: '', active: true }, { expose() {} })),
  }
}
const flush = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)) }

test('tree branches load on demand, deduplicate requests and cache independently of expansion and reading', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const window = h.view.windowData.value, a = { ...directory, id: 'a' }, b = { ...directory, id: 'b' }
    h.view.tree.setRoots([a, b, current])
    const pending = new Map(), calls = []
    h.api.logChildren = (_, file) => { calls.push(file.id); return new Promise(resolve => pending.set(file.id, resolve)) }
    assert.equal(calls.length, 0)
    const first = h.view.tree.load(key('a')), duplicate = h.view.tree.load(key('a')), second = h.view.tree.load(key('b'))
    assert.equal(first, duplicate)
    h.view.tree.setExpanded([key('a'), key('b')]); await flush()
    assert.deepEqual(calls, ['a', 'b'])
    h.view.tree.setExpanded([key('b')])
    pending.get('b')([{ ...current, id: 'b-file' }]); await second
    pending.get('a')([{ ...current, id: 'a-file' }]); await first
    assert.equal(h.view.tree.locate(key('a-file')).parents[0].id, 'a')
    assert.equal(h.view.tree.locate(key('b-file')).parents[0].id, 'b')
    assert.deepEqual(h.view.tree.expandedKeys.value, [key('b')], 'late directory completion must not reopen a folded branch')
    await h.view.tree.load(key('a')); assert.equal(calls.length, 2)
    assert.equal(h.view.windowData.value, window); assert.equal(h.view.file.value.id, 'current')
    h.view.tree.reveal([a]); assert.deepEqual(h.view.tree.expandedKeys.value, [key('b'), key('a')])
  } finally { h.scope.stop() }
})

test('tree errors retry locally, empty folders stay explicit and ZIP entry identity differs from GZ leaves', async () => {
  const h = harness()
  try {
    await flush()
    const root = { ...directory, id: 'retry' }, empty = { ...directory, id: 'empty' }, gz = { ...current, id: 'gzip', name: 'app.log.gz' }
    h.view.tree.setRoots([root, empty])
    h.api.logChildren = async () => { throw new Error('Directory offline') }
    await assert.rejects(h.view.tree.load(key('retry')), /offline/)
    const failed = h.view.tree.nodes.value.find(node => node.file.id === 'retry').children.at(-1)
    assert.equal(failed.state.status, 'error'); assert.equal(failed.branchKey, key('retry')); assert.equal(failed.selectable, false)
    h.api.logChildren = async (_, file) => file.id === 'empty' ? [] : [archive, gz]
    await h.view.tree.load(key('retry'), true); await h.view.tree.load(key('archive'))
    const entry = h.view.tree.locate(key('archive', 'app.log'))
    assert.deepEqual(entry.parents.map(file => file.id), ['retry', 'archive'])
    assert.equal(entry.file.name, 'app.log'); assert.equal(entry.file.exportName, 'history.zip')
    const leaf = h.view.tree.nodes.value.find(node => node.file.id === 'retry').children.find(node => node.file.id === 'gzip')
    assert.equal(leaf.isLeaf, true); assert.equal(leaf.selectable, true)
    await assert.rejects(h.view.tree.load(key('gzip')), /unavailable/)
    await h.view.tree.load(key('empty'))
    assert.equal(h.view.tree.nodes.value.find(node => node.file.id === 'empty').children[0].state.status, 'empty')
    assert.ok(h.view.tree.loadedKeys.value.includes(key('empty')))
  } finally { h.scope.stop() }
})

test('tree cancellation rejects late results, retains confirmed branches and clears on node or permission change', async () => {
  const h = harness()
  try {
    await flush()
    const root = { ...directory, id: 'pending' }
    h.view.tree.setRoots([directory, root, current]); h.view.tree.setExpanded([key('logs'), key('pending')])
    let complete, signal
    h.api.logChildren = async (_, file, nextSignal) => { signal = nextSignal; return new Promise(resolve => complete = resolve) }
    const loading = h.view.tree.load(key('pending')).catch(error => error)
    await flush(); h.tab.value = ''; await flush(); assert.equal(signal.aborted, true)
    complete([{ ...current, id: 'late' }]); assert.equal((await loading).name, 'AbortError')
    assert.equal(h.view.tree.locate(key('late')), undefined)
    assert.ok(h.view.tree.locate(key('archive')), 'completed branches remain cached when the workspace hides')
    assert.ok(!h.view.tree.loadedKeys.value.includes(key('pending')))
    h.tab.value = 'logs'; await flush()
    h.view.tree.reveal([directory]); assert.ok(h.view.tree.expandedKeys.value.includes(key('pending')))
    const next = h.view.tree.load(key('pending')).catch(error => error); await flush()
    const oldNodeSignal = signal, oldNodeComplete = complete
    h.node.value = 'node-b'; await flush(); assert.equal(oldNodeSignal.aborted, true)
    oldNodeComplete([{ ...current, id: 'old-node' }]); await next
    assert.equal(h.view.tree.locate(key('old-node')), undefined)
    h.access.value = { logs: false, exportLogs: false }; await flush()
    assert.deepEqual(h.view.tree.roots.value, []); assert.deepEqual(h.view.tree.expandedKeys.value, [])
  } finally { h.scope.stop() }
})

test('file changes commit only after success and failures keep the old file and readable evidence', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const other = { ...current, id: 'other', name: 'other.log' }, before = h.view.windowData.value, entries = h.view.entries.value
    h.view.tree.setRoots([current, other])
    for (const status of [500, 403, 404]) {
      h.api.readLog = async () => { throw { status, message: 'New file unavailable' } }
      assert.equal(await h.view.select(key('other')), false)
      assert.equal(h.view.fileId.value, key('current')); assert.equal(h.view.windowData.value, before)
      assert.equal(h.view.entries.value, entries); assert.equal(h.view.state.value.status, 'stale')
      const reads = h.reads.length
      assert.equal(await h.view.select(key('current')), true)
      assert.equal(h.view.state.value.status, 'ready', 'dismissing a failed target by selecting the current file restores its successful state')
      assert.equal(h.view.windowData.value, before); assert.equal(h.reads.length, reads)
    }
    let complete
    h.api.readLog = async () => new Promise(resolve => complete = resolve)
    const selection = h.view.select(key('other')); await flush()
    assert.equal(h.view.selectingKey.value, key('other')); assert.equal(h.view.fileId.value, key('current'))
    assert.equal(h.view.windowData.value, before)
    complete({ lines: ['INFO other file'], startPosition: 0, endPosition: 20 }); assert.equal(await selection, true)
    assert.equal(h.view.fileId.value, key('other')); assert.equal(h.view.entries.value[0].text, 'INFO other file')
    assert.equal(h.view.selectingKey.value, ''); assert.equal(h.view.state.value.status, 'ready')
    h.api.readLog = async () => { throw { status: 403 } }; await h.view.read()
    assert.equal(h.view.windowData.value, undefined); assert.equal(h.view.state.value.status, 'forbidden', 'refusal of the current file still clears that evidence')
  } finally { h.scope.stop() }
})

test('returning to the current file cancels pending selection and only the latest new file can commit', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    h.view.tree.setRoots([current, { ...current, id: 'a' }, { ...current, id: 'b' }])
    const pending = new Map(), signals = new Map(), before = h.view.windowData.value
    h.api.readLog = async (_, file, signal) => { signals.set(file.id, signal); return new Promise(resolve => pending.set(file.id, resolve)) }
    const abandoned = h.view.select(key('a')); await flush()
    assert.equal(await h.view.select(key('current')), true); assert.equal(signals.get('a').aborted, true)
    pending.get('a')({ lines: ['late a'], startPosition: 0, endPosition: 20 }); await abandoned
    assert.equal(h.view.fileId.value, key('current')); assert.equal(h.view.windowData.value, before)
    const first = h.view.select(key('a')); await flush()
    const last = h.view.select(key('b')); await flush(); assert.equal(signals.get('a').aborted, true)
    pending.get('b')({ lines: ['latest b'], startPosition: 0, endPosition: 20 }); assert.equal(await last, true)
    pending.get('a')({ lines: ['late a again'], startPosition: 0, endPosition: 20 }); await first
    assert.equal(h.view.fileId.value, key('b')); assert.equal(h.view.entries.value[0].text, 'latest b')
  } finally { h.scope.stop() }
})

test('tree refresh reloads expanded branches only and a root refresh failure keeps known files', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const a = { ...directory, id: 'a' }, b = { ...directory, id: 'b' }, calls = []
    h.api.logRoots = async () => [a, b, current]
    h.api.logChildren = async (_, file) => { calls.push(file.id); return [{ ...current, id: `${file.id}-file` }] }
    await h.view.discoverProviders(true)
    await h.view.tree.load(key('a')); await h.view.tree.load(key('b'))
    h.view.tree.setExpanded([key('a')]); await h.view.refreshTree()
    assert.deepEqual(calls, ['a', 'b', 'a'])
    const known = h.view.tree.nodes.value, window = h.view.windowData.value
    h.api.logRoots = async () => { throw new Error('Temporary provider error') }; await h.view.refreshTree()
    assert.equal(h.view.tree.nodes.value, known); assert.equal(h.view.windowData.value, window)
    assert.equal(h.view.providers.state.value.status, 'error')
  } finally { h.scope.stop() }
})

test('related log time survives login query cleanup and omits invalid or ambiguous ranges', () => {
  const h = harness(), panel = h.panel()
  try {
    h.route.query = { logFrom: '1790000000000', logTo: '1790000001000', from: 'login', spanId: 'span-a' }
    const before = panel.relatedTime.value
    assert.ok(before.includes(' – ')); assert.ok(!before.includes('Invalid Date'))
    delete h.route.query.from
    assert.equal(panel.relatedTime.value, before)
    assert.equal(panel.spanId.value, 'span-a')
    for (const query of [{ from: '1790000000000', to: '1790000001000' }, { logFrom: 'bad', logTo: '1790000001000' }, { logFrom: '1790000001000', logTo: '1790000000000' }, { logFrom: '1e20', logTo: '1e20' }, { logFrom: ['1790000000000'], logTo: '1790000001000' }]) {
      h.route.query = query; assert.equal(panel.relatedTime.value, '')
    }
  } finally { h.scope.stop() }
})

test('ZIP entries can return to their parent and export with the archive filename', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('logs')); await h.view.select(key('archive'))
    assert.equal(h.view.parents.value.length, 2)
    await h.view.select(key('archive', 'app.log'))
    assert.equal(h.reads.at(-1).file.entry, 'app.log')
    h.view.download(); await flush()
    assert.equal(h.downloads.at(-1).name, 'history.zip')
    await h.view.parent()
    assert.equal(h.view.catalog.data.value[0].name, 'history.zip')
    await h.view.parent()
    assert.equal(h.view.catalog.data.value[0].name, 'logs')
  } finally { h.scope.stop() }
})

test('paging pauses following and revoked permission blocks reads and exports', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('logs')); await h.view.select(key('archive')); await h.view.select(key('archive', 'app.log'))
    h.view.following.value = true
    await h.view.page(0)
    assert.equal(h.view.following.value, false)
    assert.equal(h.reads.at(-1).position, 0)
    h.access.value = { logs: false, exportLogs: false }; await flush()
    const count = h.reads.length
    await h.view.read(); h.view.download(); await flush()
    assert.equal(h.reads.length, count)
    assert.equal(h.downloads.length, 0)
    assert.equal(h.view.windowQuery.data.value, undefined)
    assert.equal(h.view.state.value.status, 'forbidden')
  } finally { h.scope.stop() }
})

test('following retains the displayed window during I/O and pausing rejects the pending update', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const before = h.view.entries.value[0].text, beforeEntries = h.view.entries.value, beforeWindow = h.view.windowData.value
    let resolve
    h.api.readLog = async () => new Promise(done => { resolve = done })
    h.view.follow(true); await flush()
    assert.equal(h.view.following.value, true)
    assert.equal(h.view.windowQuery.state.value.status, 'loading')
    assert.equal(h.view.state.value.status, 'ready', 'background following must not ask the viewer to spin or blur cached text')
    assert.equal(h.view.entries.value, beforeEntries, 'pending I/O must retain row identity and scroll anchors')
    assert.equal(h.view.windowData.value, beforeWindow)
    assert.equal(h.view.entries.value[0].text, before)
    h.view.follow(false)
    resolve({ lines: ['INFO new arrival'], startPosition: 101, endPosition: 200 })
    await flush()
    assert.equal(h.view.entries.value[0].text, before)
    assert.equal(h.view.entries.value, beforeEntries)
    assert.equal(h.view.windowData.value, beforeWindow, 'pausing must discard a late follow response without shifting the window')
    h.api.readLog = async () => ({ lines: ['INFO rotated'], startPosition: 0, endPosition: 10 })
    h.api.statLog = async () => ({ size: 10 })
    await h.view.read()
    assert.equal(h.view.notice.value, 'RuntimeMonitor.logRotated')
    assert.equal(h.view.entries.value[0].text, 'INFO rotated')
  } finally { h.scope.stop() }
})

test('first log load can spin while cached manual refresh stays readable and failures retain stale text', async () => {
  const h = harness()
  try {
    await flush()
    let complete
    h.api.readLog = async () => new Promise(done => { complete = done })
    const first = h.view.select(key('current')); await flush()
    assert.equal(h.view.state.value.status, 'loading')
    complete({ lines: ['initial log'], startPosition: 30, endPosition: 40 }); await first
    const entries = h.view.entries.value, window = h.view.windowData.value
    const refresh = h.view.read(); await flush()
    assert.equal(h.view.state.value.status, 'ready')
    assert.equal(h.view.entries.value, entries); assert.equal(h.view.windowData.value, window)
    complete({ lines: ['refreshed log'], startPosition: 30, endPosition: 50 }); await refresh
    assert.equal(h.view.entries.value[0].text, 'refreshed log')
    h.api.readLog = async () => { throw new Error('Network unavailable') }
    await h.view.read()
    assert.equal(h.view.state.value.status, 'stale'); assert.equal(h.view.state.value.message, 'Network unavailable')
    assert.equal(h.view.entries.value[0].text, 'refreshed log')
    assert.equal(h.view.following.value, false)
  } finally { h.scope.stop() }
})

test('resume requests the latest window, and searching or changing display pauses before late responses arrive', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current')); await h.view.page(20)
    const old = h.view.windowData.value
    let complete
    h.api.readLog = async (node, file, signal, position, direction) => {
      h.reads.push({ node, file, signal, position, direction }); return new Promise(done => { complete = done })
    }
    h.view.follow(true); await flush()
    assert.equal(h.reads.at(-1).position, undefined); assert.equal(h.reads.at(-1).direction, 'backward')
    assert.equal(h.view.windowData.value, old, 'resume must not replace or jump the old window until the tail arrives')
    h.view.search('error'); assert.equal(h.view.following.value, false)
    complete({ lines: ['new latest record'], startPosition: 100, endPosition: 200 }); await flush()
    assert.equal(h.view.windowData.value, old, 'a late response after searching cannot move the reading position')
    h.view.follow(true); await flush()
    h.view.configure({ wrap: false, level: 'ERROR' }); assert.equal(h.view.following.value, false)
    complete({ lines: ['another latest record'], startPosition: 200, endPosition: 300 }); await flush()
    assert.equal(h.view.windowData.value, old)
  } finally { h.scope.stop() }
})

test('platform Spring Boot records split cleanly while unknown formats and multiline stacks stay intact', async () => {
  const h = harness()
  try {
    await flush()
    h.api.readLog = async () => ({ startPosition: 20, endPosition: 200, lines: [
      '2026-10-22 12:34:56.789  WARN 4512 --- [reactor-http-nio-3] org.jetlinks.Service : traceId=0123456789abcdef Request failed',
      '\tat org.jetlinks.Service.run(Service.java:12)',
      '  Caused by: java.lang.IllegalStateException: failure',
      '[custom] message mentions ERROR without a declared level',
    ] })
    await h.view.select(key('current'))
    const [record, unknown] = h.view.entries.value
    assert.equal(record.time, '2026-10-22 12:34:56.789'); assert.equal(record.level, 'WARN')
    assert.equal(record.thread, 'reactor-http-nio-3'); assert.equal(record.message, 'traceId=0123456789abcdef Request failed')
    assert.equal(record.traceId, '0123456789abcdef'); assert.match(record.stack, /Caused by/)
    assert.equal(record.id, '20:0'); assert.match(record.raw, /\n\tat/)
    assert.equal(unknown.level, undefined); assert.equal(unknown.thread, undefined); assert.equal(unknown.message, unknown.raw)
  } finally { h.scope.stop() }
})

const header = (level, message) => `2026-10-22 12:34:56.789 ${level} 4512 --- [reactor-http-nio-3] org.jetlinks.Service : ${message}`
test('empty log headers own unindented body, separators and exceptions until the next record', () => {
  const h = harness()
  try {
    const body = ['', '=================', 'Check the database connection settings.', '=================', '']
    const stack = ['io.r2dbc.postgresql.client.ReactorNettyClient$PostgresConnectionException: connection failed', '\tat app.Database.connect(Database.java:12)']
    const lines = [header('WARN', body[0]), ...body.slice(1), ...stack, header('INFO', 'Application started')]
    const entries = h.normalizeLogs(lines, 40)
    assert.equal(entries.length, 2)
    assert.equal(entries[0].id, '40:0'); assert.equal(entries[0].level, 'WARN')
    // The blank immediately before the exception belongs to the stack; the full original remains lossless.
    assert.equal(entries[0].message, body.slice(1, -1).join('\n'))
    assert.equal(entries[0].stack, ['', ...stack].join('\n'))
    assert.equal(entries[0].raw, lines.slice(0, -1).join('\n'))
    assert.equal(entries[1].message, 'Application started')
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('free-form multiline messages and blank lines share one record without inventing a stack', () => {
  const h = harness()
  try {
    const body = ['Notice', '', 'Unindented first paragraph.', '', 'Second paragraph, with ERROR as ordinary text.', '']
    const lines = [header('INFO', body[0]), ...body.slice(1), header('WARN', 'Next record'), '2026/10/22 12:35:00 custom format', 'unattributed text']
    const entries = h.normalizeLogs(lines)
    assert.equal(entries.length, 4)
    assert.equal(entries[0].message, body.join('\n')); assert.equal(entries[0].stack, undefined)
    assert.equal(entries[1].message, 'Next record')
    assert.equal(entries[2].time, undefined); assert.equal(entries[3].level, undefined)
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('an empty header adds no display-only blank line while explicit blank body lines remain lossless', () => {
  const h = harness()
  try {
    const lines = [header('INFO', ''), '', '', 'First paragraph.', '', 'Second paragraph.']
    const [entry] = h.normalizeLogs(lines)
    assert.equal(entry.message, '\n\nFirst paragraph.\n\nSecond paragraph.')
    assert.equal(entry.raw, lines.join('\n')); assert.equal(entry.text, entry.raw)
  } finally { h.scope.stop() }
})

test('exception trailers remain with their structured record but independent prefixes end attribution', () => {
  const h = harness()
  try {
    const lines = [header('ERROR', 'Failed'), 'java.lang.IllegalStateException: failure', '\tat app.Worker.run(Worker.java:1)', '',
      'Additional diagnostic context.', '[custom] independent message', 'separate text', header('INFO', 'Next')]
    const entries = h.normalizeLogs(lines)
    assert.equal(entries.length, 4)
    assert.equal(entries[0].message, 'Failed'); assert.equal(entries[0].stack, lines.slice(1, 5).join('\n'))
    assert.equal(entries[1].time, undefined); assert.equal(entries[2].level, undefined)
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('Java root exceptions and Reactor assembly/checkpoint sections form one lossless log record', () => {
  const h = harness()
  try {
    const lines = [header('ERROR', 'Request failed'), '',
      'java.lang.IllegalAccessException: access denied',
      '\tat java.base/jdk.internal.reflect.Reflection.newIllegalAccessException(Reflection.java:394)',
      'Suppressed: The stacktrace has been enhanced by Reactor, refer to additional information below:',
      'Assembly trace from producer [reactor.core.publisher.MonoFlatMap] :',
      '\treactor.core.publisher.Mono.flatMap(Mono.java:3094)',
      '\torg.jetlinks.Service.request(Service.java:22)',
      'Error has been observed at the following site(s):',
      '\t*__checkpoint ⇢ Handler org.jetlinks.Service [DispatcherHandler]',
      '\t|_ Mono.flatMap ⇢ at org.jetlinks.Service.request(Service.java:22)',
      'Original Stack Trace:',
      '\tat org.jetlinks.Service.request(Service.java:22)',
      '\t...16 frames excluded',
      'Caused by: org.example.CustomFailure: nested failure',
      '\tat org.example.Client.request(Client.java:9)',
      '\t... 3 common frames omitted',
    ]
    const entries = h.normalizeLogs(lines, 300)
    assert.equal(entries.length, 1)
    assert.equal(entries[0].id, '300:0'); assert.equal(entries[0].level, 'ERROR')
    assert.equal(entries[0].message, 'Request failed')
    assert.equal(entries[0].raw, lines.join('\n')); assert.equal(entries[0].text, lines.join('\n'))
    assert.equal(entries[0].stack, lines.slice(1).join('\n'))
  } finally { h.scope.stop() }
})

test('a complete structured header always ends the previous exception and starts its own record', () => {
  const h = harness()
  try {
    const lines = [header('ERROR', 'First failure'), 'java.lang.IllegalStateException: first', '\tat org.jetlinks.Service.first(Service.java:1)',
      header('WARN', 'Second failure'), 'org.example.CustomFailure: second', '\tat org.example.Client.second(Client.java:2)', header('INFO', 'Recovered')]
    const entries = h.normalizeLogs(lines)
    assert.equal(entries.length, 3)
    assert.deepEqual(entries.map(entry => entry.level), ['ERROR', 'WARN', 'INFO'])
    assert.equal(entries[0].raw, lines.slice(0, 3).join('\n')); assert.equal(entries[1].raw, lines.slice(3, 6).join('\n'))
    assert.equal(entries[2].raw, lines[6]); assert.equal(entries[2].stack, undefined)
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('unknown text interrupts exception ownership and ordinary at-prefixed text stays independent', () => {
  const h = harness()
  try {
    const lines = [header('ERROR', 'Failed'), 'java.lang.IllegalStateException: failure', '\tat org.jetlinks.Service.run(Service.java:1)', '',
      '[custom] independent message', 'at home without a Java frame', 'org.example.Logger: ordinary application text', '\tat org.example.Worker.run(Worker.java:2)',
      'another independent message', '', header('INFO', 'Next')]
    const entries = h.normalizeLogs(lines)
    assert.equal(entries[0].raw, lines.slice(0, 4).join('\n'))
    assert.equal(entries[1].raw, lines[4]); assert.equal(entries[2].raw, lines[5])
    assert.equal(entries[3].raw, lines.slice(6, 8).join('\n'), 'a custom throwable requires the following Java frame as evidence')
    assert.equal(entries[3].level, undefined, 'an unknown message ends attribution to the earlier ERROR')
    assert.equal(entries[4].raw, lines[8]); assert.equal(entries[5].raw, '')
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('a window beginning inside a Java/Reactor stack keeps fragments together without inventing metadata', () => {
  const h = harness()
  try {
    const lines = ['\tat org.jetlinks.Service.run(Service.java:1)', '\t... 12 more',
      'Error has been observed at the following site(s):', '\t*__checkpoint ⇢ org.jetlinks.Service [DefaultWebFilterChain]',
      'Original Stack Trace:', '\tat org.jetlinks.Service.next(Service.java:2)', '', header('INFO', 'Next')]
    const entries = h.normalizeLogs(lines, 600)
    assert.equal(entries.length, 2); assert.equal(entries[0].id, '600:0')
    assert.equal(entries[0].time, undefined); assert.equal(entries[0].level, undefined); assert.equal(entries[0].thread, undefined)
    assert.equal(entries[0].raw, lines.slice(0, -1).join('\n')); assert.equal(entries[1].level, 'INFO')
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('production MqttMessage.print field block and payload remain one message with a separate throwable stack', () => {
  const h = harness()
  try {
    // MqttMessage.print: qos/topic, four top-level fields, blank separator, then arbitrary payload.
    const body = ['handle mqtt message [device-1] error:qos0 /devices/test', 'messageId: 7', 'dup: false', 'retain: false', 'will: false', '', '<released>']
    const stack = ['java.lang.IllegalStateException: channel closed', '\tat org.jetlinks.Worker.run(Worker.java:12)']
    const lines = [header('ERROR', body[0]), ...body.slice(1), ...stack, header('INFO', 'next record')]
    const entries = h.normalizeLogs(lines, 1200)
    assert.equal(entries.length, 2); assert.equal(entries[0].id, '1200:0')
    assert.equal(entries[0].message, body.join('\n')); assert.equal(entries[0].stack, stack.join('\n'))
    assert.equal(entries[0].level, 'ERROR'); assert.equal(entries[0].raw, lines.slice(0, -1).join('\n'))
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('generic request fields and JSON payload preserve indentation and blank lines without absorbing independent formats', () => {
  const h = harness()
  try {
    const body = ['request dump', 'method: POST', 'path: /api/data', '', '{', '  "payload": {', '    "text": "value with [brackets]"', '  }', '}', '']
    const lines = [header('INFO', body[0]), ...body.slice(1), '[custom] independent message', 'unknown independent text', header('WARN', 'next')]
    const entries = h.normalizeLogs(lines)
    assert.equal(entries.length, 4); assert.equal(entries[0].message, body.join('\n')); assert.equal(entries[0].stack, undefined)
    assert.equal(entries[1].message, '[custom] independent message'); assert.equal(entries[1].time, undefined)
    assert.equal(entries[2].message, 'unknown independent text'); assert.equal(entries[2].level, undefined)
    assert.equal(entries.map(entry => entry.raw).join('\n'), lines.join('\n'))
  } finally { h.scope.stop() }
})

test('indented ordinary continuations are body text, and a headerless field fragment never invents metadata', () => {
  const h = harness()
  try {
    const body = ['response:', '', '  status=ready', '  values=[1, 2]', '', '  nested: value']
    const entries = h.normalizeLogs([header('DEBUG', body[0]), ...body.slice(1), header('INFO', 'next')])
    assert.equal(entries.length, 2); assert.equal(entries[0].message, body.join('\n')); assert.equal(entries[0].stack, undefined)
    const fragment = h.normalizeLogs(['status: ready', 'attempt: 3', '', 'plain payload'], 700)
    assert.equal(fragment.length, 1); assert.equal(fragment[0].id, '700:0'); assert.equal(fragment[0].time, undefined); assert.equal(fragment[0].level, undefined)
    assert.equal(fragment[0].message, 'status: ready\nattempt: 3\n\nplain payload'); assert.equal(fragment[0].stack, undefined)
  } finally { h.scope.stop() }
})


test('returning to logs retains the reading window and filter, leaves follow paused and ignores late responses', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current')); h.view.search('error')
    const window = h.view.windowData.value, entries = h.view.entries.value, catalog = h.view.catalog.data.value
    let complete, signal
    h.api.readLog = async (node, file, nextSignal) => { signal = nextSignal; return new Promise(done => complete = done) }
    h.view.follow(true); await flush()
    h.tab.value = ''; await flush(); assert.equal(signal.aborted, true)
    complete({ lines: ['late'], startPosition: 100, endPosition: 200 }); await flush()
    h.tab.value = 'logs'; await flush()
    assert.equal(h.view.windowData.value, window); assert.equal(h.view.entries.value, entries); assert.equal(h.view.catalog.data.value, catalog)
    assert.equal(h.view.filter.value, 'error'); assert.equal(h.view.following.value, false); assert.equal(h.view.fileId.value, key('current'))
    h.deactivations.forEach(callback => callback()); await flush()
    h.activations.forEach(callback => callback()); await flush()
    assert.equal(h.view.windowData.value, window); assert.equal(h.view.following.value, false)
    h.api.readLog = async () => { throw { status: 403 } }; await h.view.read()
    assert.equal(h.view.windowData.value, undefined); assert.equal(h.view.catalog.data.value, catalog, 'a file refusal does not erase the independently browsed directory')
    assert.equal(h.view.state.value.status, 'forbidden')
  } finally { h.scope.stop() }
})

test('a cancelled directory navigation retains one coherent catalog, breadcrumb and reading window', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const window = h.view.windowData.value, catalog = h.view.catalog.data.value
    let complete, signal
    h.api.logChildren = async (node, file, nextSignal) => { signal = nextSignal; return new Promise(done => complete = done) }
    const navigation = h.view.select(key('logs')); await flush()
    assert.equal(h.view.catalog.data.value, catalog); assert.equal(h.view.parents.value.length, 0); assert.equal(h.view.windowData.value, window)
    h.tab.value = ''; await flush(); assert.equal(signal.aborted, true)
    complete([archive]); await navigation
    h.tab.value = 'logs'; await flush()
    assert.equal(h.view.catalog.data.value, catalog); assert.equal(h.view.parents.value.length, 0)
    assert.equal(h.view.windowData.value, window); assert.equal(h.view.fileId.value, key('current'))
    h.api.logChildren = async () => [archive]; await h.view.select(key('logs'))
    assert.equal(h.view.catalog.data.value[0].id, 'archive'); assert.equal(h.view.parents.value[0].id, 'logs')
    assert.equal(h.view.windowData.value, window, 'successful directory navigation preserves the selected reading context')
    assert.equal(h.view.fileId.value, key('current'))
  } finally { h.scope.stop() }
})

test('initial discovery opens newest active readable file without unpacking archives', async () => {
  const h = harness()
  try {
    await flush()
    const older = { ...current, id: 'older', operations: ['readWindow'], lastModified: 10, current: true }
    const newest = { ...current, id: 'latest', operations: ['readWindow'], lastModified: 20, current: true }
    const archived = { ...archive, operations: ['readWindow'], lastModified: 100 }
    h.api.logRoots = async () => [directory]
    h.api.logChildren = async () => [older, newest, archived]
    await h.view.roots()
    assert.equal(h.view.file.value.id, 'latest'); assert.equal(h.view.parents.value[0].id, 'logs')
    assert.equal(h.reads.at(-1).file.id, 'latest'); assert.equal(h.reads.at(-1).position, undefined)
  } finally { h.scope.stop() }
})

test('scroll windows prepend and append by cursor and rotation returns to actual latest content', async () => {
  const h = harness()
  try {
    await flush()
    h.api.readLog = async () => ({ lines: ['middle'], startPosition: 10, endPosition: 20, previousPosition: 10, nextPosition: 20 })
    await h.view.select(key('current'))
    const id = h.view.entries.value[0].id
    h.api.readLog = async () => ({ lines: ['earlier'], startPosition: 0, endPosition: 10, nextPosition: 10 })
    await h.view.page(10)
    assert.deepEqual(h.view.entries.value.map(entry => entry.text), ['earlier', 'middle'])
    assert.equal(h.view.entries.value[1].id, id)
    h.api.readLog = async () => ({ lines: ['later'], startPosition: 20, endPosition: 30, previousPosition: 20 })
    await h.view.page(20, 'forward')
    assert.deepEqual(h.view.entries.value.map(entry => entry.text), ['earlier', 'middle', 'later'])
    h.api.statLog = async () => ({ size: 5 })
    h.api.readLog = async (node, file, signal, position, direction) => { assert.equal(position, undefined); assert.equal(direction, 'backward'); return { lines: ['rotated'], startPosition: 0, endPosition: 5 } }
    await h.view.page(0)
    assert.equal(h.view.notice.value, 'RuntimeMonitor.logRotated'); assert.equal(h.view.entries.value[0].text, 'rotated')
  } finally { h.scope.stop() }
})

test('console waits for actual first record, batches rendering and flushes received evidence when stopped', async () => {
  const h = harness(), live = h.console()
  try {
    live.start(); assert.equal(live.status.value, 'waiting'); assert.equal(live.entries.value.length, 0)
    live.start(); assert.equal(h.consoleObservers.length, 1, 'repeated start does not duplicate the subscription')
    h.consoleObservers[0].next({ timestamp: 1790000000123, level: 'warn', message: 'received', exceptionStack: 'stack', attributes: { threadName: 'worker', traceId: 'a'.repeat(32) } })
    assert.equal(live.status.value, 'receiving'); assert.equal(live.entries.value.length, 0, 'first record updates status immediately without forcing a per-message render')
    live.following.value = false; assert.equal(h.consoleStops(), 0, 'pausing auto-scroll keeps receiving')
    h.tab.value = ''; await flush()
    assert.equal(h.consoleStops(), 1); assert.equal(live.status.value, 'paused'); assert.equal(live.entries.value.length, 1)
    assert.equal(live.entries.value[0].level, 'WARN'); assert.match(live.entries.value[0].time, /\.123$/)
    h.consoleObservers[0].next({ message: 'late' }); assert.equal(live.entries.value.length, 1)
    h.tab.value = 'logs'; await flush(); assert.equal(h.consoleObservers.length, 1, 'returning never silently restarts collection')
    live.start(); assert.equal(h.consoleObservers.length, 2)
    h.consoleObservers[1].error(new Error('Disconnected')); assert.equal(live.status.value, 'error'); assert.equal(live.message.value, 'Disconnected')
    h.node.value = 'node-b'; await flush(); assert.equal(live.entries.value.length, 0); assert.equal(live.status.value, 'idle')
    h.access.value = { logs: false }; await flush(); live.start(); assert.equal(h.consoleObservers.length, 2)
  } finally { h.scope.stop() }
})

test('console retains a bounded recent stream and clear releases queued text without resubscribing', async () => {
  const h = harness(), live = h.console()
  try {
    live.start()
    for (let index = 0; index < 2010; index++) h.consoleObservers[0].next({ message: `line-${index}` })
    assert.equal(live.entries.value.length, 0, 'high frequency receives are coalesced into one display batch')
    await new Promise(resolve => setTimeout(resolve, 120))
    assert.equal(live.entries.value.length, 2000); assert.equal(live.entries.value[0].message, 'line-10'); assert.equal(live.clipped.value, true)
    live.clear(); assert.equal(live.entries.value.length, 0); assert.equal(live.clipped.value, false); assert.equal(h.consoleObservers.length, 1)
    h.consoleObservers[0].next({ message: 'discarded by clear' }); live.clear()
    await new Promise(resolve => setTimeout(resolve, 120)); assert.equal(live.entries.value.length, 0)
    h.consoleObservers[0].next({ message: 'new' }); live.stop(); assert.equal(live.entries.value[0].message, 'new')
  } finally { h.scope.stop() }
})

test('one failed discovery branch cannot hide a readable latest candidate or erase root browsing', async () => {
  const h = harness()
  try {
    await flush()
    const failed = { ...directory, id: 'failed', name: 'failed' }, success = { ...directory, id: 'success', name: 'success' }
    h.api.logRoots = async () => [failed, success]
    h.api.logChildren = async (_, file) => { if (file.id === 'failed') throw new Error('Offline provider'); return [{ ...current, operations: ['readWindow'], lastModified: 20 }] }
    await h.view.roots(); assert.equal(h.view.file.value.id, 'current'); assert.equal(h.view.parents.value[0].id, 'success')
    h.api.logChildren = async () => { throw new Error('Offline provider') }
    await h.view.roots(); assert.deepEqual(h.view.catalog.data.value.map(file => file.id), ['failed', 'success']); assert.equal(h.view.state.value.status, 'ready')
    await h.view.select(key('failed')); assert.equal(h.view.state.value.status, 'ready'); assert.equal(h.view.catalog.state.value.message, 'Offline provider')
  } finally { h.scope.stop() }
})

test('directory browsing and refresh keep active file following, read requests and export target independent', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const original = h.view.windowData.value, selected = h.view.file.value
    let complete, fileSignal
    h.api.readLog = async (_, file, signal) => { fileSignal = signal; return new Promise(resolve => complete = resolve) }
    h.view.follow(true); await flush()
    await h.view.select(key('logs'))
    assert.equal(fileSignal.aborted, false); assert.equal(h.view.following.value, true)
    assert.equal(h.view.file.value, selected); assert.equal(h.view.windowData.value, original)
    await h.view.refreshCatalog(); assert.equal(fileSignal.aborted, false); assert.equal(h.view.following.value, true)
    h.api.logChildren = async () => { throw new Error('Directory offline') }
    await h.view.refreshCatalog()
    assert.equal(h.view.catalog.state.value.status, 'error'); assert.equal(h.view.state.value.status, 'ready')
    assert.equal(h.view.windowData.value, original); assert.equal(h.view.following.value, true)
    complete({ lines: ['updated selected file'], startPosition: 100, endPosition: 200 }); await flush()
    assert.equal(h.view.entries.value[0].text, 'updated selected file'); assert.equal(h.view.fileId.value, key('current'))
    h.view.download(); await flush(); assert.equal(h.downloads[0].file.id, 'current')
    h.api.readLog = async (_, file) => { assert.equal(file.id, 'current'); return { lines: ['manual refresh'], startPosition: 100, endPosition: 200 } }
    await h.view.read(); assert.equal(h.view.entries.value[0].text, 'manual refresh')
  } finally { h.scope.stop() }
})

test('late directory responses never replace a newer catalog or clear selected file evidence', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const original = h.view.windowData.value, other = { ...directory, id: 'other', name: 'other' }
    h.api.logRoots = async () => [directory, other, current]; await h.view.roots()
    let complete, oldSignal
    h.api.logChildren = async (_, file, signal) => file.id === 'logs' ? new Promise(resolve => { complete = resolve; oldSignal = signal }) : [{ ...archive, id: 'other-archive' }]
    const earlier = h.view.select(key('logs')); await flush()
    await h.view.select(key('other')); assert.equal(oldSignal.aborted, false, 'independent tree branches may finish loading into their own cache')
    complete([archive]); await earlier
    assert.equal(h.view.parents.value[0].id, 'other'); assert.equal(h.view.catalog.data.value[0].id, 'other-archive')
    assert.equal(h.view.windowData.value, original); assert.equal(h.view.file.value.id, 'current')
  } finally { h.scope.stop() }
})

test('selected ZIP entry survives parent browsing and reselecting the same ordinary file does not clear or reread it', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('logs')); await h.view.select(key('archive')); await h.view.select(key('archive', 'app.log'))
    const original = h.view.windowData.value
    assert.equal(h.view.filePath.value, 'logs / history.zip / app.log')
    await h.view.parent(); await h.view.parent()
    assert.equal(h.view.windowData.value, original); assert.equal(h.view.file.value.entry, 'app.log')
    h.view.download(); await flush(); assert.equal(h.downloads[0].file.entry, 'app.log'); assert.equal(h.downloads.at(-1).name, 'history.zip')
    await h.view.select(key('current'))
    const currentWindow = h.view.windowData.value, reads = h.reads.length
    await h.view.select(key('current')); assert.equal(h.reads.length, reads); assert.equal(h.view.windowData.value, currentWindow)
  } finally { h.scope.stop() }
})

test('console provider discovery belongs to roots and survives unrelated directory navigation', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    const java = { ...directory, id: 'root', providerId: 'java', name: 'Java' }
    h.api.logRoots = async () => [java, directory, current]
    await h.view.roots(); assert.equal(h.view.consoleAvailable.value, true)
    await h.view.select(key('logs')); assert.equal(h.view.consoleAvailable.value, true)
    await h.view.refreshCatalog(); assert.equal(h.view.consoleAvailable.value, true)
    h.api.logRoots = async () => [directory, current]
    await h.view.roots(); assert.equal(h.view.consoleAvailable.value, false); assert.equal(h.view.file.value.id, 'current')
  } finally { h.scope.stop() }
})

test('fresh provider discovery automatically selects and reads the latest file once', async () => {
  let requests = 0
  const latest = { ...current, current: true, operations: ['readWindow', 'download'] }
  const h = harness({ logRoots: async () => { requests++; return [directory, latest] } })
  try {
    await flush()
    assert.equal(requests, 1, 'initialization shares one capability request instead of cancelling and restarting it')
    assert.equal(h.view.file.value.id, 'current'); assert.equal(h.reads.length, 1)
    assert.equal(h.view.entries.value[0].text, 'ERROR traceId=0123456789abcdef failure')
  } finally { h.scope.stop() }
})

test('switching to console during initial discovery preserves pending capabilities without reading files or subscribing', async () => {
  let complete, signal
  const h = harness({ tab: '', logRoots: async (_, nextSignal) => { signal = nextSignal; return new Promise(resolve => complete = resolve) } }), panel = h.panel()
  try {
    panel.changeMode('console'); await flush()
    assert.equal(signal.aborted, false); assert.equal(panel.consoleState.value.status, 'loading')
    assert.equal(panel.providersKnown.value, false); assert.equal(h.reads.length, 0)
    complete([{ ...directory, providerId: 'java' }, { ...current, operations: ['readWindow'] }]); await flush()
    assert.equal(panel.providersKnown.value, true); assert.equal(panel.logs.consoleAvailable.value, true)
    assert.equal(panel.consoleState.value.status, 'ready'); assert.equal(h.reads.length, 0); assert.equal(h.consoleObservers.length, 0)
    panel.refreshConsole(); assert.equal(h.consoleObservers.length, 1, 'confirmed console still requires an explicit start')
  } finally { h.scope.stop() }
})

test('failed console capability discovery retries in place and never implicitly starts file reading or collection', async () => {
  let reject, requests = 0
  const h = harness({ tab: '', logRoots: async () => { requests++; return new Promise((_, fail) => reject = fail) } }), panel = h.panel()
  try {
    panel.changeMode('console'); await flush(); reject(new Error('Capability connection failed')); await flush()
    assert.equal(panel.consoleState.value.status, 'error'); assert.equal(panel.providersKnown.value, false)
    h.api.logRoots = async () => [{ ...directory, providerId: 'java' }]
    panel.refreshConsole(); await flush()
    assert.equal(requests, 1); assert.equal(panel.consoleState.value.status, 'ready')
    assert.equal(h.reads.length, 0); assert.equal(h.consoleObservers.length, 0)
  } finally { h.scope.stop() }
})

test('same-node permission refresh and background capability checks preserve console evidence; actual removal clears it', async () => {
  const java = { ...directory, providerId: 'java' }
  const h = harness({ tab: '', logRoots: async () => [java] }), panel = h.panel()
  try {
    panel.changeMode('console'); await flush(); panel.refreshConsole()
    h.consoleObservers[0].next({ message: 'retained console evidence' }); panel.consoleLogs.stop()
    const entries = panel.consoleLogs.entries.value
    let complete
    h.api.logRoots = async () => new Promise(resolve => complete = resolve)
    const check = panel.logs.discoverProviders(true); await flush()
    assert.equal(panel.logs.providers.state.value.status, 'loading'); assert.equal(panel.logs.consoleAvailable.value, true)
    assert.equal(panel.consoleLogs.entries.value, entries); assert.equal(panel.consoleState.value.status, 'ready')
    h.access.value = { logs: true, exportLogs: false }; await flush()
    assert.equal(panel.consoleLogs.entries.value, entries, 'an unrelated button permission cannot revoke known console capability')
    complete([java]); await check; await flush()
    assert.equal(panel.consoleLogs.entries.value, entries); assert.equal(h.reads.length, 0)
    const removed = panel.logs.discoverProviders(true); await flush(); complete([directory]); await removed; await flush()
    assert.equal(panel.consoleState.value.status, 'unsupported'); assert.equal(panel.consoleLogs.entries.value.length, 0)
    h.access.value = { logs: false }; await flush()
    h.api.logRoots = async () => [java]; h.access.value = { logs: true }; await flush()
    assert.equal(panel.logs.consoleAvailable.value, true, 'restored log access discovers capabilities while staying in console mode')
    assert.equal(panel.consoleState.value.status, 'ready'); assert.equal(h.reads.length, 0); assert.equal(h.consoleObservers.length, 1)
  } finally { h.scope.stop() }
})

test('a delayed root refresh cannot override a newer manually browsed directory', async () => {
  const h = harness()
  try {
    await flush(); await h.view.select(key('current'))
    let complete
    h.api.logRoots = async () => new Promise(resolve => complete = resolve)
    const refresh = h.view.roots(); await flush()
    await h.view.select(key('logs'))
    complete([directory, current]); await refresh
    assert.equal(h.view.parents.value[0].id, 'logs'); assert.equal(h.view.catalog.data.value[0].id, 'archive')
    assert.equal(h.view.file.value.id, 'current')
  } finally { h.scope.stop() }
})
