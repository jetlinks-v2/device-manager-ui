import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import { Table } from 'ant-design-vue'
import { parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
function evaluate(source, mocks = {}) {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', code)(id => mocks[id] || require(id), exports)
  return exports
}
const { useDeviceListChannelSupport } = evaluate(readFileSync(new URL('../views/device/list/unified/useDeviceListChannelSupport.ts', import.meta.url), 'utf8'))
const source = parse(readFileSync(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const ast = ts.createSourceFile('list.ts', source, ts.ScriptTarget.Latest, true)
const columnDeclaration = ast.statements.filter(ts.isVariableStatement).flatMap(statement => statement.declarationList.declarations).find(declaration => declaration.name.getText(ast) === 'columns')
assert(columnDeclaration, 'the real list must declare its table columns')
const buildColumns = new Function('computed', 't', 'activeType', 'channelSupported', 'scopeColumn', `return ${columnDeclaration.initializer.getText(ast)}`)
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
const gateway = isChannelSupported => ({ id: 'gateway', isChannelSupported })

function setup(t, initial) {
  const provider = vue.shallowRef(initial), scope = vue.effectScope()
  const supported = scope.run(() => useDeviceListChannelSupport(provider))
  const activeType = vue.computed(() => provider.value?.id || 'all')
  const columns = buildColumns(vue.computed, key => key === 'UnifiedDeviceList.channel' ? '接入通道' : key,
    activeType, supported, vue.ref({ title: '空间', key: 'scope' }))
  const render = () => renderToString(vue.createSSRApp({ render: () => vue.h(Table, { columns: columns.value, dataSource: [], pagination: false }) }))
  t.after(() => scope.stop())
  return { provider, scope, supported, columns, render }
}

test('gateway channel header stays hidden until video management support is confirmed', async t => {
  const probe = deferred(), s = setup(t, gateway(() => probe.promise))
  assert.doesNotMatch(await s.render(), /接入通道/)
  assert(s.columns.value.some(column => column.key === 'monitor'))
  probe.resolve(true)
  await settle()
  assert.match(await s.render(), /接入通道/)
})

test('missing or unavailable video management removes the channel header while gateway columns remain', async t => {
  for (const check of [async () => false, async () => { throw new Error('offline') }]) {
    const s = setup(t, gateway(check))
    await settle()
    assert.doesNotMatch(await s.render(), /接入通道/)
    assert(s.columns.value.some(column => column.key === 'monitor'))
    assert(s.columns.value.some(column => column.key === 'name'))
  }
})

test('switching category discards late checks and preserves the existing video column', async t => {
  const old = deferred(), s = setup(t, gateway(() => old.promise))
  s.provider.value = { id: 'video' }
  assert.match(await s.render(), /接入通道/)
  s.provider.value = gateway(async () => false)
  await settle()
  old.resolve(true)
  await settle()
  assert.doesNotMatch(await s.render(), /接入通道/)
  s.provider.value = { id: 'device' }
  assert.doesNotMatch(await s.render(), /接入通道/)
  s.provider.value = undefined
  assert.doesNotMatch(await s.render(), /接入通道/)
})

test('unmounted list cannot be enabled by an old module check', async t => {
  const probe = deferred(), s = setup(t, gateway(() => probe.promise))
  s.scope.stop()
  probe.resolve(true)
  await settle()
  assert.equal(s.supported.value, false)
})
