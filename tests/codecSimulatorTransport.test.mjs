import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { ref, watch, effectScope, nextTick } from 'vue'
import { transform } from 'esbuild'

const itemPath = new URL('../views/device/Instance/Detail/DeviceAccess/CodecSimulatorItem.vue', import.meta.url)
const composablePath = new URL('../views/device/Instance/Detail/DeviceAccess/composables/useCodecSimulator.ts', import.meta.url)
const panelPath = new URL('../views/device/Instance/Detail/DeviceAccess/CodecSimulatorPanel.vue', import.meta.url)
const currentDetailPath = new URL('../views/device/list/components/device-detail/IotDeviceTraceTab.vue', import.meta.url)
const legacyDetailPath = new URL('../views/device/Instance/Detail/DeviceAccess/index.vue', import.meta.url)

const [itemSource, composableSource, panelSource, currentDetailSource, legacyDetailSource] = await Promise.all([
  readFile(itemPath, 'utf8'),
  readFile(composablePath, 'utf8'),
  readFile(panelPath, 'utf8'),
  readFile(currentDetailPath, 'utf8'),
  readFile(legacyDetailPath, 'utf8'),
])

const { code } = await transform(`${composableSource}\nmodule.exports = { buildUplinkSimulatorPayload, isCodecSimulatorTransportSupported }`, {
  loader: 'ts',
  format: 'cjs',
})
const module = { exports: {} }
vm.runInNewContext(code, {
  module,
  exports: module.exports,
  require: id => {
    if (id === 'dayjs') return () => ({ format: () => '' })
    if (id === 'vue') return {
      nextTick: callback => callback?.(),
      onUnmounted: () => {},
      ref: value => ({ value }),
      unref: value => value?.value ?? value,
    }
    if (id === '@jetlinks-web/core') return { wsClient: {} }
    if (id === '@jetlinks-web/utils') return { onlyMessage: () => {}, randomString: () => 'test' }
    throw new Error(`Unexpected module: ${id}`)
  },
})
const { buildUplinkSimulatorPayload, isCodecSimulatorTransportSupported } = module.exports
const plain = value => JSON.parse(JSON.stringify(value))

test('renders uplink fields by transport instead of always using MQTT fields', () => {
  assert.match(itemSource, /v-if="isMqttTransport"/)
  assert.match(itemSource, /v-if="isWebSocketTransport"/)
  assert.match(itemSource, /v-model:value="model\.webSocketType"/)
  assert.doesNotMatch(itemSource, /isHttpTransport|model\.headers|model\.url/)
})

test('builds the uplink payload with the fields required by each transport', () => {
  assert.deepEqual(
    plain(buildUplinkSimulatorPayload({ id: '1', type: 'uplink', topic: '/device/a', qos: 1, payload: '{"temp":1}', encoding: 'JSON' }, 'MQTT')),
    { topic: '/device/a', qosLevel: 1, payload: { temp: 1 } },
  )
  assert.deepEqual(
    plain(buildUplinkSimulatorPayload({ id: '1', type: 'uplink', webSocketType: 'BINARY', payload: '0102', encoding: 'Hex' }, 'WebSocket')),
    { type: 'BINARY', payload: '0102' },
  )
  assert.deepEqual(
    plain(buildUplinkSimulatorPayload({ id: '1', type: 'uplink', payload: 'raw', encoding: 'Text' }, 'TCP')),
    { payload: 'raw' },
  )
  assert.match(composableSource, /payload: buildUplinkSimulatorPayload\(item, currentDevice\(\)\.transport\)/)
})

test('only exposes packet simulation for transports supported end-to-end', () => {
  assert.equal(isCodecSimulatorTransportSupported('MQTT'), true)
  assert.equal(isCodecSimulatorTransportSupported('WebSocket'), true)
  assert.equal(isCodecSimulatorTransportSupported('HTTP'), false)
  assert.equal(isCodecSimulatorTransportSupported('EDGE'), false)
  assert.equal(isCodecSimulatorTransportSupported(''), false)
})

test('hides packet simulation in both device-detail entries when transport is unsupported', () => {
  assert.doesNotMatch(currentDetailSource, /<CodecSimulatorPanel/)
  assert.match(legacyDetailSource, /v-if="canShowCodecSimulator"/)
  assert.match(legacyDetailSource, /codecSimulateSupport\.value && isCodecSimulatorTransportSupported\(instanceStore\.current\?\.transport\)/)
})

test('passes the device transport through the shared simulator panel', () => {
  assert.match(panelSource, /:transport="transport"/)
  assert.match(panelSource, /transport: props\.transport/)
})


test('simulator support ignores stale device responses, stops on unsupported transport and skips hidden preload', async () => {
  const source = await readFile(new URL('../views/device/list/components/device-detail/useDeviceSimulatorSupport.ts', import.meta.url), 'utf8')
  const compiled = await transform(source, { loader: 'ts', format: 'cjs' })
  const pending = []
  const module = { exports: {} }
  vm.runInNewContext(compiled.code, { module, exports: module.exports, require: id => {
    if (id === 'vue') return { ref, watch }
    if (id.includes('iotDeviceDetailReal.service')) return { iotDeviceDetailRealApi: {
      existsDeviceCodecSimulateSupport: () => new Promise(resolve => pending.push(resolve)),
    } }
    if (id.includes('useCodecSimulator')) return { isCodecSimulatorTransportSupported }
    throw new Error(id)
  } })
  const id = ref('device-a'), transport = ref('MQTT'), enabled = ref(false), scope = effectScope()
  const supported = scope.run(() => module.exports.useDeviceSimulatorSupport(id, transport, enabled))
  assert.equal(pending.length, 0)
  enabled.value = true
  await nextTick()
  id.value = 'device-b'
  await nextTick()
  pending[0]({ status: 200, result: true })
  await new Promise(setImmediate)
  assert.equal(supported.value, false)
  pending[1]({ status: 200, result: true })
  await new Promise(setImmediate)
  assert.equal(supported.value, true)
  transport.value = 'HTTP'
  await nextTick()
  assert.equal(supported.value, false)
  assert.equal(pending.length, 2)
  transport.value = 'MQTT'
  await nextTick()
  scope.stop()
  pending[2]({ status: 200, result: true })
  await new Promise(setImmediate)
  assert.equal(supported.value, false)
})
