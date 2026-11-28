import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as vue from 'vue'
import ts from 'typescript'

test('refresh retries failed scope options and clears their error state', async t => {
  const source = readFileSync(new URL('../deviceScope.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  let requests = 0
  const count = () => Object.fromEntries(['totalDeviceCount', 'areaDeviceCounts', 'groupDeviceCounts', 'unboundAreaDeviceCount', 'unassignedGroupDeviceCount', 'boundAreaDeviceCount', 'assignedGroupDeviceCount', 'loading', 'error'].map(key => [key, vue.ref(key.endsWith('Counts') ? {} : 0)]))
  const dependencies = {
    vue,
    'vue-router': { useRoute: () => ({ query: { scopeType: 'group' } }), useRouter: () => ({ replace() {} }) },
    './api/deviceGroup': { queryDeviceGroupDetailList_api: async () => { if (++requests === 1) throw Error('temporary'); return [{ id: 'a', name: 'A' }] } },
    './api/spaceArea': { existsDeviceSpaceAreaSupport_api: async () => true, queryProjectSpaceAreaSettings_api: async () => ({ areas: [] }) },
    './views/device/list/hooks/useIotDeviceRouting': { resolveIotProjectId: () => 'p' },
    './views/device/list/hooks/iotAreaTreeOptions': { mergeDeviceBoundAreas: areas => areas },
    './views/device/list/hooks/useIotDeviceScopeCounts': { buildAreaScopeIds: () => ({}), useIotDeviceScopeCounts: count },
    './views/device/list/hooks/iotDeviceScopeTerms': { buildDeviceScopeTerms: () => [] },
  }
  const exports = {}
  new Function('require', 'exports', code)(id => dependencies[id], exports)
  const scope = vue.effectScope(), refresh = vue.ref(0)
  const state = scope.run(() => exports.useDeviceScope(vue.ref([]), refresh))
  t.after(() => scope.stop())
  await assert.rejects(state.ensureReady(), /failed to load/)
  assert.equal(state.sidebarProps.value.countsError, true)
  state.sidebarProps.value.onRetry(); await vue.nextTick()
  await state.ensureReady()
  assert.equal(requests, 2)
  assert.equal(state.sidebarProps.value.loadError, false)
  assert.equal(state.sidebarProps.value.groups[0].id, 'a')
})
