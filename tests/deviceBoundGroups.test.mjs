import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
const code = transformSync(readFileSync(new URL('../api/deviceGroup.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
function setup(groups, runtime = () => []) {
  const calls = []
  const module = { exports: {} }
  const request = { post: async (path, body) => {
    calls.push({ path, body })
    if (groups instanceof Error) throw groups
    const data = path.endsWith('/device/_runtime-query') ? runtime(body) : groups
    return { result: { data, total: data.length } }
  } }
  new Function('require', 'module', 'exports', code)(id => id === '@jetlinks-web/core' ? { request }
    : id === './deviceListDefaultTerms' ? { withIotDeviceListDefaultTerms: terms => terms }
    : id.startsWith('.') ? {} : require(id), module, module.exports)
  return { query: module.exports.queryDeviceBoundGroups_api, calls }
}

const groups = [
  { id: 'a', name: 'A', devices: [{ id: 'device' }, { id: 'device' }, { id: 'gateway' }] },
  { id: 'b', name: 'B', devices: [{ id: 'device' }, { id: 'child' }] },
  { id: 'c', name: 'C', devices: [{ id: 'unrequested' }] },
]

test('one device reads all visible bound groups in one request without runtime fan-out', async () => {
  const { query, calls } = setup(groups)
  const result = await query(['device'])
  assert.deepEqual(result.device.map(group => group.id), ['a', 'b'])
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { path: '/device/group/_query/_detail', body: { paging: false, sorts: [{ name: 'sortIndex', order: 'asc' }] } })
})

test('batch lookup keeps gateway and child membership, deduplicates IDs and excludes unrelated devices', async () => {
  const { query, calls } = setup(groups)
  const result = await query(['device', 'gateway', 'child', 'device', '', 'missing'], [])
  assert.deepEqual(Object.keys(result).sort(), ['child', 'device', 'gateway'])
  assert.deepEqual(result.device.map(group => group.id), ['a', 'b'])
  assert.deepEqual(result.gateway.map(group => group.id), ['a'])
  assert.deepEqual(result.child.map(group => group.id), ['b'])
  assert.equal(calls.length, 1)
})

test('empty input makes no request and empty or visibility-filtered responses create no memberships', async () => {
  const { query, calls } = setup([{ id: 'visible', name: 'Visible', devices: [{ id: 'permitted' }] }, { id: 'empty', devices: [] }])
  assert.deepEqual(await query(['', '']), {})
  assert.equal(calls.length, 0)
  assert.deepEqual(await query(['restricted', 'unknown']), {})
  const empty = setup([])
  assert.deepEqual(await empty.query(['device']), {})
  assert.equal(empty.calls.length, 1)
})

test('a permission failure is propagated without falling back to another membership endpoint', async () => {
  const forbidden = Object.assign(new Error('forbidden'), { status: 403 })
  const { query, calls } = setup(forbidden)
  await assert.rejects(query(['device']), error => error === forbidden)
  assert.equal(calls.length, 1)
})

test('nonempty device conditions retain server-side filtering rather than using unfiltered group members', async () => {
  const baseTerms = [{ column: 'deviceType', termType: 'eq', value: 'gateway' }]
  const { query, calls } = setup(groups, body => body.terms.find(term => term.termType === 'dev-group').value === 'a' ? [{ id: 'gateway' }] : [])
  const result = await query(['device', 'gateway'], baseTerms)
  assert.deepEqual(Object.keys(result), ['gateway'])
  assert.deepEqual(result.gateway.map(group => group.id), ['a'])
  const runtimeCalls = calls.filter(call => call.path.endsWith('/device/_runtime-query'))
  assert.equal(runtimeCalls.length, groups.length)
  assert.ok(runtimeCalls.every(call => call.body.terms.some(term => term.column === 'deviceType' && term.value === 'gateway')))
  assert.ok(runtimeCalls.every(call => call.body.terms.some(term => term.termType === 'in' && term.value.join(',') === 'device,gateway')))
})
