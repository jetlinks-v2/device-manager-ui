import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const actionsSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8')
const listSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')

const permissionCheck = source.match(/function canDeviceBatchAction[\s\S]*?\n}/)[0]
const makePermissionCheck = (grants, code = 'iot-user-device-list') => {
  const js = ts.transpileModule(permissionCheck, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function('deviceMenuCode', 'authStore', `${js}; return canDeviceBatchAction`)(
    { value: code }, { hasPermission: permission => grants.includes(permission) },
  )
}

test('query-only users cannot use the create or batch operations', () => {
  const can = makePermissionCheck(['iot-user-device-list:view'])
  for (const action of ['add', 'delete', 'export', 'import', 'enable', 'syncStatus']) {
    assert.equal(can(action), false, action)
  }
  assert.ok(source.includes(`:disabled="busy || !canDeviceBatchAction('add')"`))
  for (const [key, action] of Object.entries({ export: 'export', import: 'import', activateAll: 'enable', syncStatus: 'syncStatus' })) {
    assert.ok(source.includes(`:disabled="!canDeviceBatchAction('${action}')" key="${key}"`))
  }
  assert.match(source, /:disabled="!canConfigureGatewayPlugins" key="plugins"/)
  assert.match(actionsSource, /provider.id !== 'gateway' \|\| canDeviceAction\('add'\)/)
  for (const action of ['enable', 'disable']) {
    assert.ok(source.includes(`:disabled="!canDeviceBatchAction('enable') || !selectedIds.length || busy" @click="batchToggle('${action}')"`))
  }
})

test('explicit grants keep their individual operations across menu aliases', () => {
  const can = makePermissionCheck(['device/Instance:export', 'iot-user/device/list:action'])
  assert.equal(can('export'), true)
  assert.equal(can('enable'), true)
  assert.equal(can('syncStatus'), true)
  assert.equal(can('import'), false)
  assert.equal(can('add'), false)
  assert.equal(makePermissionCheck(['iot-user-device-list:enable'])('syncStatus'), false)
})

test('shows device actions through each category list-menu permission', () => {
  assert.match(source, /<table-actions>[\s\S]*:hasPermission="`\$\{deviceMenuCode\}:action`"[\s\S]*:hasPermission="`\$\{deviceMenuCode\}:delete`"[\s\S]*<\/table-actions>/)
  assert.match(actionsSource, /return menu\.hasMenu\(provider\.menuCode\)/)
  assert.doesNotMatch(actionsSource, /auth\.hasPermission\(`\$\{provider\.menuCode\}:\$\{action\}`\)/)
})

test('counts all devices without applying category access-provider terms', () => {
  assert.match(listSource, /countDevice_api\(\{\}\)\.then\(value => \['all', value\] as const\)/)
  assert.doesNotMatch(listSource, /allTerms/)
})

// Execute the production hook to verify that opening a dialog does not bypass a revoked grant.
async function assignmentFixture(initialGrants = []) {
  const vue = await import('vue')
  const grants = vue.ref(initialGrants), calls = []
  const imports = {
    vue,
    'vue-router': {useRoute: () => ({query: {}, path: '/resources/devices/list'}), useRouter: () => ({})},
    'vue-i18n': {useI18n: () => ({t: key => key})},
    'ant-design-vue': {Modal: {}},
    '@jetlinks-web-core/store': {useMenuStore: () => ({}), useAuthStore: () => ({hasPermission: key => grants.value.includes(key)})},
    '@jetlinks-web/utils': {onlyMessage() {}},
    '../../../../api/device': {}, '../../../../api/instance': {},
    '../../../../api/deviceGroup': {bindDeviceGroupDevices_api: async (...args) => calls.push(['group', ...args])},
    '../hooks/iotDeviceAreaGroupBindings': {reassignIotDevicesToArea: async (...args) => calls.push(['area', ...args])},
    '../hooks/useIotDeviceRouting': {resolveIotProjectId: () => 'project'},
    '@jetlinks-web-core/utils/consts': {isSaaS: false},
  }
  const js = ts.transpileModule(actionsSource, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText
  const module = {exports: {}}
  new Function('require', 'module', 'exports', js)(id => {
    if (!(id in imports)) throw new Error(`Unexpected dependency ${id}`)
    return imports[id]
  }, module, module.exports)
  const scope = vue.effectScope()
  const state = scope.run(() => module.exports.useUnifiedDeviceActions(
    vue.ref([{id: 'device', name: 'Device'}]), vue.ref(['device']), () => calls.push(['clear']), () => undefined,
    () => calls.push(['refresh']), vue.ref(), action => makePermissionCheck(grants.value)(action),
  ))
  return {grants, calls, state, stop: () => scope.stop()}
}

test('batch area/group assignment requires update; unrelated grants cannot submit', async () => {
  for (const grant of ['view', 'add', 'delete', 'enable', 'action', 'export', 'import']) {
    const f = await assignmentFixture([`iot-user-device-list:${grant}`])
    try {
      f.state.assignAreaOpen.value = true
      f.state.assignGroupOpen.value = true
      await f.state.assignArea('area')
      await f.state.assignGroup({id: 'group'})
      assert.deepEqual(f.calls, [], grant)
    } finally {f.stop()}
  }
})

test('authorized assignments preserve selected device IDs and reject revoked grants', async () => {
  const f = await assignmentFixture(['iot-user-device-list:update'])
  try {
    await f.state.assignArea('area')
    await f.state.assignGroup({id: 'group'})
    assert.deepEqual(f.calls.filter(([action]) => ['area', 'group'].includes(action)), [
      ['area', 'area', [{id: 'device', name: 'Device', productName: undefined, state: undefined}]],
      ['group', 'group', ['device']],
    ])
    f.calls.length = 0
    f.state.assignAreaOpen.value = true
    f.state.assignGroupOpen.value = true
    f.grants.value = []
    await f.state.assignArea('other-area')
    await f.state.assignGroup({id: 'other-group'})
    assert.deepEqual(f.calls, [])
  } finally {f.stop()}
})
