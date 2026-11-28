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
  assert.equal(columns(1151).some(column => column.key === 'manufacturer'), false)
  assert.equal(columns(1152).some(column => column.key === 'manufacturer'), true)
  assert.equal(columns(1152).reduce((sum, column) => sum + column.width, 40), 1152)
  const gateway = presentation.deviceListColumns({ ...model, activeType: 'gateway', monitorCell: {}, showChannel: true }, key => key, 1152)
  assert.equal(gateway.some(column => column.key === 'manufacturer'), false)
  assert.equal(gateway.some(column => column.key === 'monitor'), true)
})

test('scope editing retains multiple current groups and ignores missing area IDs', () => {
  const row = { groupBindings: [{ id: 'a' }, { id: 'b' }], areaBindings: [{ areaId: 'x' }, {}] }
  assert.deepEqual(presentation.deviceScopeIds(row, 'group'), ['a', 'b'])
  assert.deepEqual(presentation.deviceScopeIds(row, 'area'), ['x'])
})
