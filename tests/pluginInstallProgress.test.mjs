import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url), ts = require('typescript'), rx = require('rxjs')

function load(path, dependencies) {
  const module = { exports: {} }
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(dependencies, module, module.exports)
  return module.exports
}

function setup() {
  let uploadOptions, streamOptions
  const response = new rx.Subject(), events = []
  let uploadAborted = false, readerCancelled = false
  const api = load('../api/link/pluginInstall.ts', id => {
    if (id.endsWith('/components/Upload/utils')) return { createUploadCustomRequest: () => options => {
      uploadOptions = options; return { abort() { uploadAborted = true } }
    } }
    if (id.endsWith('/utils/ndjson-precision')) return { postRuntimeNdJson: (url, body) => {
      streamOptions = { url, body }
      return new rx.Observable(observer => { const subscription = response.subscribe(observer)
        return () => { readerCancelled = true; subscription.unsubscribe() } })
    } }
    throw new Error(`Unexpected dependency ${id}`)
  })
  let success, error
  const handle = api.createPluginDriverUpload(event => events.push(event))({ file: new Blob(['jar']),
    onSuccess: value => success = value, onError: value => error = value })
  return { handle, response, events, uploaded: value => uploadOptions.onSuccess(value),
    state: () => ({ success, error, uploadAborted, readerCancelled, streamOptions }) }
}

const file = { id: 'file', name: 'original.jar', accessUrl: 'https://files.example/file.jar?accessKey=secret', length: 1024 }
const result = { id: 'driver', name: 'Package driver', version: '1.0.0', type: 'standalone', typeName: 'Standalone' }

test('upload completion starts the check and only a final result completes the user upload', () => {
  const flow = setup(); flow.uploaded({ success: true, result: file })
  assert.equal(flow.state().success, undefined)
  assert.equal(flow.state().streamOptions.url, '/plugin/driver/convert/_progress')
  assert.equal(flow.state().streamOptions.body.configuration.location, file.accessUrl)
  flow.response.next({ name: 'plugin.download', status: 'PROGRESS', measurable: { current: 100, unitValue: 'bytes' } })
  assert.equal(flow.state().success, undefined)
  flow.response.next({ name: 'plugin.check', status: 'COMPLETED', attributes: { result } })
  flow.response.complete()
  assert.equal(flow.state().success.result.id, 'driver')
  assert.equal(flow.state().success.result.filename, 'original.jar')
  assert.equal(flow.state().success.result.accessUrl, file.accessUrl)
  assert.equal(flow.state().success.result.type.value, 'standalone')
})

test('a failed node remains visible while a later successful node can complete checking', () => {
  const flow = setup(); flow.uploaded({ result: file })
  flow.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Node dependency missing', attributes: { serverId: 'a' } })
  flow.response.next({ name: 'plugin.check', status: 'COMPLETED', attributes: { serverId: 'b', result } })
  flow.response.complete()
  assert.equal(flow.state().error, undefined); assert.equal(flow.state().success.result.id, 'driver')
  assert.ok(flow.events.some(event => event.status === 'FAILED'))
})

test('the concrete node explanation survives a generic final failure and incomplete streams fail', () => {
  const flow = setup(); flow.uploaded({ result: file })
  flow.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Check the file service base URL',
    attributes: { serverId: 'a', errorCode: 'error.plugin_driver_unexpected_response' } })
  flow.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Unable to load driver' })
  flow.response.complete()
  assert.match(flow.state().error.message, /base URL/); assert.equal(flow.state().success, undefined)
  const terminal = setup(); terminal.uploaded({ result: file })
  terminal.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Check the file service base URL',
    attributes: { serverId: 'a', errorCode: 'error.plugin_driver_unexpected_response' } })
  terminal.response.error(new Error('Unable to load driver'))
  assert.match(terminal.state().error.message, /base URL/)
  const revoked = setup(); revoked.uploaded({ result: file })
  revoked.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Download failed', attributes: { serverId: 'a' } })
  revoked.response.error(Object.assign(new Error('Permission denied'), { status: 403 }))
  assert.equal(revoked.state().error.status, 403)
  const missing = setup(); missing.uploaded({ result: file }); missing.response.complete()
  assert.equal(missing.state().error.code, 'CHECK_STREAM_ENDED')
})

test('cancellation aborts file upload and the progress reader and ignores late results', () => {
  const flow = setup(); flow.uploaded({ result: file }); flow.handle.abort()
  flow.response.next({ name: 'plugin.check', status: 'COMPLETED', attributes: { result } }); flow.response.complete()
  assert.equal(flow.state().uploadAborted, true); assert.equal(flow.state().readerCancelled, true)
  assert.equal(flow.state().success, undefined); assert.equal(flow.state().error, undefined)
})

test('only a completed driver check can provide the package description', () => {
  const flow = setup(); flow.uploaded({ result: file })
  flow.response.next({ name: 'plugin.download', status: 'PROGRESS', attributes: { result } })
  flow.response.complete()
  assert.equal(flow.state().success, undefined)
  assert.equal(flow.state().error.code, 'CHECK_STREAM_ENDED')
})

test('a specific final failure takes precedence over an earlier node failure', () => {
  const flow = setup(); flow.uploaded({ result: file })
  flow.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'File download failed',
    attributes: { serverId: 'a', errorCode: 'error.plugin_driver_download_failed' } })
  flow.response.next({ name: 'plugin.check', status: 'COMPLETED', attributes: { serverId: 'b', result } })
  flow.response.next({ name: 'plugin.check', status: 'FAILED', errorMessage: 'Permission denied',
    attributes: { errorCode: 'error.access_denied' } })
  flow.response.complete()
  assert.equal(flow.state().error.message, 'Permission denied')
  assert.equal(flow.state().success, undefined)
})

test('phase names, counters and actionable error guidance have matching zh/en/ja resources', () => {
  const presentation = load('../views/link/plugin/installProgress.ts', () => { throw new Error('Unexpected dependency') })
  let reference
  for (const language of ['zh', 'en', 'ja']) {
    const messages = JSON.parse(readFileSync(new URL(`../locales/lang/${language}.json`, import.meta.url)))
    const keys = Object.keys(messages).filter(key => key.startsWith('pluginInstall.')).sort()
    if (reference) assert.deepEqual(keys, reference); else reference = keys
    const t = (key, values) => { assert.ok(messages[key], `Missing ${language}: ${key}`)
      return messages[key].replace(/\{(\w+)\}/g, (text, name) => values?.[name] ?? text) }
    assert.equal(presentation.progressLabel({ name: 'plugin.check', status: 'COMPLETED', attributes: { result } }, t), messages['pluginInstall.checked'])
    assert.equal(presentation.progressLabel({ name: 'plugin.check', status: 'CANCELLED' }, t), messages['pluginInstall.cancelled'])
    assert.equal(presentation.progressAmount({ name: 'plugin.download', status: 'PROGRESS', measurable: { current: 134217728, unitValue: 'bytes' } }, language, t), '128 MiB')
    assert.equal(presentation.progressAmount({ name: 'plugin.download', status: 'STARTED' }, language, t), '')
    assert.ok(presentation.uploadError({ code: 'UPLOAD_RESPONSE' }, t).length > 10)
    for (const status of [401, 403, 404, 413, 502, 503, 504]) {
      assert.ok(presentation.uploadError({ status }, t).length > 10)
      assert.equal(presentation.uploadError({ response: { status } }, t), presentation.uploadError({ status }, t))
    }
  }
})
