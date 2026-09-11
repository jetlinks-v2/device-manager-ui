import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { transform } from 'esbuild'
import { computed, effectScope, onScopeDispose, ref, shallowRef } from 'vue'

async function parseSource(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
}

const detailSource = await parseSource('../views/device/list/hooks/useIotDeviceDetailView.ts')
const detailHook = detailSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'useIotDeviceDetailView')
const functionNames = [
  'loadRealtimePropertySnapshot', 'startRealtimeSubscriptions', 'loadDevice', 'loadCommands',
  'loadWorkbench', 'loadChildDevices', 'runDiagnosis', 'loadAll', 'onDetailContentChanged',
  'mapStatePayloadToStatus', 'clearRealtimeStatusSubscription', 'clearRealtimePropertySubscription',
  'clearRealtimeSubscriptions', 'saveTags', 'syncLegacyMetadataDevice', 'onMetadataChanged',
]
const variableNames = new Set(['disposed', 'loadVersion', 'snapshotVersion', 'currentLoad', 'isCurrentLoad', 'beginLoad'])
const selected = detailHook.body.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && functionNames.includes(node.name.text))
  || (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => variableNames.has(item.name.getText(detailSource))))
  || (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(detailSource) === 'onScopeDispose'),
)
for (const name of functionNames) assert.ok(selected.some(node => ts.isFunctionDeclaration(node) && node.name.text === name), `Production function ${name} exists`)

// 执行生产函数及真实销毁回调，隔离详情大 hook 中与这些生命周期无关的 UI/诊断依赖。
const { code: lifecycleCode } = await transform(selected.map(node => node.getText(detailSource)).join('\n'), { loader: 'ts', target: 'es2022' })
const lifecycleScript = new vm.Script(`(() => { ${lifecycleCode}; return { loadAll, loadDevice, loadRealtimePropertySnapshot, onDetailContentChanged, saveTags } })()`)

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function fixture(t, { custom = true, properties = [] } = {}) {
  let dispose
  let activeSubscriptions = 0
  let statusCallback
  const calls = []
  const context = {
    deviceId: ref('A'), projectId: ref('P'), device: shallowRef(null),
    detailContent: shallowRef(custom ? {} : undefined),
    detailContentRef: shallowRef({ refresh: async () => { calls.push('content') } }),
    activeRealtimePropertyKeys: ref(properties), realtimePropertyValues: ref({}),
    propertyPageRealtimeKeys: ref([]), liveSimulatorTraces: ref([]),
    realtimeStatusSubscription: shallowRef(), realtimeStatusSubscriptionKey: ref(''),
    realtimePropertySubscription: shallowRef(), realtimePropertySubscriptionKey: ref(''),
    deviceCommands: ref([]), workbench: shallowRef(null), childDeviceCount: ref(0),
    isGatewayDevice: ref(false), healthDiagnosis: shallowRef(null),
    savingTags: ref(false), tagEditorOpen: ref(true),
    onScopeDispose: callback => { dispose = callback },
    instanceStore: { setCurrent() {} },
    EventEmitter: { unSubscribe() {} },
    updateTagsOverflow() {}, formatApiTime: () => '', handleRealtimePropertyValue() {},
    canDeviceAction: () => true, getTagKey: tag => tag.id, isEmptyTagValue: value => value == null,
    onlyMessage() {}, $t: key => key, extractRows: result => result?.data || [],
    subscribeDeviceStatus: (_id, callback) => {
      activeSubscriptions += 1
      statusCallback = callback
      return { unsubscribe() { activeSubscriptions -= 1 } }
    },
    subscribeDeviceProperties: () => ({ unsubscribe() {} }),
    iotDeviceService: {
      getDevice: async () => { calls.push('device'); return { ok: true, data: { id: 'A', productKey: 'p', name: 'current' } } },
      listDeviceCommands: async () => { calls.push('commands'); return { ok: true, data: [] } },
      getWorkbench: async () => { calls.push('workbench'); return { ok: true, data: {} } },
      getDeviceHealthDiagnosis: async () => { calls.push('diagnosis'); return { ok: true, data: {} } },
    },
    iotDeviceDetailRealApi: {
      queryDashboard: async () => ({ result: [] }),
      queryChildDevices: async () => { calls.push('children'); return { result: { total: 2 } } },
      saveTags: async id => { calls.push(`save-tags:${id}`) },
      deleteTag: async id => { calls.push(`delete-tag:${id}`) },
    },
  }
  const api = lifecycleScript.runInNewContext(context)
  t.after(() => dispose())
  return { context, api, calls, dispose: () => dispose(), activeSubscriptions: () => activeSubscriptions, status: payload => statusCallback(payload) }
}

test('a detail response arriving after disposal cannot rebuild subscriptions or continue loading', async t => {
  const f = fixture(t)
  const response = deferred()
  f.context.iotDeviceService.getDevice = () => response.promise
  const pending = f.api.loadAll()
  f.dispose()
  response.resolve({ ok: true, data: { id: 'A' } })
  await pending
  assert.equal(f.context.device.value, null)
  assert.equal(f.activeSubscriptions(), 0)
  assert.deepEqual(f.calls, [])
  await f.api.loadAll()
  assert.deepEqual(f.calls, [])
})

test('a snapshot for the previous route cannot write values or start subscriptions', async t => {
  const f = fixture(t, { custom: false, properties: ['temperature'] })
  const response = deferred(), requested = deferred()
  f.context.iotDeviceDetailRealApi.queryDashboard = () => { requested.resolve(); return response.promise }
  const pending = f.api.loadAll()
  await requested.promise
  f.context.deviceId.value = 'B'
  response.resolve({ result: [{ data: { value: { property: 'temperature', value: 8 } } }] })
  await pending
  assert.equal(Object.keys(f.context.realtimePropertyValues.value).length, 0)
  assert.equal(f.activeSubscriptions(), 0)
  assert.deepEqual(f.calls, ['device'])
})

test('the newest detail wins and same-device refresh keeps one working status subscription', async t => {
  const f = fixture(t)
  const older = deferred()
  let requestCount = 0
  f.context.iotDeviceService.getDevice = () => ++requestCount === 1
    ? older.promise : Promise.resolve({ ok: true, data: { id: 'A', name: 'new' } })
  const first = f.api.loadAll()
  await f.api.loadAll()
  older.resolve({ ok: true, data: { id: 'A', name: 'old' } })
  await first
  assert.equal(f.context.device.value.name, 'new')
  await f.api.loadAll()
  f.status({ value: 'offline' })
  assert.equal(f.context.device.value.status, 'offline')
  assert.equal(f.activeSubscriptions(), 1)
  f.dispose()
  f.status({ value: 'online' })
  assert.equal(f.context.device.value.status, 'offline')
  assert.equal(f.activeSubscriptions(), 0)
})

test('out-of-order property snapshots keep the newest requested value', async t => {
  const f = fixture(t, { custom: false, properties: ['temperature'] })
  f.context.device.value = { id: 'A', productKey: 'p' }
  const older = deferred(), newer = deferred()
  let requestCount = 0
  f.context.iotDeviceDetailRealApi.queryDashboard = () => ++requestCount === 1 ? older.promise : newer.promise
  const first = f.api.loadRealtimePropertySnapshot(), second = f.api.loadRealtimePropertySnapshot()
  newer.resolve({ result: [{ data: { value: { property: 'temperature', value: 2 } } }] })
  await second
  older.resolve({ result: [{ data: { value: { property: 'temperature', value: 1 } } }] })
  await first
  assert.equal(f.context.realtimePropertyValues.value.temperature.value, 2)
})

test('disposal during a later loading stage stops the remaining default pipeline', async t => {
  const f = fixture(t, { custom: false })
  const response = deferred(), requested = deferred()
  f.context.iotDeviceService.listDeviceCommands = () => { requested.resolve(); return response.promise }
  const pending = f.api.loadAll()
  await requested.promise
  f.dispose()
  response.resolve({ ok: true, data: ['late'] })
  await pending
  assert.equal(f.context.deviceCommands.value.length, 0)
  assert.deepEqual(f.calls, ['device'])
  assert.equal(f.activeSubscriptions(), 0)
})

test('custom content refreshes after the header; changed reloads only its matching header without a loop', async t => {
  const f = fixture(t)
  await f.api.loadAll()
  assert.deepEqual(f.calls, ['device', 'content'])
  await f.api.onDetailContentChanged('A')
  assert.deepEqual(f.calls, ['device', 'content', 'device'])
  await f.api.onDetailContentChanged('B')
  assert.equal(f.calls.length, 3)
  f.context.detailContentRef.value = undefined
  await f.api.loadAll()
  assert.equal(f.calls.length, 4, 'initial load tolerates an unmounted child ref')
  f.dispose()
  await f.api.onDetailContentChanged('A')
  assert.equal(f.calls.length, 4)
})

test('ordinary devices keep commands, workbench, child devices and diagnosis loading', async t => {
  const f = fixture(t, { custom: false })
  f.context.isGatewayDevice.value = true
  await f.api.loadAll()
  assert.deepEqual(f.calls, ['device', 'commands', 'workbench', 'children', 'diagnosis'])
  assert.equal(f.context.childDeviceCount.value, 2)
  assert.equal(f.activeSubscriptions(), 1)
})

test('header tag writes refresh custom content without adding default-content queries', async t => {
  for (const custom of [true, false]) {
    const f = fixture(t, { custom })
    f.context.device.value = { id: 'A' }
    await f.api.saveTags([{ id: 'tag', value: 'new' }])
    assert.deepEqual(f.calls, ['save-tags:A', 'device', ...(custom ? ['content'] : [])])
    assert.equal(f.context.savingTags.value, false)
  }
  const f = fixture(t), response = deferred()
  f.context.device.value = { id: 'A' }
  f.context.iotDeviceDetailRealApi.saveTags = () => response.promise
  const pending = f.api.saveTags([{ id: 'tag', value: 'new' }])
  f.context.deviceId.value = 'B'
  response.resolve()
  await pending
  assert.deepEqual(f.calls, [], 'a completed write cannot refresh another device')
})

const providerSource = await parseSource('../views/device/list/hooks/useDeviceListProvider.ts')
const { code: providerCode } = await transform(providerSource.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(providerSource)).join('\n'), { loader: 'ts', format: 'cjs' })
const mediaSource = await parseSource('../../jetlinks-media-ui/deviceListProvider.ts')
const { code: mediaMatcherCode } = await transform(mediaSource.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => ['providers', 'matchesVideoDevice'].includes(item.name.getText(mediaSource)))).map(node => node.getText(mediaSource)).join('\n'), { loader: 'ts', format: 'cjs' })
const mediaModule = { exports: {} }
vm.runInNewContext(mediaMatcherCode, { module: mediaModule })

test('the actual provider hook follows loaded accessProvider, ignores list query and falls back for ordinary devices', () => {
  const resources = new Map(), listeners = new Set()
  const route = ref({ query: { type: 'video' } })
  const moduleRegistry = {
    getAllModuleIds: () => [...resources.keys()],
    getResource: id => resources.get(id) || {},
    onChange: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const module = { exports: {} }
  vm.runInNewContext(providerCode, { module, computed, ref, onScopeDispose, moduleRegistry, useRoute: () => route.value })
  const scope = effectScope(), device = shallowRef(null)
  const provider = scope.run(() => module.exports.useDeviceListProvider(device))
  const video = { id: 'video', matches: mediaModule.exports.matchesVideoDevice, detailContent: { component: {} } }
  try {
    assert.equal(provider.value, undefined)
    device.value = { id: 'A', accessProvider: 'fixed-media' }
    assert.equal(provider.value, undefined, 'registration may arrive after device data')
    resources.set('media', { video }); listeners.forEach(listener => listener())
    assert.equal(provider.value, video)
    route.value.query.type = 'device'
    assert.equal(provider.value, video)
    for (const accessProvider of ['gb28181-2016', 'onvif', 'media-plugin']) {
      device.value = { id: 'A', accessProvider }
      assert.equal(provider.value, video)
    }
    route.value.query.type = 'video'
    device.value = { id: 'B', accessProvider: 'mqtt' }
    assert.equal(provider.value, undefined, 'ordinary devices retain default content even under a video query')
    device.value = { id: 'A', accessProvider: 'fixed-media' }
    resources.clear(); listeners.forEach(listener => listener())
    assert.equal(provider.value, undefined)
  } finally { scope.stop() }
  assert.equal(listeners.size, 0, 'provider registry subscription is disposed with its scope')
})
