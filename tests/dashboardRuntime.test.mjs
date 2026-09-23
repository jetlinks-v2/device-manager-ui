import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

// Execute the production composables with real Vue reactivity/lifecycle and bounded service doubles.
function load(relative, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.VITE_PERSONAL_TOKEN_KEY', "'personal'")
    .replaceAll('import.meta.env.VITE_PERSONAL_TOKEN_URL_KEY', "'personalToken'")
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('exports', 'require', ...Object.keys(globals), output)(exports, id => dependencies[id] ?? require(id), ...Object.values(globals))
  return exports
}

function mount(setup) {
  let value
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp({ setup() { value = setup(); return () => null } })
  app.mount({})
  return { value, unmount: () => app.unmount() }
}

function eventBus() {
  const callbacks = new Map()
  const removed = []
  return { callbacks, removed, window: { $viewDataEventBus: {
    subscribe(id, callback) { callbacks.set(id, callback); return () => { removed.push(id); callbacks.delete(id) } },
  } } }
}

test('device lists retain preview rows, first selection and updates without duplicate rows', async () => {
  const bus = eventBus()
  const { useDeviceListData } = load('../visDashboard/hooks/useDeviceListData.ts', {}, { window: bus.window })
  const props = vue.reactive({ info: { dataSourceProps: [] } })
  const { value, unmount } = mount(() => useDeviceListData(props, vue.ref({ selectFirstByDefault: true })))
  assert.equal(value.deviceListData.value.length, 3)
  assert.equal(value.selectedRowKey.value, 'mock_1')
  props.info.dataSourceProps = [{ id: 'devices' }]
  await vue.nextTick()
  assert.equal(value.deviceListData.value.length, 0)
  const receive = bus.callbacks.get('devices')
  receive({ id: 'd1', name: 'A', 'deviceType.text': 'Gateway', 'state.value': 'online' })
  assert.equal(value.selectedRowKey.value, 'd1')
  receive({ id: 'd1', name: 'B', 'deviceType.text': 'Gateway', 'state.value': 'offline' })
  assert.equal(value.deviceListData.value.length, 1)
  assert.equal(value.deviceListData.value[0].name, 'B')
  assert.equal(value.deviceListData.value[0].online, false)
  assert.equal(value.deviceListData.value[0].activeTime, '--')
  unmount()
  assert.deepEqual(bus.removed, ['devices'])
})

test('device controls retain project scope, on/off inputs and zero-valued property writes', async () => {
  const calls = []
  const messages = []
  const { useControl } = load('../visDashboard/hooks/useControl.ts', {
    '../../api/dashboardRuntime': { executeCommand: async (...args) => { calls.push(args); return { success: true } } },
    '@jetlinks-web/utils': { onlyMessage: value => messages.push(value) },
    '@jetlinks-web-core/utils/module-registry': { moduleRegistry: { getResource: () => ({ useProjectStore: () => ({}) }) } },
    pinia: { storeToRefs: () => ({ currentProjectInfo: vue.ref({ projectId: 'project-1' }) }) },
  })
  const control = useControl()
  await control.executeFunction({ config: {} }, true)
  assert.equal(calls.length, 0)
  const record = { deviceId: 'device-1', mappingId: 'power', config: { function: { isChecked: true, openFunctionId: 'on', openFunctionKey: 'level', openFunctionValue: 0, closeFunctionId: 'off' } } }
  await control.executeFunction(record, true)
  await control.executeFunction(record, false)
  await control.executeProperties(record, 0)
  assert.deepEqual(calls[0], ['deviceService:device', 'FunctionInvoke', 'project-1', { message: { deviceId: 'device-1', functionId: 'on', inputs: [{ name: 'level', value: 0 }] } }])
  assert.deepEqual(calls[1][3].message, { deviceId: 'device-1', functionId: 'off', inputs: [] })
  assert.deepEqual(calls[2], ['deviceService:device', 'WriteProperty', 'project-1', { message: { deviceId: 'device-1', properties: { power: 0 } } }])
  assert.equal(messages.length, 3)
})

test('dashboard command service forwards the original payload and propagates request failures', async () => {
  const requests = []
  let fail = false
  const error = new Error('request failed')
  const { executeCommand } = load('../api/dashboardRuntime.ts', {
    '@jetlinks-web-core/utils/module-registry': { moduleRegistry: { getResource(moduleId, kind) {
      assert.equal(moduleId, 'visualization-manager-ui')
      assert.equal(kind, 'utils')
      return { request: { async post(...args) { if (fail) throw error; requests.push(args); return { success: true } } } }
    } } },
  })
  const payload = { message: { deviceId: 'device-1', properties: { enabled: false } } }
  assert.deepEqual(await executeCommand('deviceService:device', 'WriteProperty', 'project-1', payload), { success: true })
  assert.equal(requests[0][0].trim(), '/visualization/command-supports/deviceService:device/WriteProperty/project-1/execute')
  assert.equal(requests[0][1], payload)
  fail = true
  await assert.rejects(executeCommand('deviceService:device', 'WriteProperty', 'project-1', payload), error)
})
