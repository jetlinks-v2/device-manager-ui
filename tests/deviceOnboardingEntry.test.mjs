import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../views/device/list/hooks/useIotDeviceAssetActions.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
new Function('require', 'exports', code)(id => {
  if (id === 'vue') return vue
  if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
  if (id === '@jetlinks-web/utils') return { onlyMessage() {} }
  if (id === '@device-manager-ui/api/device' || id === './useIotDeviceStatus') return {}
  return require(id)
}, exports)

test('onboarding preserves an existing edit, reuses an open create form and respects busy state', async t => {
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  const device = { id: 'one', name: 'Existing device' }
  const actions = scope.run(() => exports.useIotDeviceAssetActions(vue.ref([device]), () => {}))
  actions.openEditDrawer(device)
  assert.equal(actions.openCreateDrawer(), false)
  assert.equal(actions.editingDevice.value.id, 'one')
  actions.deviceFormOpen.value = false
  await vue.nextTick()
  assert.equal(actions.openCreateDrawer(), true)
  assert.equal(actions.openCreateDrawer(), true)
  assert.equal(actions.editingDevice.value, null)
  actions.actionBusyId.value = 'one'
  assert.equal(actions.openCreateDrawer(), false)
})
