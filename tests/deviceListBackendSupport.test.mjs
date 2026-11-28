import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
function load(url, mocks = {}) {
  mocks = { '@jetlinks-web/utils': { getToken: () => 'test-session' }, ...mocks }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(id => id in mocks ? mocks[id] : id.startsWith('./') ? load(new URL(id + '.ts', url), mocks) : require(id), exports)
  return exports
}
const { useSupportedDeviceListProviders } = load(new URL('../views/device/list/hooks/useSupportedDeviceListProviders.ts', import.meta.url))
const provider = (id, isSupported) => ({ id, menuCode: id, order: 0, label: () => id, terms: () => [], matches: () => false, isSupported })
const settle = async () => { for (let i = 0; i < 6; i++) { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() } }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('backend absent or unavailable hides gateway while ordinary devices and video remain', async () => {
  for (const probe of [async () => false, async () => { throw new Error('backend unavailable') }]) {
    const scope = vue.effectScope()
    let actual
    scope.run(() => { actual = useSupportedDeviceListProviders(vue.shallowRef([
      provider('device'), provider('gateway', probe), provider('video'),
    ])) })
    assert.deepEqual(actual.value.map(item => item.id), ['device', 'video'])
    await settle()
    assert.deepEqual(actual.value.map(item => item.id), ['device', 'video'])
    scope.stop()
  }
})

test('backend present reveals gateway even without device data and keeps provider order', async () => {
  const probe = deferred()
  const scope = vue.effectScope()
  let actual
  scope.run(() => { actual = useSupportedDeviceListProviders(vue.shallowRef([
    provider('device'), provider('gateway', () => probe.promise), provider('video'),
  ])) })
  assert.deepEqual(actual.value.map(item => item.id), ['device', 'video'])
  probe.resolve(true)
  await settle()
  assert.deepEqual(actual.value.map(item => item.id), ['device', 'gateway', 'video'])
  scope.stop()
})

test('revoked authorization and disposed pages cannot be restored by old capability requests', async () => {
  const probe = deferred()
  const scope = vue.effectScope()
  const current = vue.shallowRef([provider('device'), provider('gateway', () => probe.promise)])
  let actual
  scope.run(() => { actual = useSupportedDeviceListProviders(current) })
  current.value = [provider('device')]
  await vue.nextTick()
  probe.resolve(true)
  await settle()
  assert.deepEqual(actual.value.map(item => item.id), ['device'])
  const disposed = deferred()
  current.value = [provider('device'), provider('gateway', () => disposed.promise)]
  await vue.nextTick()
  scope.stop()
  disposed.resolve(true)
  await settle()
  assert.deepEqual(actual.value.map(item => item.id), ['device'])
})

test('unified list hides unsupported gateway, avoids its counts and falls back from a direct gateway URL', async () => {
  for (const backendPresent of [false, true]) {
    const scope = vue.effectScope()
    const counts = []
    const gateway = { ...provider('gateway', async () => backendPresent), terms: () => [{ column: 'kind', value: 'gateway' }] }
    const video = provider('video')
    const route = vue.reactive({ path: '/resources/devices/list', query: { type: 'gateway' } })
    const { useUnifiedDeviceList } = load(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), {
      'vue-router': { useRoute: () => route, useRouter: () => ({ replace() {} }) },
      'vue-i18n': { useI18n: () => ({ t: key => key }) },
      '@jetlinks-web-core/store': { useMenuStore: () => ({ hasMenu: () => true }) },
      '@jetlinks-web-core/utils/deployment': { isPrivateDeployment: () => true },
      '@jetlinks-web-core/utils/module-registry': { moduleRegistry: {
        getAllModuleIds: () => ['edge', 'media'],
        getResource: id => id === 'edge' ? { gateway } : { video },
      } },
      '../../../../api/device': {
        countDevice_api: async (_, terms = []) => { counts.push(terms); return 0 },
        queryDevicePage_api: async () => ({ data: [], total: 0 }),
      },
      '../../../../api/device-library': { queryDeviceLibraryProductFilterOptions_api: async () => [] },
      '../../../../api/deviceGroup': { queryRuntimeDevices_api: async () => ({ data: [] }) },
      '../hooks/useIotDeviceRouting': {
        isIotDeviceListEntry: () => false, resolveIotProjectId: () => '',
        getIotDeviceListMenuCode: () => 'iot-user-device-list', buildIotDeviceDetailPath: () => '/',
      },
      '../../../../deviceListProvider': { getIotDeviceScopeTerms: () => [] },
      '../../../../deviceScope': { useDeviceScope: () => ({
        terms: vue.ref([]), scopeType: vue.ref('area'), scopeId: vue.ref(''),
        sidebarProps: vue.ref({ areas: [], groups: [] }), ensureReady: async () => {},
      }) },
      '@jetlinks-web-core/components/ConditionFilter': { decodeConditionFilterQuery: () => [], encodeConditionFilterQuery: () => '' },
      '../../../../deviceListFilter': { getDeviceListFilterFields: () => [], getDeviceListSearchTerms: () => [] },
      '../hooks/useSupportedDeviceListProviders': { useSupportedDeviceListProviders },
      vue: { ...vue, onBeforeUnmount: () => {} },
    })
    let list
    scope.run(() => { list = useUnifiedDeviceList() })
    assert.deepEqual(list.tabs.value.map(tab => tab.key), ['all', 'video'])
    await settle()
    assert.deepEqual(list.tabs.value.map(tab => tab.key), backendPresent ? ['all', 'gateway', 'video'] : ['all', 'video'])
    assert.equal(list.activeType.value, backendPresent ? 'gateway' : 'all')
    assert.equal(counts.some(terms => terms.some(term => term.value === 'gateway')), backendPresent)
    assert.equal(list.tabs.value.find(tab => tab.key === 'video')?.count, 0)
    scope.stop()
  }
})

test('detail return restores the reading anchor while capability probes are still pending', async t => {
  const pending = deferred(), providerStates = [], sessions = []
  let requests = 0
  const gateway = provider('gateway', async () => true)
  const route = vue.reactive({ path: '/resources/devices/list', query: { type: 'all' } })
  const data = Array.from({ length: 50 }, (_, id) => ({ id: String(id), name: String(id), productId: 'p', productName: 'Product' }))
  const { useUnifiedDeviceList } = load(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), {
    'vue-router': { useRoute: () => route, useRouter: () => ({ replace() {} }) },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    '@jetlinks-web-core/store': { useMenuStore: () => ({ hasMenu: () => true }) },
    '@jetlinks-web-core/utils/deployment': { isPrivateDeployment: () => true },
    '@jetlinks-web-core/utils/module-registry': { moduleRegistry: { getAllModuleIds: () => ['edge'], getResource: () => ({ gateway }) } },
    '../../../../api/device': { countDevice_api: async () => 100, queryDevicePage_api: async () => ++requests === 1 ? { data, total: 100 } : pending.promise },
    '../../../../api/device-library': { queryDeviceLibraryProductFilterOptions_api: async () => [] },
    '../../../../api/deviceGroup': { queryRuntimeDevices_api: async () => ({ data: [] }) },
    '../hooks/useIotDeviceRouting': { isIotDeviceListEntry: () => false, resolveIotProjectId: () => '', getIotDeviceListMenuCode: () => 'devices', buildIotDeviceDetailPath: () => '/' },
    '../../../../deviceScope': { useDeviceScope: () => ({ terms: vue.ref([]), scopeType: vue.ref('area'), scopeId: vue.ref(''), sidebarProps: vue.ref({ areas: [], groups: [] }), ensureReady: async () => {} }) },
    '@jetlinks-web-core/components/ConditionFilter': { decodeConditionFilterQuery: () => [], encodeConditionFilterQuery: () => '' },
    '../../../../deviceListFilter': { getDeviceListFilterFields: () => [], getDeviceListSearchTerms: () => [] },
    '../hooks/useSupportedDeviceListProviders': { useSupportedDeviceListProviders: source => { const value = vue.shallowRef([source.value[0]]); providerStates.push({ value, source }); return value } },
    vue: { ...vue, onBeforeUnmount() {} },
  })
  const mount = () => { const session = vue.effectScope(); sessions.push(session); return session.run(useUnifiedDeviceList) }
  t.after(() => { sessions.forEach(session => session.stop()); pending.resolve({ data, total: 100 }) })
  const first = mount(); await settle()
  providerStates[0].value.value = providerStates[0].source.value; await settle()
  first.readingIndex.value = 7; first.readingOffset.value = 0.375; first.rememberList(); sessions[0].stop()
  const returned = mount()
  assert.equal(returned.providers.value.length, 1)
  assert.equal(returned.rows.value.length, 50)
  assert.equal(returned.readingIndex.value, 7)
  assert.equal(returned.readingOffset.value, 0.375)
  await settle()
  assert.equal(returned.loading.value, true)
  assert.equal(returned.rows.value.length, 50)
})
