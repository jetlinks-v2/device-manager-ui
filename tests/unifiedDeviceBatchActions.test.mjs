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
  assert.match(source, /canDeviceBatchAction\('add'\).*type="primary"/)
  assert.match(source, /v-if="canDeviceBatchAction\('syncStatus'\)" key="syncStatus"/)
  for (const action of ['enable', 'disable']) {
    assert.ok(source.includes(`v-if="canDeviceBatchAction('enable')" :disabled="!selectedIds.length || busy" @click="batchToggle('${action}')"`))
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
