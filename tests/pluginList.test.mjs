import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue = require('vue'), ts = require('typescript')
const source = readFileSync(new URL('../views/link/plugin/usePluginList.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function setup() {
  const visibility = vue.ref('visible'), calls = []
  const width = vue.ref(960), height = vue.ref(400)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'vue') return vue
    if (name === '@vueuse/core') return { useDocumentVisibility: () => visibility,
      useElementSize: () => ({ width, height }) }
    if (name.endsWith('/pluginListQuery')) return { pluginListBatchSize: 32 }
    if (name.endsWith('/plugin')) return { streamPlugins(query, cursor) {
      const call = { query, cursor, cancelled: false }
      calls.push(call)
      return { subscribe(observer) { call.observer = observer; return { unsubscribe() { call.cancelled = true } } } }
    } }
    throw new Error(`Unexpected dependency ${name}`)
  }, module, module.exports)
  const noop = () => {}
  const renderer = vue.createRenderer({ createComment: () => ({}), createText: () => ({}), createElement: () => ({}),
    insert: noop, remove: noop, setText: noop, setElementText: noop, patchProp: noop, parentNode: () => null, nextSibling: () => null })
  let list
  const app = renderer.createApp({ setup() { list = module.exports.usePluginList(); return () => null } })
  app.mount({})
  return { list, calls, visibility, width, close: () => app.unmount() }
}

test('a failed append retains records and retries the same cursor without duplicates', async () => {
  const { list, calls, close } = setup()
  try {
    list.refresh()
    for (let index = 0; index < 32; index++) calls[0].observer.next({ id: String(index), createTime: 1000 - index })
    calls[0].observer.complete()
    await vue.nextTick()
    assert.equal(list.items.value.length, 32)
    list.loadMore()
    const cursor = { createTime: 969, id: '31' }
    assert.deepEqual(calls[1].cursor, cursor)
    calls[1].observer.next({ id: '32', createTime: 968 })
    calls[1].observer.error(new Error('Disconnected'))
    assert.equal(list.items.value.length, 33)
    assert.equal(list.error.value, true)
    list.loadMore()
    assert.deepEqual(calls[2].cursor, cursor)
    calls[2].observer.next({ id: '32', createTime: 968 })
    calls[2].observer.complete()
    assert.equal(list.items.value.length, 33)
    assert.equal(list.more.value, false)
    assert.equal(list.error.value, false)
  } finally { close() }
})

test('filter changes reject late data; hiding and unmounting cancel the active reader', async () => {
  const { list, calls, visibility, close } = setup()
  list.refresh()
  list.refresh({ terms: [{ column: 'name', value: 'new' }] })
  assert.equal(calls[0].cancelled, true)
  calls[0].observer.next({ id: 'old' })
  calls[0].observer.complete()
  assert.equal(list.items.value.length, 0)
  assert.equal(list.loading.value, true)
  calls[1].observer.next({ id: 'new', createTime: 1 })
  visibility.value = 'hidden'
  await vue.nextTick()
  assert.equal(calls[1].cancelled, true)
  assert.equal(list.loading.value, false)
  visibility.value = 'visible'
  await vue.nextTick()
  list.loadMore()
  const current = calls.at(-1)
  close()
  assert.equal(current.cancelled, true)
})

test('responsive card columns preserve loaded records without restarting the reader', async () => {
  const { list, calls, width, close } = setup()
  try {
    list.refresh()
    for (let index = 0; index < 32; index++) calls[0].observer.next({ id: String(index), createTime: 1000 - index })
    calls[0].observer.complete()
    const ids = list.items.value.map(item => item.id)
    assert.equal(list.columns.value, 3)
    width.value = 600
    await vue.nextTick()
    assert.equal(list.columns.value, 2)
    width.value = 280
    await vue.nextTick()
    assert.equal(list.columns.value, 1)
    assert.deepEqual(list.rows.value.flatMap(row => row.plugins.map(item => item.id)), ids)
    assert.equal(calls.length, 1)
  } finally { close() }
})
