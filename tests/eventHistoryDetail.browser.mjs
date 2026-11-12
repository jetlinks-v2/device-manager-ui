import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = resolve(moduleRoot, '../..')
const require = createRequire(join(runtimeRoot, 'package.json'))
const { build } = require('esbuild')
const { parse, compileScript, compileStyleAsync } = require('vue/compiler-sfc')
const browserBinary = process.env.EVENT_DETAIL_BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync)
assert.ok(browserBinary, 'Set EVENT_DETAIL_BROWSER to Chrome or Edge')

const source = `
import { createApp, h, reactive, nextTick } from 'vue'
import Antd from 'ant-design-vue'
import i18n from 'event-test-locales'
import History from ${JSON.stringify(join(moduleRoot, 'views/device/list/components/device-detail/IotDeviceEventHistoryPane.vue'))}
import PropertyDetail from ${JSON.stringify(join(moduleRoot, 'views/device/list/components/device-detail/IotDevicePropertyHistoryDetailModal.vue'))}
const values = {
  file: 'iVBORw0KGgo' + 'A'.repeat(300000) + 'END_OF_FILE',
  string: '第一行\\n第二行', int: 0, long: '9223372036854775807', float: 1.25, double: 3.14,
  boolean: false, enum: 0, date: '2026-11-12T08:00:00Z', password: 'reported-password',
  object: { nested: { enabled: false, value: 0 } }, array: [0, false, null, {}], geoPoint: { lon: 106.5, lat: 29.5 },
}
const fields = Object.keys(values).map(id => ({ id, name: id, valueType: {
  type: id, ...(id === 'boolean' ? { falseText: '关闭', trueText: '开启' } : {}),
  ...(id === 'enum' ? { elements: [{ value: 0, text: '正常' }] } : {}),
  ...(id === 'double' ? { unit: 'percent' } : {}),
}}))
globalThis.fixture = { id: 'record-not-in-summary', timestamp: 1794470000000, value: values, historicalExtra: '完整保留' }
globalThis.queryCalls = []
globalThis.queryErrors = []
globalThis.state = reactive({
  deviceId: 'device-1', timeRange: 'all', propertyOpen: false,
  propertyValue: values.file, propertyType: 'file',
  events: [
    { id: 'event-1', name: '测试事件', level: 'info', time: '', outputs: fields },
    { id: 'event-2', name: '第二事件', level: 'info', time: '', valueType: { type: 'string' } },
  ],
})
globalThis.flush = async () => { await nextTick(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }
const app = createApp({ render: () => h('main', [
  h(History, { deviceId: state.deviceId, events: state.events, timeRange: state.timeRange }),
  h(PropertyDetail, { open: state.propertyOpen, row: { value: state.propertyValue }, propertyName: '属性详情', valueType: { type: state.propertyType }, 'onUpdate:open': value => state.propertyOpen = value }),
]) })
app.use(Antd).use(i18n)
app.component('AIcon', { render: () => h('span', '⌕') })
app.component('CloudEmpty', { props: ['description'], render() { return h('div', this.description) } })
app.mount('#app')
`

const styles = []
const bundle = await build({
  absWorkingDir: runtimeRoot, stdin: { contents: source, resolveDir: runtimeRoot, loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'event-history-harness', setup(context) {
    context.onResolve({ filter: /^(event-test-locales|@jetlinks-web-core\/locales)$/ }, () => ({ path: 'locales', namespace: 'fixture' }))
    context.onResolve({ filter: /iotDeviceDetailReal\.service$/ }, () => ({ path: 'service', namespace: 'fixture' }))
    context.onResolve({ filter: /^@jetlinks-web\/utils$/ }, () => ({ path: 'messages', namespace: 'fixture' }))
    context.onResolve({ filter: /^@device-manager-ui\/api\/instance$/ }, () => ({ path: 'units', namespace: 'fixture' }))
    context.onLoad({ filter: /.*/, namespace: 'fixture' }, async ({ path }) => {
      const contents = path === 'locales'
        ? `import { createI18n } from 'vue-i18n'; import zh from ${JSON.stringify(join(moduleRoot, 'locales/lang/zh.json'))}; export default createI18n({ legacy:false, locale:'zh', messages:{zh} })`
        : path === 'messages' ? 'export const onlyMessage = value => globalThis.queryErrors.push(value)'
        : path === 'units' ? `export const getUnit = async () => ({ success:true, result:[{id:'percent',symbol:'%'}] })`
        : `export const formatApiTime = value => new Date(value).toISOString(); export const iotDeviceDetailRealApi = { queryEvent: async (...args) => { globalThis.queryCalls.push(args); return globalThis.queryOverride ? globalThis.queryOverride(...args) : {result:{data:[globalThis.fixture],total:1,pageIndex:0}} } }`
      return { contents, loader: 'ts', resolveDir: runtimeRoot }
    })
    context.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor } = parse(await readFile(path, 'utf8'), { filename: path })
      const id = `event-history-${styles.length}`
      for (const style of descriptor.styles) {
        const content = style.src ? await readFile(resolve(dirname(path), style.src), 'utf8') : style.content
        const result = await compileStyleAsync({ source: content, filename: path, id: `data-v-${id}`, scoped: style.scoped })
        assert.deepEqual(result.errors, [])
        styles.push(result.code)
      }
      return { contents: compileScript(descriptor, { id, inlineTemplate: true }).content, loader: 'ts', resolveDir: dirname(path) }
    })
  } }],
})
console.log('Compiled real event and property components')
const reset = await readFile(require.resolve('ant-design-vue/dist/reset.css'), 'utf8')
console.log('Loaded component styles')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${reset}\n${styles.join('\n')}
:root{--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:20px;--space-6:24px;--jet-theme-stroke-width:1px;--jet-theme-border:#ddd;--jet-theme-radius:8px;--jet-theme-bg-container:white;--jet-theme-bg-layout:#f5f5f5;--jet-theme-text:#30343b;--jet-theme-text-title:#20242b;--jet-theme-text-secondary:#677080;--jet-theme-primary:#1677ff;--jet-theme-primary-soft:#e6f4ff;--fs-14:14px;--fs-16:16px}body{margin:0;padding:24px}#app{width:100%}*{box-sizing:border-box}</style></head><body><div id="app"></div><script src="/app.js"></script></body></html>`
const server = createServer((request, response) => {
  response.setHeader('content-type', request.url === '/app.js' ? 'text/javascript' : 'text/html; charset=utf-8')
  response.end(request.url === '/app.js' ? bundle.outputFiles[0].text : html)
})
server.listen(0, '127.0.0.1')
await once(server, 'listening')
console.log('Local fixture server listening')
const profile = await mkdtemp(join(tmpdir(), 'event-detail-browser-'))
console.log('Created isolated browser profile')
const browser = spawn(browserBinary, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
let socket
try {
  // Windows Edge writes the endpoint to the profile even when its launcher does not forward stderr.
  const endpoint = await (async () => {
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      try {
        const [port, socketPath] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/)
        if (port && socketPath) return `ws://127.0.0.1:${port}${socketPath}`
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Browser startup timeout: DevToolsActivePort was not created')
  })()
  console.log('Browser debugging endpoint ready')
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  let requestId = 0
  const pending = new Map()
  const browserErrors = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (pending.has(message.id)) {
      const handler = pending.get(message.id)
      pending.delete(message.id)
      message.error ? handler.reject(new Error(JSON.stringify(message.error))) : handler.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description)
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++requestId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timeout: ${method}`)) }, 12000)
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject: error => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const command = (method, params) => send(method, params, sessionId)
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  const evaluate = async expression => {
    const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description)
    return response.result.value
  }
  const waitFor = async expression => {
    const deadline = Date.now() + 12000
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return
      await new Promise(resolve => setTimeout(resolve, 80))
    }
    throw new Error(`Timeout: ${expression}; ${JSON.stringify(browserErrors)}`)
  }
  const openDetail = async () => {
    await evaluate(`document.querySelector('.event-history__row:not(.event-history__row--head) .ant-btn').click(); flush()`)
    await waitFor(`!!document.querySelector('.event-detail')`)
  }
  await command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}` })
  await waitFor(`document.querySelectorAll('.event-history__row').length === 2`)
  assert.ok(await evaluate(`document.querySelector('.event-history__table').scrollWidth > document.querySelector('.event-history__table').clientWidth`))
  await openDetail()
  const fileArea = `[...document.querySelectorAll('.event-detail__field')].find(item => item.querySelector('.event-detail__label').textContent === 'file').querySelector('textarea')`
  assert.ok(await evaluate(`(${fileArea}).value === fixture.value.file`), 'Base64 must remain complete')
  assert.ok(await evaluate(`(${fileArea}).scrollHeight > (${fileArea}).clientHeight`))
  assert.ok(await evaluate(`(${fileArea}).readOnly && !(${fileArea}).disabled`))
  assert.equal(await evaluate(`document.querySelectorAll('.event-detail img, .event-detail video, .event-detail audio').length`), 0)
  assert.equal(await evaluate(`JSON.parse(document.querySelector('.event-detail__raw').textContent).value.file`), 'iVBORw0KGgo' + 'A'.repeat(300000) + 'END_OF_FILE')
  assert.equal(await evaluate(`document.querySelector('.event-detail__summary').textContent.includes('record-not-in-summary')`), false)
  const body = await evaluate(`document.querySelector('.event-detail').textContent + [...document.querySelectorAll('.event-detail input, .event-detail textarea')].map(item => item.value).join(' | ')`)
  for (const text of ['关闭', '正常', '9223372036854775807', '3.14%', '完整保留']) assert.ok(body.includes(text), text)
  assert.equal(await evaluate(`document.querySelectorAll('.event-detail__field').length`), 13)
  assert.equal(await evaluate(`document.querySelectorAll('.event-detail .ant-tabs, .event-detail button').length`), 0)
  assert.ok(await evaluate(`document.querySelector('.event-detail__section').getBoundingClientRect().top < document.querySelectorAll('.event-detail__section')[1].getBoundingClientRect().top`))
  console.log('PASS: 13 types, complete 300 KB Base64, readonly scrolling, raw response, vertical layout, no media or extra actions')

  await evaluate(`document.querySelectorAll('.event-history__tabs .ant-tabs-tab')[1].click(); flush()`)
  await waitFor(`!document.querySelector('.event-detail')`)
  await waitFor(`queryCalls.at(-1)[1] === 'event-2'`)
  await openDetail()
  await evaluate(`state.deviceId = 'device-2'; flush()`)
  await waitFor(`!document.querySelector('.event-detail') && queryCalls.at(-1)[0] === 'device-2'`)
  await openDetail()
  await evaluate(`state.timeRange = '1h'; flush()`)
  await waitFor(`!document.querySelector('.event-detail')`)
  assert.ok(await evaluate(`queryCalls.at(-1)[2].terms.length === 1`))
  console.log('PASS: event/device/time-range changes close stale details and query the new scope')

  await evaluate(`state.propertyOpen = true; flush()`)
  await waitFor(`!!document.querySelector('.history-detail textarea')`)
  assert.equal(await evaluate(`document.querySelector('.history-detail textarea').value`), 'iVBORw0KGgo' + 'A'.repeat(300000) + 'END_OF_FILE')
  assert.ok(await evaluate(`document.querySelector('.history-detail textarea').readOnly`))
  await evaluate(`state.propertyType = 'double'; state.propertyValue = '40.53%'; flush()`)
  assert.equal(await evaluate(`document.querySelector('.history-detail input').value`), '40.53%')
  await evaluate(`state.propertyType = 'object'; state.propertyValue = { nested: [0, false, {}] }; flush()`)
  await waitFor(`!!document.querySelector('.history-detail .jv-container')`)
  console.log('PASS: property details reuse the same renderer for long text, scalar values and nested JSON')
  assert.deepEqual(browserErrors, [])
  assert.deepEqual(await evaluate('queryErrors'), [])
  console.log('Browser verification complete: 3 scenario groups, 0 browser exceptions')
} catch (error) {
  console.error(error)
  throw error
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: -1, method: 'Browser.close' }))
  socket?.close()
  browser.kill()
  server.close()
  if (browser.exitCode === null && browser.signalCode === null) {
    await Promise.race([once(browser, 'exit').catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))])
  }
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep), 'Browser profile cleanup must stay inside the temporary directory')
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {})
}
