import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
function loader(stubs = {}) {
  const cache = new Map()
  return function load(filename) {
    if (cache.has(filename)) return cache.get(filename)
    const module = { exports: {} }
    const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => id in stubs ? stubs[id]
      : id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
    cache.set(filename, module.exports)
    return module.exports
  }
}
const host = filename => resolve(import.meta.dirname, '../api/link', filename)
const flush = () => new Promise(done => setImmediate(done))
function streamHarness() {
  const sdk = loader({ '@jetlinks-web/utils': { getToken: () => 'sdk-token' }, '@jetlinks-web/constants': { BASE_API: '/default', LOCAL_BASE_API: 'api', TOKEN_KEY: 'X-Access-Token' } })(resolve(import.meta.dirname, '../../../node_modules/@jetlinks-web/core/src/fetch.ts'))
  return loader({ '@jetlinks-web/core': sdk, '@jetlinks-web-core/utils/request-context': { getRequestBaseApi: () => '/project-api', getRequestHeaders: () => ({ 'X-Access-Token': 'context-token', 'X-Project-Id': 'project-a' }) }, '@jetlinks-web-core/utils/consts': { langKey: 'Accept-Language' } })(host('diagnosticStream.ts'))
}

test('thread NDJSON uses platform context, decodes split multi-line records, and retains every row', async t => {
  const previous = globalThis.fetch, requests = []
  t.after(() => { globalThis.fetch = previous })
  const chunks = ['{"success":true,"result":{"threadId":1,"threadName":"工', '作"}}\n{"threadId":2}\n{"threadId":3}']
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init })
    return new Response(new ReadableStream({ start(c) { chunks.forEach(chunk => c.enqueue(new TextEncoder().encode(chunk))); c.close() } }))
  }
  const api = streamHarness(), signal = new AbortController().signal
  const rows = await api.collectDiagnosticStream(api.streamDiagnostic('service:7100', 'thread', signal), signal)
  assert.deepEqual(rows.map(row => row.threadId), [1, 2, 3])
  assert.equal(rows[0].threadName, '工作')
  assert.equal(requests[0].url, '/project-api/system/monitor/thread/realtime?serverId=service%3A7100')
  const headers = new Headers(requests[0].init.headers)
  assert.equal(headers.get('X-Access-Token'), 'context-token'); assert.equal(headers.get('X-Project-Id'), 'project-a')
  assert.equal(headers.get('Accept'), 'application/x-ndjson')
  assert.deepEqual(JSON.parse(requests[0].init.body), {})
  await api.collectDiagnosticStream(api.streamDiagnostic('service:7100', 'jfr', signal), signal)
  assert.equal(requests[1].url, '/project-api/system/monitor/jfr/realtime?serverId=service%3A7100')
  assert.deepEqual(JSON.parse(requests[1].init.body), { configurationName: 'profile' })
})

test('JFR request preparation is not a server acknowledgement; a real empty first frame is delivered unchanged', async t => {
  const previous = globalThis.fetch; t.after(() => { globalThis.fetch = previous })
  let prepare = 0, completeResponse
  globalThis.fetch = async () => new Promise(done => { completeResponse = done })
  const api = streamHarness(), controller = new AbortController()
  const pending = api.collectDiagnosticStream(api.streamDiagnostic('node-a', 'jfr', controller.signal, { onRequest: () => prepare++ }), controller.signal)
  await flush(); assert.equal(prepare, 1)
  completeResponse(new Response('{"flameGraph":[],"objectAllocations":[]}\n'))
  assert.deepEqual(await pending, [{ flameGraph: [], objectAllocations: [] }])
})

test('NDJSON failures reject rather than becoming empty snapshots; cancel releases its reader', async t => {
  const previous = globalThis.fetch
  t.after(() => { globalThis.fetch = previous })
  const api = streamHarness()
  globalThis.fetch = async () => new Response('{"success":false,"status":403,"message":"Denied"}\n')
  const first = new AbortController()
  await assert.rejects(api.collectDiagnosticStream(api.streamDiagnostic('a', 'thread', first.signal), first.signal), error => error.status === 403)
  let cancelled = false
  globalThis.fetch = async () => new Response(new ReadableStream({ cancel() { cancelled = true } }))
  const controller = new AbortController(), pending = api.collectDiagnosticStream(api.streamDiagnostic('a', 'thread', controller.signal), controller.signal)
  await flush(); controller.abort()
  await assert.rejects(pending, { name: 'AbortError' }); await flush()
  assert.equal(cancelled, true)
})

test('diagnostic REST contract preserves raw trace IDs, metadata-only reads and exact empty signatures', async () => {
  const calls = []
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: {
    get: async (...args) => { calls.push(['get', ...args]); return { success: true, result: [] } },
    post: async (...args) => { calls.push(['post', ...args]); return { success: true, result: null } },
  } } })(host('diagnostics.ts'))
  const signal = new AbortController().signal
  await api.queryTrace('trace/id-prefix', signal)
  await api.queryMBeans('a', signal, '*:*', [])
  await api.invokeMBean('a', { bean: { objectName: 'org.jetlinks:type=Test' }, operation: { name: 'reset', signature: [] }, args: [] }, signal)
  assert.equal(calls[0][1], '/system/trace/trace%2Fid-prefix'); assert.ok(!calls[0][1].includes('_query'))
  assert.equal(calls[1][2].attributes, ''); assert.equal(calls[1][2].detailed, true)
  assert.equal(calls[2][3].params.signature, ''); assert.deepEqual(calls[2][2], [])
})

test('trace lookup accepts controller bare arrays and standard successful envelopes without altering spans', async () => {
  const spans = [{ traceId: 'trace-a', spanId: 'span-a', parentSpanId: 'root', app: 'iot-service:8200', name: 'request',
    startWithNanos: 1792652760000000000, endWithNanos: 1792652760000000000,
    startWithNanosText: '1792652760000000001', endWithNanosText: '1792652760000000002', events: [] }]
  let response
  const calls = [], signal = new AbortController().signal
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: { get: async (...args) => { calls.push(args); return response } } } })(host('diagnostics.ts'))
  for (response of [[], spans, { success: true, result: [] }, { success: true, result: spans }]) {
    const expected = Array.isArray(response) ? response : response.result
    assert.equal(await api.queryTrace('trace-a', signal), expected)
  }
  assert.ok(calls.every(([url, params, config]) => url === '/system/trace/trace-a' && !Object.keys(params).length && config.signal === signal))
})

test('Buffer and JVM overview projections are independent and preserve original endpoint failures', async () => {
  const calls = [], denied = Object.assign(new Error('Access denied'), { status: 403 })
  let failure = false
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: { get: async (...args) => {
    calls.push(args); if (failure) throw denied; return { success: true, result: {} }
  } } } })(host('diagnostics.ts'))
  const signal = new AbortController().signal
  await api.queryBufferMBeans('node-a', signal)
  assert.match(decodeURIComponent(calls[0][0]), /org.jetlinks:type=PersistenceBuffer,\*/)
  assert.equal(calls[0][1].attributes, 'Remainder,DeadSize,Monitor,WriterPending,Wip'); assert.equal(calls[0][1].serverId, 'node-a')
  assert.doesNotMatch(calls[0][1].attributes, /LastError/)
  const initial = await api.queryOverviewMBeans('node-a', signal)
  assert.deepEqual(initial, { sources: [{}], partial: false }); assert.equal(calls.length, 2)
  assert.match(decodeURIComponent(calls[1][0]), /java.lang:\*/); assert.match(calls[1][1].attributes, /StartTime,Uptime/)
  await api.queryOverviewMBeans('node-a', signal, false)
  assert.doesNotMatch(calls[2][1].attributes, /StartTime|Uptime|Remainder|DeadSize/)
  failure = true
  await assert.rejects(api.queryBufferMBeans('node-a', signal), error => error === denied)
  await assert.rejects(api.queryOverviewMBeans('node-a', signal), error => error === denied)
})

test('trace lookup rejects failure envelopes and invalid result shapes rather than presenting no matches', async () => {
  let response
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: { get: async () => response } } })(host('diagnostics.ts'))
  const signal = new AbortController().signal
  response = { success: false, status: 403, message: 'Trace denied', result: [] }
  await assert.rejects(api.queryTrace('trace-a', signal), error => error.status === 403 && error.message === 'Trace denied')
  for (response of [null, undefined, {}, { result: [] }, { success: true }, { success: true, result: {} }, [null], [{}],
    [{ traceId: 'trace-a', spanId: 'span-a', name: 'request', startWithNanos: 'invalid', endWithNanos: '1' }]]) {
    await assert.rejects(api.queryTrace('trace-a', signal), /Diagnostic trace response invalid/)
  }
})

test('download validation refuses error blobs and aborted saves before clicking an anchor', async t => {
  const api = loader({ './diagnosticStream': {}, '@jetlinks-web/core': { request: {} } })(host('diagnostics.ts'))
  const previous = globalThis.document, originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL
  let clicks = 0
  globalThis.document = { createElement: () => ({ click() { clicks++ } }) }
  URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {}
  t.after(() => { globalThis.document = previous; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke })
  await assert.rejects(api.saveDiagnosticFile(new Blob(['{"success":false,"message":"Denied"}'], { type: 'application/json' }), 'heap.hprof'), /Denied/)
  const cancelled = new AbortController(); cancelled.abort()
  await api.saveDiagnosticFile(new Blob(['FLR:binary']), 'recording.jfr', cancelled.signal)
  assert.equal(clicks, 0)
  await api.saveDiagnosticFile(new Blob(['FLR:binary']), 'recording.jfr')
  assert.equal(clicks, 1)
})

test('device communication reads one exact projection with composite QPS, never scalar QPS fields or an extra request',async()=>{
 const calls=[],signal=new AbortController().signal
 const api=loader({'./diagnosticStream':{},'@jetlinks-web/core':{request:{get:async(...args)=>{calls.push(args);return {success:true,result:{}}}}}})(host('diagnostics.ts'))
 await api.queryDeviceMessageMBeans('iot:8200',signal)
 assert.equal(calls.length,1);assert.match(calls[0][0],/DeviceMessageMonitor/)
 const fields=calls[0][1].attributes.split(',');assert.ok(fields.includes('QpsSnapshot'));assert.ok(fields.includes('UpstreamMessagesTotal'))
 for(const scalar of ['ReceivedQps','SentQps','CommunicationQps','QpsSampleTime','QpsWindowMillis','QpsReady'])assert.equal(fields.includes(scalar),false)
})
