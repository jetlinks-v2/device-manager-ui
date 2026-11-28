import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import * as vue from 'vue'
import { createComponentLoader } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

const load = createComponentLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key, locale: vue.ref('en-US') }) } })
const observation = load(fileURLToPath(new URL('../../../jetlinks-web-core/src/components/RuntimeDiagnostics/device-sessions/observation.ts', import.meta.url)))
const { useDeviceConnectionMetrics } = createComponentLoader({
  'vue-i18n': { useI18n: () => ({ t: key => key, locale: vue.ref('en-US') }) },
  '@jetlinks-web-core/components/RuntimeDiagnostics': observation,
})(fileURLToPath(new URL('../components/device-detail/useDeviceConnectionMetrics.ts', import.meta.url)))
const sample = (at, receive = '0', send = '0') => ({ sampledAt: at, connections: [{ key: 'socket', receive, send, messages: '0' }] })

test('rates wait for a pair, preserve real zero and never turn unknown traffic into zero', () => {
  const source = vue.reactive({ history: [], state: { status: 'loading' }, paused: false, requesting: true })
  const { metrics, traffic } = useDeviceConnectionMetrics(source)
  assert.equal(traffic.value.loading, true)
  source.history = [sample(1000)]; source.state = { status: 'ready', sampledAt: 1000 }
  assert.equal(traffic.value.loading, true)
  source.history.push(sample(3000))
  assert.equal(traffic.value.loading, false)
  assert.equal(traffic.value.value, '0 B/s')
  assert.equal(metrics.value[0].value, '0 B/s')
  source.history[1].connections[0].send = undefined
  assert.equal(traffic.value.loading, false)
  assert.equal(traffic.value.value, 'IotDeviceDetail.connection.notProvided')
})

test('paused and failed observation stops skeletons without inventing a rate', () => {
  const source = vue.reactive({ history: [sample(1000)], state: { status: 'ready', sampledAt: 1000 }, paused: false, requesting: false })
  const { traffic } = useDeviceConnectionMetrics(source)
  source.paused = true
  assert.equal(traffic.value.loading, false)
  assert.equal(traffic.value.value, 'IotDeviceDetail.connection.notProvided')
  source.paused = false; source.state.status = 'error'
  assert.equal(traffic.value.loading, false)
})
