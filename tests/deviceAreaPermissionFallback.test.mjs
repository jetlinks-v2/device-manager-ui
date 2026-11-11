import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const areaOptionsPath = new URL('../views/device/list/hooks/iotAreaTreeOptions.ts', import.meta.url)
const filterPath = new URL('../views/device/list/hooks/useIotDeviceAssetFilters.ts', import.meta.url)
const scopeCountsPath = new URL('../views/device/list/hooks/useIotDeviceScopeCounts.ts', import.meta.url)
const spaceAreaApiPath = new URL('../api/spaceArea.ts', import.meta.url)
const deviceScopePath = new URL('../deviceScope.ts', import.meta.url)

const areaOptionsSource = await readFile(areaOptionsPath, 'utf8')
const filterSource = await readFile(filterPath, 'utf8')
const scopeCountsSource = await readFile(scopeCountsPath, 'utf8')
const spaceAreaApiSource = await readFile(spaceAreaApiPath, 'utf8')
const deviceScopeSource = await readFile(deviceScopePath, 'utf8')

function loadAreaTreeOptions() {
  const compiled = ts.transpileModule(areaOptionsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const module = { exports: {} }
  new Function('exports', 'module', compiled)(module.exports, module)
  return module.exports
}

function createArea(id, parentId, canBindAsset) {
  return {
    id,
    projectId: 'project-1',
    parentId,
    name: id,
    type: 'site',
    canBindAsset,
    code: id,
    aliases: [],
    sortOrder: 0,
    description: '',
    planMode: 'own',
  }
}

test('known device bindings supplement a permission-filtered area tree without becoming bind targets', () => {
  const { mergeDeviceBoundAreas, isSelectableDeviceArea } = loadAreaTreeOptions()
  const visibleAreas = [
    createArea('root', undefined),
    createArea('building', 'root'),
    createArea('floor', 'building'),
    createArea('visible-target', 'floor'),
  ]

  const areas = mergeDeviceBoundAreas(visibleAreas, [{ areaId: 'hidden-area', area: '不可见区域' }], 'project-1')
  const hiddenArea = areas.find((area) => area.id === 'hidden-area')

  assert.equal(hiddenArea?.name, '不可见区域')
  assert.equal(hiddenArea?.boundOnly, true)
  assert.equal(isSelectableDeviceArea(areas, 'visible-target'), true)
  assert.equal(isSelectableDeviceArea(areas, 'hidden-area'), false)
})

test('unbound-device queries do not depend on the caller visible area IDs', () => {
  assert.match(filterSource, /termType:\s*'space-bind\$any\$not'/)
  assert.match(scopeCountsSource, /termType:\s*'space-bind\$any\$not'/)
  assert.match(deviceScopeSource, /termType:\s*'space-bind\$any\$not'/)
  assert.match(filterSource, /ANY_SPACE_BINDING_VALUE\s*=\s*'__any_space_binding__'/)
  assert.match(scopeCountsSource, /value:\s*'__any_space_binding__'/)
  assert.doesNotMatch(deviceScopeSource, /space-bind\$not\$device/)
})

test('the scope tree reads binding IDs from the device-binding endpoint instead of display extensions', () => {
  assert.match(filterSource, /queryDeviceSpaceAreaBindings_api\(deviceIds\)/)
  assert.match(filterSource, /mergeVisibleDeviceAreaBindings\(bindings, fallbackBindings\)/)
  assert.match(filterSource, /fallbackVisibleDeviceAreaBindings\(rows\)/)
  assert.match(filterSource, /mergeDeviceBoundAreas\([\s\S]*visibleDeviceAreaBindings\.value/)
  assert.match(deviceScopeSource, /mergeDeviceBoundAreas\([\s\S]*visibleDeviceAreaBindings\.value/)
  assert.match(deviceScopeSource, /watch\(deviceRows,[\s\S]*visibleDeviceAreaBindings\.value/)
})

test('device area writes use the bind endpoint', () => {
  assert.match(spaceAreaApiSource, /bindDevicesSpaceArea_api/)
  assert.match(spaceAreaApiSource, /space\/bind\/_bind/)
  assert.doesNotMatch(spaceAreaApiSource, /space\/bind\/_set/)
})

test('visible spaces at every depth default to selectable without capability metadata', () => {
  const { buildAreaTreeData, isSelectableDeviceArea } = loadAreaTreeOptions()
  const areas = Array.from({ length: 6 }, (_, index) => createArea(
    `area-${index + 1}`,
    index ? `area-${index}` : undefined,
  ))
  areas.push(createArea('orphan', 'unreadable-parent'))

  for (const area of areas) assert.equal(isSelectableDeviceArea(areas, area.id), true, area.id)
  const visit = (nodes) => nodes.forEach(node => {
    assert.equal(node.disabled, false, node.value)
    assert.equal(node.selectable, true, node.value)
    visit(node.children || [])
  })
  visit(buildAreaTreeData(areas))
})

test('each space capability is independent and bound-only or unknown spaces remain unavailable', () => {
  const { buildAreaTreeData, isSelectableDeviceArea, mergeDeviceBoundAreas } = loadAreaTreeOptions()
  const areas = mergeDeviceBoundAreas([
    createArea('allowed', undefined, true),
    createArea('denied', 'allowed', false),
    createArea('default-open', 'denied'),
  ], [{ areaId: 'hidden', area: '不可见空间' }])
  // 补齐节点的展示数据即使带有能力标记，也不能变成新的绑定目标。
  areas.find(area => area.id === 'hidden').canBindAsset = true

  for (const id of ['allowed', 'default-open']) assert.equal(isSelectableDeviceArea(areas, id), true)
  for (const id of ['denied', 'hidden', 'missing']) assert.equal(isSelectableDeviceArea(areas, id), false)
  const nodes = buildAreaTreeData(areas)
  assert.equal(nodes.find(node => node.value === 'hidden').disabled, true)
  const denied = nodes.find(node => node.value === 'allowed').children[0]
  assert.equal(denied.disabled, true)
  assert.equal(denied.children[0].selectable, true)
})

function loadSpaceAreaApi(request) {
  const compiled = ts.transpileModule(spaceAreaApiSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(id => {
    assert.equal(id, '@jetlinks-web/core')
    return { request }
  }, module, module.exports)
  return module.exports
}

test('space queries default open, preserve explicit flags and do not request deprecated type settings', async () => {
  const calls = []
  const api = loadSpaceAreaApi({
    get: async () => ({ result: true }),
    post: async (url) => {
      calls.push(url)
      if (url === '/space/type/_query/no-paging') {
        return { result: [{ id: 'old-type', others: { canBindAsset: false } }] }
      }
      assert.equal(url, '/space/_query/tree')
      return { result: [{ id: 'root', children: [
        { id: 'historical', parentId: 'root', spaceTypeId: 'old-type' },
        { id: 'allowed', parentId: 'root', canBindAsset: true },
        { id: 'denied', parentId: 'root', canBindAsset: false },
        { id: 'string-allowed', parentId: 'root', canBindAsset: 'true' },
        { id: 'string-denied', parentId: 'root', canBindAsset: 'false' },
      ] }] }
    },
  })
  const settings = await api.queryProjectSpaceAreaSettings_api('project-1')
  assert.deepEqual(settings.areas.map(area => [area.id, area.canBindAsset]), [
    ['root', true], ['historical', true], ['allowed', true], ['denied', false],
    ['string-allowed', true], ['string-denied', false],
  ])
  assert.ok(settings.areas.every(area => area.projectId === 'project-1'))
  assert.equal(settings.areas.find(area => area.id === 'historical').parentId, 'root')
  assert.deepEqual(calls, ['/space/_query/tree'])
})
