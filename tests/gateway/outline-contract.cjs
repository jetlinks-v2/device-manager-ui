/* Exercise the real detail loader, display mapper and Vue watcher against HTTP boundaries. */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..')
const workspaceRequire = createRequire(path.resolve(root, '../../package.json'))
const Vue = workspaceRequire('vue')
const esbuild = workspaceRequire('esbuild')
const zh = require('../../locales/lang/zh.json')
const t = key => zh[key] || key
const copy = value => JSON.parse(JSON.stringify(value))
const freeze = value => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } return value }

function loadRuntime(scenario) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }; cache.set(file, module)
    const code = esbuild.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), { loader: 'ts', format: 'cjs', target: 'node18' }).code
    const localRequire = id => {
      if (id === 'vue' || id === 'dayjs') return workspaceRequire(id)
      if (id === 'vue-i18n') return { useI18n: () => ({ t }) }
      if (id === '@jetlinks-web-core/locales') return { global: { t } }
      if (id === '@jetlinks-web/core') return { request: Object.fromEntries(['get', 'post', 'patch', 'remove'].map(method => [method, (url, body) => scenario.request(method.toUpperCase(), url, body)])) }
      if (id.endsWith('/assets')) return { access: {} }
      if (id.startsWith('.')) return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)) + (path.extname(id) ? '' : '.ts'))
      throw new Error(`Unhandled boundary: ${id}`)
    }
    vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, console, setTimeout, clearTimeout }, { filename: file })
    return module.exports
  }
  return { loader: load('views/link/AccessConfig/Outline/loadOutline.ts'), mapper: load('views/link/AccessConfig/Outline/outlineSections.ts'), hook: load('views/link/AccessConfig/Outline/useGatewayOutline.ts') }
}

async function main() {
  const { createOutlineFixture, outlineProviderIds } = await import('./outline-fixture.mjs')
  let cases = 0
  async function run(provider, options = {}) {
    const fixture = createOutlineFixture(provider, options)
    const runtime = loadRuntime(fixture)
    const source = freeze(copy(fixture.gateway))
    const before = JSON.stringify(source)
    const model = await runtime.loader.loadGatewayOutline(source)
    const sections = runtime.mapper.buildOutlineSections(model, t)
    assert.equal(JSON.stringify(source), before, 'details mutated source config')
    assert.equal(fixture.writes.length, 0)
    assert.equal(model.issues.length, 0, `${provider} query issue`)
    assert.equal(sections[0].rows[0].value, '详情验证网关')
    assert.equal(sections[0].rows[2].value, '未配置')
    if (['plugin_gateway', 'media-plugin'].includes(provider)) {
      const config = sections.find(item => item.key === 'configuration')
      assert.equal(config.rows[0].value, 0)
      assert.equal(config.rows[1].value, '否')
      assert.equal(config.rows[2].value, '["mode-a","mode-b"]')
    }
    if (provider === 'gb28181-2016') {
      const signal = sections.find(item => item.key === 'signal')
      assert.equal(signal.rows[2].value, options.independent ? '独立配置' : '共享配置')
      if (options.independent) assert(sections.find(item => item.key === 'cluster-0').rows.some(row => row.value === '0.0.0.0 : 0'))
      else assert.equal(signal.rows[4].value, '未配置')
    }
    if (provider === 'composite-device-gateway') {
      assert.deepEqual(copy(sections.slice(1).map(item => item.tag)), ['MQTT通道 A', 'HTTP通道 B', '插件通道 C'])
      assert.equal(model.children[0].network.name, 'MQTT网络 A')
      assert.equal(model.children[1].network.name, 'HTTP网络 B')
      assert.equal(model.children[0].documents[0].routes[0].topic, '/protocol-a/report')
      assert.equal(model.children[1].documents[0].routes[0].address, '/protocol-b/report')
      assert.equal(model.children[2].properties.length, 3)
      assert.equal(fixture.reads.filter(item => /^\/gateway\/device\/(?!providers|detail)/.test(item.url)).length, 1)
    }
    cases++
  }
  for (const id of outlineProviderIds) await run(id)
  await run('gb28181-2016', { independent: true })
  for (const scope of ['network', 'detail', 'children']) {
    const fixture = createOutlineFixture('composite-device-gateway', { failure: scope })
    const { loader } = loadRuntime(fixture)
    const first = await loader.loadGatewayOutline(freeze(copy(fixture.gateway)))
    assert(first.issues.length || first.children.some(child => child.issues.length), `missing visible error: ${scope}`)
    const second = await loader.loadGatewayOutline(fixture.gateway)
    assert.equal(second.issues.length, 0)
    assert(second.children.every(child => !child.issues.length))
    assert.equal(fixture.writes.length, 0)
    cases++
  }
  for (const key of ['missingNetwork', 'missingProtocol']) {
    const fixture = createOutlineFixture('mqtt-server-gateway', { [key]: true })
    const { loader } = loadRuntime(fixture)
    const model = await loader.loadGatewayOutline(fixture.gateway)
    assert(model.issues.length, 'missing reference should be visible')
    assert.equal(fixture.writes.length, 0)
    cases++
  }
  const empty = createOutlineFixture('composite-device-gateway', { emptyChildren: true })
  const emptyRuntime = loadRuntime(empty)
  const emptySections = emptyRuntime.mapper.buildOutlineSections(await emptyRuntime.loader.loadGatewayOutline(empty.gateway), t)
  assert.equal(emptySections[1].emptyChildren, true)
  cases++
  const draft = createOutlineFixture('plugin_gateway')
  const draftRuntime = loadRuntime(draft)
  const draftData = freeze({ ...copy(draft.gateway), id: 'temporary-child-id' })
  await draftRuntime.loader.loadGatewayOutline(draftData, true)
  assert(!draft.reads.some(item => item.url === '/gateway/device/temporary-child-id'))
  assert.equal(draft.writes.length, 0)
  cases++

  // Closing/unmounting or changing props must invalidate older async detail responses.
  const racing = createOutlineFixture('mqtt-server-gateway', { delay: 15 })
  const { hook } = loadRuntime(racing)
  const props = Vue.reactive({ data: copy(racing.gateway), draft: false })
  const renderer = Vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
  let state
  const app = renderer.createApp({ setup() { state = hook.useGatewayOutline(props); return () => null } })
  app.mount({})
  props.draft = true
  props.data = { ...copy(racing.gateway), id: 'draft-second', name: '第二份草稿', i18nName: '第二份草稿' }
  await Vue.nextTick()
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.equal(state.name.value, '第二份草稿')
  state.reload()
  await Vue.nextTick()
  app.unmount()
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(state.sections.value.length, 0)
  assert.equal(racing.writes.length, 0)
  cases++
  console.log(`详情契约通过：${outlineProviderIds.length} 类型，${cases} 场景；配置只读、复合顺序/协议隔离、无 ID 草稿、失败重试、资源缺失、0/false 及过期响应均通过。`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
