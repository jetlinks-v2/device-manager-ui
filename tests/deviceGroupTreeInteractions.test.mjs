import assert from 'node:assert/strict'
import test from 'node:test'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const hooks = 'views/device/list/hooks/'
const { canMoveGroup, resolveGroupDrop, planGroupMove } = runtimeModules().load(hooks + 'iotDeviceGroupTreeInteractions.ts')
const group = (id, parentId = '', sortIndex = 0) => ({ id, key: id, name: id, parentId, sortIndex, deviceCount: 0 })
const groups = () => [group('a'), group('b', '', 1), group('a1', 'a'), group('a2', 'a', 1), group('deep', 'a1'), group('b1', 'b')]

test('native gap drops reorder siblings without changing parents or input nodes', () => {
  const nodes = groups(), before = structuredClone(nodes)
  const intent = resolveGroupDrop(nodes, 'a2', 'a1', -1)
  assert.deepEqual(intent, { id: 'a2', parentId: 'a', beforeId: 'a1' })
  assert.deepEqual(planGroupMove(nodes, intent), [{ id: 'a2', sortIndex: 0 }, { id: 'a1', sortIndex: 1 }])
  assert.deepEqual(planGroupMove(nodes, { id: 'a1', parentId: 'a', beforeId: 'a2' }), [], 'unchanged order makes no save request')
  assert.deepEqual(nodes, before)
})

test('native body and expanded-branch drops move whole branches using sparse tree patches', () => {
  const nodes = groups()
  for (const [position, expanded] of [[0, false], [1, true]]) {
    const intent = resolveGroupDrop(nodes, 'a1', 'b', position, expanded)
    assert.deepEqual(intent, { id: 'a1', parentId: 'b', beforeId: 'b1' })
    assert.deepEqual(planGroupMove(nodes, intent), [{ id: 'a1', parentId: 'b', sortIndex: 0 }, { id: 'b1', sortIndex: 1 }])
  }
  assert.equal(resolveGroupDrop(nodes, 'a1', 'b', 1, false).parentId, '', 'a closed branch bottom gap inserts after it at its own level')
})

test('drop into the synthetic root sends the explicit empty-parent marker', () => {
  const intent = resolveGroupDrop(groups(), 'a1', undefined, 0)
  assert.deepEqual(intent, { id: 'a1', parentId: '', beforeId: 'a' })
  assert.deepEqual(planGroupMove(groups(), intent)[0], { id: 'a1', parentId: '', sortIndex: 0 })
  assert.equal(resolveGroupDrop(groups(), 'a1', undefined, -1), undefined)
  assert.equal(resolveGroupDrop(groups(), 'a1', undefined, 1), undefined)
})

test('self, descendants, unknown destinations and stale insertion references are rejected', () => {
  const nodes = groups()
  assert.equal(canMoveGroup(nodes, 'a', 'deep'), false)
  assert.equal(canMoveGroup(nodes, 'a', 'a'), false)
  assert.equal(canMoveGroup(nodes, 'a1', 'b'), true)
  assert.equal(resolveGroupDrop(nodes, 'a', 'deep', 0), undefined)
  assert.equal(resolveGroupDrop(nodes, 'a', 'a', -1), undefined)
  assert.equal(resolveGroupDrop(nodes, 'missing', 'b', 0), undefined)
  assert.equal(resolveGroupDrop(nodes, 'a', 'missing', 0), undefined)
  assert.equal(planGroupMove(nodes, { id: 'a1', parentId: 'b', beforeId: 'missing' }), undefined)
})

function management(api = {}, reload = async () => {}) {
  const calls = [], changes = [], messages = [], nodes = groups()
  const loader = runtimeModules({
    '@jetlinks-web/utils': { onlyMessage: (...args) => messages.push(args) },
    '@device-manager-ui/api/deviceGroup': {
      createDeviceGroup_api: async input => { calls.push(['create', input]); return { ...group('created'), ...input } },
      updateDeviceGroup_api: async input => { calls.push(['update', input]); return { ...group(input.id), ...input } },
      deleteDeviceGroup_api: async () => {},
      saveDeviceGroupTree_api: async patches => { calls.push(['tree', patches]); await api.save?.(patches) },
    },
  })
  const state = loader.load(hooks + 'useIotDeviceGroupManagement.ts').useIotDeviceGroupManagement({
    getActiveScope: () => ({ type: 'group', id: 'deep' }), getGroups: () => nodes,
    reloadGroups: reload, changeScope: scope => changes.push(scope),
  })
  return { state, calls, changes, messages, nodes }
}

test('root creation ignores the selected deep node and edit preserves the explicit parent choice', async () => {
  const view = management()
  view.state.openCreateGroup()
  assert.equal(view.state.groupEditing.value, null)
  await view.state.saveGroup({ name: 'Top', parentId: '' })
  assert.equal(view.calls[0][1].parentId, '')
  assert.equal(view.changes.at(-1).id, 'created')
  view.state.openCreateChildGroup(view.nodes[0])
  assert.equal(view.state.groupEditing.value.id, 'a')
  await view.state.saveGroup({ name: 'Child', parentId: 'a' })
  assert.equal(view.calls.at(-1)[1].parentId, 'a')
  view.state.openEditGroup(view.nodes[2])
  await view.state.saveGroup({ name: 'Renamed', parentId: '' })
  assert.equal(view.calls.at(-1)[0], 'update')
  assert.equal(view.calls.at(-1)[1].parentId, '')
  assert.equal(view.changes.at(-1).id, 'a1')
})

test('move saves one batch, rejects overlap and preserves the selected scope', async () => {
  let release, reloads = 0
  const view = management({ save: () => new Promise(resolve => { release = resolve }) }, async () => { reloads++ })
  const intent = resolveGroupDrop(view.nodes, 'a1', 'b', 0)
  const pending = view.state.moveGroup(intent)
  assert.equal(view.state.groupMoving.value, true)
  assert.equal(await view.state.moveGroup(intent), false)
  assert.equal(view.calls.length, 1)
  release(); assert.equal(await pending, true)
  assert.equal(reloads, 1)
  assert.equal(view.state.groupMoving.value, false)
  assert.deepEqual(view.changes, [])
  assert.deepEqual(view.calls[0][1], [{ id: 'a1', parentId: 'b', sortIndex: 0 }, { id: 'b1', sortIndex: 1 }])
})

test('save failure clears busy state without local tree mutation; post-save refresh errors are distinguished', async () => {
  const view = management({ save: async () => { throw new Error('denied') } })
  const before = structuredClone(view.nodes)
  assert.equal(await view.state.moveGroup({ id: 'a1', parentId: 'b' }), false)
  assert.equal(view.state.groupMoving.value, false)
  assert.deepEqual(view.nodes, before)
  assert.equal(view.messages.at(-1)[0], 'denied')
  const refresh = management({}, async () => { throw new Error('offline') })
  assert.equal(await refresh.state.moveGroup({ id: 'a1', parentId: 'b' }), false)
  assert.equal(refresh.messages.at(-1)[0], 'IotDeviceList.scope.groupMoveRefreshFailed')
})

test('real API adapter uses the existing tree batch endpoint and normalizes boolean update responses', async () => {
  const requests = []
  const api = runtimeModules({
    '@jetlinks-web/core': { request: {
      patch: async (...args) => { requests.push(args); return { result: { updated: 2 } } },
      put: async () => ({ result: true }),
    } },
    './alarmRecord': {}, './deviceGroupRuntime': {}, './deviceListDefaultTerms': {}, './deviceTrend': {},
  }).load('api/deviceGroup.ts')
  const patches = [{ id: 'a1', parentId: '', sortIndex: 1 }]
  await api.saveDeviceGroupTree_api(patches)
  assert.deepEqual(requests, [['/device/group', patches]])
  const updated = await api.updateDeviceGroup_api({ id: 'a1', code: 'a1', name: 'Renamed', parentId: '', sortIndex: 0 })
  assert.equal(updated.id, 'a1')
  assert.equal(updated.name, 'Renamed')
})
