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
  assert.match(spaceAreaApiSource, /space\/device-binding\/_bind/)
  assert.doesNotMatch(spaceAreaApiSource, /space\/device-binding\/_set/)
})
