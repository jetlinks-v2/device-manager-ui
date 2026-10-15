import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'

const readRelative = path => readFile(new URL(path, import.meta.url), 'utf8')

const sliceFunction = (source, marker, nextMarkers) => {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing ${marker}`)
  const from = source.slice(start)
  const ends = nextMarkers
    .map(item => from.indexOf(item, marker.length))
    .filter(index => index >= 0)
  const end = ends.length ? Math.min(...ends) : from.length
  return from.slice(0, end)
}

test('both device detail entries narrow builtin groups without replacing the deployment allow-list', async () => {
  const parameters = await readRelative('../views/device/list/agent/deviceDetailAgent.parameters.ts')
  const unified = await readRelative('../views/device/list/agent/useDeviceDetailAgent.ts')
  const instance = await readRelative('../views/device/Instance/Detail/useDeviceInstanceDetail.ts')
  assert.match(parameters, /'builtinToolGroup\.media\.enabled': false/)
  assert.match(parameters, /'builtinToolGroup\.validate\.enabled': false/)
  assert.doesNotMatch(parameters, /builtinToolGroups:/)
  assert.doesNotMatch(parameters, /builtinToolGroup\.(?:document|fs|chart|dataset|memory|script)\.enabled/)
  assert.match(unified, /const parameters = \{\s*\.\.\.DEVICE_DETAIL_AGENT_BUILTIN_PARAMETERS/)
  assert.match(instance, /const buildDeviceDetailAgentParameters = [\s\S]*?return \{\s*\.\.\.DEVICE_DETAIL_AGENT_BUILTIN_PARAMETERS/)
})

test('Instance model getter replaces the duplicate markdown tool and keeps full file export', async () => {
  const source = await readRelative('../views/device/Instance/Detail/clientTools.ts')
  assert.doesNotMatch(source, /id: 'device_metadata_markdown'/)
  const getter = sliceFunction(source, 'createDeviceModelGetTool<DeviceClientToolContext>({', ['createDeviceMetadataSearchTool'])
  assert.match(getter, /fileOutput: true/)
  assert.match(getter, /inputs: withWriteToPathInput\(/)
  const start = getter.indexOf('execute: async (args, context, call) => {')
  const body = getter.slice(start + 'execute: '.length, getter.lastIndexOf('\n    }),'))
  const written = []
  const run = runInNewContext(`${transformSync(`const run = (${body})`, { loader: 'ts' }).code}\nrun`, {
    getMetadata: context => context.device.metadata,
    normalizeMetadataSection: section => section || 'all',
    clampNumber: (value, min, max, fallback) => Math.max(min, Math.min(max, Number(value) || fallback)),
    pickMetadataSections: (model, _section, limit) => ({ properties: model.properties.slice(0, limit) }),
    metadataCounts: model => ({ properties: model.properties.length }),
    getDeviceId: context => context.device.id,
    buildMetadataMarkdown: (context, _section, limit) => context.device.metadata.properties.slice(0, limit).map(item => item.id).join('\n'),
    isWriteToPathEnabled: args => !!args.writeToPath,
    stringifyToolResult: JSON.stringify,
    writeToolResultToSessionFile: async (args, _call, _result, options) => {
      written.push({ path: args.writeToPath, content: options.content })
      return { file: { size: options.content.length }, inputPath: args.writeToPath, uri: `fs://${args.writeToPath}` }
    },
    devicePropertyAnalysisResult: (value, options) => ({ value, ...options }),
  })
  const context = { device: { id: 'test-device', metadata: { properties: [{ id: 'one' }, { id: 'two' }] } } }
  const inline = await run({ limit: 1 }, context, {})
  assert.equal(inline.value.markdown, 'one')
  assert.equal(written.length, 0)
  for (const format of ['markdown', 'json']) {
    const result = await run({ limit: 1, format, writeToPath: `model.${format}` }, context, {})
    assert.equal(result.value.model.properties.length, 1)
    assert.equal(result.value.file.path, `model.${format}`)
    assert.equal(result.value.file.uri, `fs://model.${format}`)
    assert.ok(written.at(-1).content.includes('two'), 'file must contain the complete model, not just its inline sample')
  }
})

test('closing the child mapping save dialog rejects route navigation without discarding edits', async () => {
  const source = await readRelative('../views/device/Instance/Detail/Child/index.vue')
  const leaveHandlers = sliceFunction(source, 'const TabsChange = ', ['watch('])
  const guards = []
  let dialog
  let saves = 0
  runInNewContext(leaveHandlers, {
    editStatus: { value: true }, isToDetail: { value: false }, getToken: () => 'test-token', $t: key => key,
    Modal: { confirm: options => { dialog = options; return { destroy() {} } } },
    onSaveAll: next => { saves++; next() },
    onBeforeRouteUpdate: guard => guards.push(guard),
    onBeforeRouteLeave: guard => guards.push(guard),
  })
  for (const guard of guards) {
    const savesBefore = saves
    const result = []
    guard({}, {}, decision => result.push(decision))
    dialog.onCancel({ triggerCancel: true })
    assert.deepEqual(result, [false])
    assert.equal(saves, savesBefore)
    guard({}, {}, decision => result.push(decision))
    dialog.onCancel({ triggerCancel: false })
    assert.deepEqual(result, [false, undefined])
    guard({}, {}, decision => result.push(decision))
    dialog.onOk()
    assert.deepEqual(result, [false, undefined, undefined])
  }
  assert.equal(saves, 2)
})

test('unified detail agent prepares immediately and only releases on empty id or unmount', async () => {
  const source = await readRelative('../views/device/list/agent/useDeviceDetailAgent.ts')
  const sync = sliceFunction(source, 'const sync = async () => {', ['watch(', 'onBeforeUnmount('])

  assert.match(source, /route\.params\.deviceId \?\? route\.params\.id/)
  assert.match(source, /bubbleIcon: 'HddOutlined'/)
  assert.match(source, /bubbleIconBadge: 'MessageOutlined'/)
  assert.match(source, /bubbleClassName: 'ai-float-btn-wrapper--device-agent'/)
  assert.match(sync, /if \(!deviceId\) \{[\s\S]*release\(\)[\s\S]*return[\s\S]*\}/)
  assert.match(sync, /prepare\(deviceId\)/)
  assert.match(sync, /queryWithDevice/)

  const beforeEmptyCheck = sync.slice(0, sync.indexOf('if (!deviceId)'))
  assert.doesNotMatch(beforeEmptyCheck, /release\(\)/)
  assert.doesNotMatch(beforeEmptyCheck, /queryAgent/)

  const afterPrepare = sync.slice(sync.indexOf('prepare(deviceId)'))
  assert.doesNotMatch(afterPrepare, /release\(\)/)
  assert.match(afterPrepare, /queryWithDevice/)
  assert.match(source, /onBeforeUnmount\(\(\) => \{[\s\S]*release\(\)/)
})

test('the unified detail host owns the agent and default content does not', async () => {
  const view = await readRelative('../views/device/list/components/IotDeviceDetailView.vue')
  const content = await readRelative('../views/device/list/components/IotDeviceDefaultDetailContent.vue')
  const routes = await readRelative('../index.ts')

  assert.match(view, /useDeviceDetailAgent\(/)
  assert.match(view, /enabled:[\s\S]*!props\.embedded/)
  assert.ok(
    view.indexOf('useDeviceDetailAgent') < view.indexOf('await state.ready'),
    'host must prepare before the async device load gate',
  )
  assert.doesNotMatch(content, /useDeviceDetailAgent/)
  assert.match(routes, /const deviceListExtraRoutes = \[[\s\S]*?pageAgentClientId: 'deviceDetailChat'/)
  assert.match(routes, /'iot-user-device-list'[\s\S]*?\.\.\.deviceListExtraRoutes/)
  assert.match(routes, /'iot-user\/device\/list': deviceListExtraRoutes/)
  assert.match(routes, /'device\/Instance'[\s\S]*?pageAgentClientId: 'deviceDetailChat'/)
})

test('same pending client empty prepare does not bump queryVersion', async () => {
  const source = await readRelative('../../../jetlinks-web-core/src/store/ai.ts')
  const prepare = sliceFunction(
    source,
    'const prepareAgentConversation = (',
    ['const releaseAgentConversation = ('],
  )

  const pendingCheck = prepare.indexOf('pendingClientId.value === nextClientId')
  const versionBump = prepare.indexOf('queryVersion += 1')
  assert.ok(pendingCheck >= 0, 'same pending client is detected')
  assert.ok(versionBump > pendingCheck, 'queryVersion bump stays behind the idempotent return')
  assert.match(prepare, /emptyPrepare/)
})

test('gateway detail extra route and page host own the agent for the page lifetime', async () => {
  const source = await readRelative('../views/device/list/agent/useDeviceDetailAgent.ts')
  const view = await readRelative('../views/device/list/components/IotDeviceDetailView.vue')
  const host = await readRelative('../views/device/list/agent/DeviceDetailAgentHost.vue')
  const register = await readRelative('../register.ts')
  const gatewayRoutes = await readRelative('../../edge-master-ui/index.ts')
  const gatewayPage = await readRelative('../../edge-master-ui/views/workbench/gateway/GatewayDetailPage.vue')

  assert.match(source, /deviceId\?: MaybeRefOrGetter<string \| undefined \| null>/)
  assert.match(source, /enabled\?: MaybeRefOrGetter<boolean>/)
  assert.match(source, /toValue\(options\.deviceId\)/)
  assert.match(source, /route\.params\.deviceId \?\? route\.params\.id \?\? route\.params\.gatewayId/)
  assert.match(source, /if \(!isEnabled\(\)\) \{[\s\S]*disposeLocal\(\)[\s\S]*return/)
  assert.match(source, /onBeforeUnmount\(\(\) => \{[\s\S]*if \(!isEnabled\(\)\) \{[\s\S]*disposeLocal\(\)/)

  assert.match(host, /useDeviceDetailAgent\(\{[\s\S]*deviceId: \(\) => props\.deviceId/)
  assert.match(register, /DeviceDetailAgentHost:/)
  assert.match(gatewayRoutes, /'iot-user-device-list': \{[\s\S]*code: 'GatewayDetail'[\s\S]*pageAgentClientId: 'deviceDetailChat'/)
  assert.match(host, /tabs: \(\) => props\.tabs/)
  assert.match(gatewayPage, /:tabs="detailTabsWithExtensions\.map\(tab => tab\.key\)"/)
  assert.doesNotMatch(source, /IOT_GATEWAY_DETAIL_AGENT_ROUTE_NAME|route\.name/)
  assert.match(gatewayPage, /moduleRegistry\.getResourceItem<Component>\(\s*'device-manager-ui',\s*'components',\s*'DeviceDetailAgentHost'/)
  assert.match(gatewayPage, /gateway\.value\?\.deviceId \|\| String\(listRoute\.params\.gatewayId/)
  assert.doesNotMatch(gatewayPage, /views\/device\/list\/agent/)
  assert.doesNotMatch(gatewayPage, /useDeviceDetailAgent/)
  assert.doesNotMatch(gatewayRoutes, /views\/device\/list\/agent/)
  assert.match(view, /enabled: \(\) => !props\.embedded/)
})

test('Instance detail keeps its own agent lifecycle and does not use the unified hook', async () => {
  const instance = await readRelative('../views/device/Instance/Detail/useDeviceInstanceDetail.ts')
  const instanceView = await readRelative('../views/device/Instance/Detail/index.vue')

  assert.match(instance, /const DEVICE_DETAIL_AGENT_CLIENT_ID = 'deviceDetailChat'/)
  assert.match(instance, /prepareAgentConversation\(DEVICE_DETAIL_AGENT_CLIENT_ID/)
  assert.match(instance, /releaseAgentConversation\(DEVICE_DETAIL_AGENT_CLIENT_ID/)
  assert.doesNotMatch(instance, /useDeviceDetailAgent/)
  assert.doesNotMatch(instanceView, /useDeviceDetailAgent/)
})
