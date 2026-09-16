import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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
  assert.match(gatewayRoutes, /'iot-user\/edge-gateway': \{[\s\S]*code: 'Detail'[\s\S]*pageAgentClientId: 'deviceDetailChat'/)
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
