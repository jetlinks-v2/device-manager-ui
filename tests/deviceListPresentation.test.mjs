import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../views/device/list/unified/deviceListPresentation.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText
const presentation = {}
new Function('require', 'exports', code)(require, presentation)

test('connection timestamp belongs to the displayed state, never creation or registration', () => {
  const device = { onlineAt: 1000, offlineAt: 2000, createdAt: '2026-01-01', lastSeenTimestamp: 3000 }
  assert.equal(presentation.deviceConnectionTime({ ...device, connectionStatus: 'online' }), 1000)
  assert.equal(presentation.deviceConnectionTime({ ...device, connectionStatus: 'offline' }), 2000)
  assert.equal(presentation.deviceConnectionTime({ ...device, connectionStatus: 'disabled' }), undefined)
  assert.equal(presentation.deviceConnectionTime({ connectionStatus: 'offline', lastSeenTimestamp: 3000 }), undefined)
  assert.equal(presentation.deviceConnectionTime({ ...device, connectionStatus: 'online' }, { connectedAt: 4000 }), 4000)
  assert.equal(presentation.deviceConnectionTime({ ...device, connectionStatus: 'offline' }, { connectedAt: 4000 }), 2000)
})

test('list moves management to status and detail while retaining supported gateway data', () => {
  const base = { activeType: 'all', showArea: true, showChannel: true }
  const keys = model => presentation.deviceListColumns(model, key => key).map(column => column.key)
  assert.deepEqual(keys(base), ['name', 'status', 'product', 'scope'])
  assert.deepEqual(keys({ ...base, activeType: 'gateway', monitorCell: {} }), ['name', 'status', 'monitor', 'product', 'scope', 'channel'])
  assert.deepEqual(keys({ ...base, activeType: 'gateway', showChannel: false }), ['name', 'status', 'product', 'scope'])
})

test('wide columns use the real width budget, including gateway metrics and selection', () => {
  const model = { activeType: 'all', showArea: true, showChannel: false }
  const columns = width => presentation.deviceListColumns(model, key => key, width)
  assert.equal(columns(927).some(column => column.key === 'area'), false)
  assert.equal(columns(928).some(column => column.key === 'area'), true)
  assert.equal(columns(1103).some(column => column.key === 'access'), false)
  assert.equal(columns(1104).some(column => column.key === 'access'), true)
  assert.equal(columns(1327).some(column => column.key === 'manufacturer'), false)
  assert.equal(columns(1328).some(column => column.key === 'manufacturer'), true)
  assert.equal(columns(1328).reduce((sum, column) => sum + column.width, 40), 1328)
  for (let width = 824; width <= 1600; width++) {
    const values = columns(width)
    assert(values.reduce((sum, column) => sum + column.width, 40) <= width)
    if (width > 824) assert(columns(width - 1).every(previous => values.some(column => column.key === previous.key) || previous.key === 'scope'))
  }
  const gateway = presentation.deviceListColumns({ ...model, activeType: 'gateway', monitorCell: {}, showChannel: true }, key => key, 1152)
  assert.equal(gateway.some(column => column.key === 'manufacturer'), false)
  assert.equal(gateway.some(column => column.key === 'monitor'), true)
})

test('access uses the bound gateway for children and deduplicates the named transport', () => {
  assert.deepEqual(presentation.deviceAccess({ accessName: 'MQTT', accessMode: 'provider-code', transport: 'MQTT' }), { gateway: '', text: 'MQTT', detail: 'MQTT' })
  assert.deepEqual(presentation.deviceAccess({ parentId: 'g', parentName: 'Workshop gateway', accessName: 'MQTT', transport: 'TCP' }), { gateway: 'Workshop gateway', text: 'Workshop gateway', detail: 'MQTT · TCP' })
  assert.equal(presentation.deviceAccess({ parentId: 'g', accessMode: '--' }).text, 'g')
  assert.equal(presentation.deviceAccess({ accessMode: '--', transport: '—' }).text, '')
})

test('scope editing retains multiple current groups and ignores missing area IDs', () => {
  const row = { groupBindings: [{ id: 'a' }, { id: 'b' }], areaBindings: [{ areaId: 'x' }, {}] }
  assert.deepEqual(presentation.deviceScopeIds(row, 'group'), ['a', 'b'])
  assert.deepEqual(presentation.deviceScopeIds(row, 'area'), ['x'])
})
