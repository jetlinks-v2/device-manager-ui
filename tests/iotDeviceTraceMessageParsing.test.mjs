import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'

const sourcePath = new URL(
  '../views/device/list/components/device-detail/useIotDeviceTraceLog.ts',
  import.meta.url,
)
const source = await readFile(sourcePath, 'utf8')
const { code } = await transform(`${source}\nmodule.exports = { useIotDeviceTraceLog }`, {
  loader: 'ts',
  format: 'cjs',
})

let randomIndex = 0
let receiveWebSocketFrame
const module = { exports: {} }
const context = {
  module,
  exports: module.exports,
  requestAnimationFrame: callback => {
    setImmediate(callback)
    return 1
  },
  cancelAnimationFrame: () => {},
  require: id => {
    if (id === 'vue') return { ref: value => ({ value }) }
    if (id === 'rxjs/operators') return { map: mapper => mapper }
    if (id === '@jetlinks-web/core') {
      return {
        wsClient: {
          getWebSocket: () => ({
            pipe: mapper => ({
              subscribe: callback => {
                receiveWebSocketFrame = frame => callback(mapper(frame))
                return { unsubscribe: () => {} }
              },
            }),
          }),
        },
      }
    }
    if (id === '@jetlinks-web/utils') return { randomString: () => `trace-group-${++randomIndex}` }
    throw new Error(`Unexpected module: ${id}`)
  },
}
vm.runInNewContext(code, context)
const { useIotDeviceTraceLog } = module.exports

const payload = {
  type: 'data',
  error: false,
  traceId: 'a11e90dd374d6843d0541959c1e7678c',
  spanId: '6f7a4af2acf2bedb',
  parentSpanId: '6da4f5fcbaa982dc',
  operation: 'handle',
  detail: {
    attrs: {
      message: JSON.stringify({
        messageType: 'READ_PROPERTY_REPLY',
        success: true,
        messageId: '2108389345577185280',
        deviceId: '2108121655969517568',
      }),
    },
    events: [],
  },
  startTime: 1791514172727,
  endTime: 1791514172796,
  upstream: true,
}

test('stores the WebSocket response messageId on the runtime trace group', async () => {
  const traceLog = useIotDeviceTraceLog({ value: '2108121655969517568' })
  traceLog.subscribe()
  receiveWebSocketFrame({ payload })
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(traceLog.traceGroups.value.length, 1)
  assert.equal(traceLog.traceGroups.value[0].messageId, '2108389345577185280')
})
