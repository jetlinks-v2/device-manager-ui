import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { cloneDeep } from 'lodash-es'
import { runtimeModules } from './helpers/runtimeModules.mjs'

globalThis.localStorage = { getItem: () => null }
const { filterTreeNodes } = runtimeModules({ 'ant-design-vue': { message: {} } }).load('../../node_modules/@jetlinks-web/utils/src/util.ts')

const hooks = 'views/device/list/hooks/'
const runtime = runtimeModules({ 'lodash-es': { cloneDeep }, '@jetlinks-web/utils': { filterTreeNodes } })
const terms = runtime.load(hooks + 'iotDeviceScopeTerms.ts')
const { useIotDeviceScopeSidebar } = runtime.load(hooks + 'useIotDeviceScopeSidebar.ts')
const { IOT_ALL_BOUND_AREAS_SCOPE_ID: allAreas, IOT_ALL_ASSIGNED_GROUPS_SCOPE_ID: allGroups, IOT_UNBOUND_AREA_SCOPE_ID: unbound, IOT_UNASSIGNED_GROUP_SCOPE_ID: unassigned } = terms
const group = (id, parentId) => ({ id, key: id, name: id, parentId, sortIndex: 0 })
function sidebar(overrides = {}) {
  const props = vue.reactive({
    activeType: 'area', activeId: '',
    areas: [{ id: 'park', name: '园区' }, { id: 'shop', name: '车间', parentId: 'park' }, { id: 'line', name: '焊接工序', parentId: 'shop' }],
    groups: [group('parent'), group('child', 'parent')],
    totalDeviceCount: 8, unboundAreaDeviceCount: 5, unassignedGroupDeviceCount: 6,
    boundAreaDeviceCount: 3, assignedGroupDeviceCount: 2,
    areaDeviceCounts: { park: 3, shop: 3, line: 2 }, groupDeviceCounts: { parent: 2, child: 2 }, ...overrides,
  })
  const scope = vue.effectScope(), changes = []
  const state = scope.run(() => useIotDeviceScopeSidebar(props, value => { changes.push(value); props.activeType = value.type; props.activeId = value.id }))
  return { props, state, changes, stop: () => scope.stop() }
}

test('quick scopes stay outside a selectable hierarchy root and use distinct device totals', () => {
  const h = sidebar()
  try {
    assert.deepEqual(h.state.quickScopes.value.map(node => node.key), ['', unbound])
    const root = h.state.treeData.value[0]
    assert.equal(root.key, allAreas)
    assert.equal(root.count, 3, 'root count is not the sum of overlapping parent and child counts')
    assert.deepEqual(root.children.map(node => node.key), ['park'])
    h.state.onSelect([allAreas])
    assert.deepEqual(h.changes.at(-1), { type: 'area', id: allAreas })
    h.state.chooseScope('')
    assert.deepEqual(h.changes.at(-1), { type: 'area', id: '' })
  } finally { h.stop() }
})

test('scope expansion starts unset so the public tree owns its default depth', async () => {
  const h = sidebar()
  try {
    assert.equal(h.state.expandedKeys.value, undefined)
    assert.equal(h.state.treeData.value[0].children[0].children[0].children[0].key, 'line')
    h.state.onExpand([allAreas])
    h.props.areaDeviceCounts = { park: 4, shop: 4, line: 3 }; await vue.nextTick()
    assert.deepEqual([...h.state.expandedKeys.value], [allAreas], 'count refresh does not reopen a user-collapsed branch')
  } finally { h.stop() }
})

test('space and group selection preserve separate expansion preferences', async () => {
  const h = sidebar()
  try {
    h.state.onExpand([allAreas])
    assert.equal(h.state.quickScopes.value.length, 2)
    h.props.activeType = 'group'; await vue.nextTick()
    assert.equal(h.state.expandedKeys.value, undefined)
    assert.equal(h.state.treeData.value[0].key, allGroups)
    assert.equal(h.state.treeData.value[0].count, 2)
    h.state.onExpand([allGroups])
    h.props.activeType = 'area'; await vue.nextTick()
    assert.deepEqual([...h.state.expandedKeys.value], [allAreas])
  } finally { h.stop() }
})

test('empty data has no fake tree root and unreadable parents do not hide visible spaces', () => {
  const empty = sidebar({ areas: [], groups: [] })
  try {
    assert.equal(empty.state.hasData.value, false)
    assert.deepEqual(empty.state.treeData.value, [])
    assert.equal(empty.state.quickScopes.value.length, 2)
  } finally { empty.stop() }
  const orphan = sidebar({ areas: [{ id: 'visible', name: '可见空间', parentId: 'unreadable' }] })
  try { assert.equal(orphan.state.treeData.value[0].children[0].key, 'visible') } finally { orphan.stop() }
})

test('root and unbound queries preserve their complementary scope semantics', () => {
  assert.deepEqual(terms.buildDeviceScopeTerms('area', allAreas, []), [{ column: 'id', termType: 'space-bind$any', value: '__any_space_binding__' }])
  assert.equal(terms.buildDeviceScopeTerms('area', unbound, [])[0].termType, 'space-bind$any$not')
  assert.deepEqual(terms.buildDeviceScopeTerms('group', allGroups, ['g1', 'g2']), [{ column: 'id', termType: 'dev-group', value: ['g1', 'g2'] }])
  assert.deepEqual(terms.buildDeviceScopeTerms('group', allGroups, []), [{ column: 'id', termType: 'dev-group', value: [] }], 'empty associated scope must not become all devices')
  assert.deepEqual(terms.buildDeviceScopeTerms('group', unassigned, []), [])
  assert.equal(terms.buildDeviceScopeTerms('group', 'g1', [])[0].termType, 'dev-group-tree')
  assert.deepEqual(terms.buildDeviceScopeTerms('area', 'park', [], ['park', 'shop'])[0].value, ['park', 'shop'])
  assert.deepEqual(terms.buildDeviceScopeTerms('area', '', []), [])
})

test('root counts use the same distinct-device queries in the existing batch request', async () => {
  const requests = [], base = [{ column: 'deviceType', value: 'gateway' }]
  const loader = runtimeModules({
    '@device-manager-ui/api/device': { countDevice_api: async () => 8 },
    '@device-manager-ui/api/deviceGroup': { batchDeviceNodeSummary_api: async (items, filters) => {
      requests.push({ items, filters })
      return items.map(item => ({ id: item.id, deviceCount: item.id === allAreas ? 3 : item.id === allGroups ? 2 : 0 }))
    } },
  })
  const scope = vue.effectScope()
  const counts = scope.run(() => loader.load(hooks + 'useIotDeviceScopeCounts.ts').useIotDeviceScopeCounts(
    vue.ref('project'), vue.ref([]), vue.ref([group('g1'), group('g2')]), vue.ref(0), vue.ref(base), vue.ref(true),
  ))
  try {
    await new Promise(resolve => setImmediate(resolve)); await vue.nextTick()
    assert.equal(requests.length, 1)
    assert.deepEqual(requests[0].filters, base)
    assert.deepEqual(requests[0].items.find(item => item.id === allGroups).query.terms, terms.buildDeviceScopeTerms('group', allGroups, ['g1', 'g2']))
    assert.equal(counts.boundAreaDeviceCount.value, 3)
    assert.equal(counts.assignedGroupDeviceCount.value, 2)
  } finally { scope.stop() }
})
