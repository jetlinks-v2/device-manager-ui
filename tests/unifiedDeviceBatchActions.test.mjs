import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const actionsSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8')
const listSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')

test('batch enable and disable are available whenever devices are selected', () => {
  const batchActions = source.match(/<template v-else>[\s\S]*?<\/template>/)?.[0] || ''
  assert.match(batchActions, /batchToggle\('enable'\)/)
  assert.match(batchActions, /batchToggle\('disable'\)/)
  assert.doesNotMatch(batchActions, /selected\.every\(device => allowed\(device, '(enable|disable)'\)\)/)
  assert.match(batchActions, /:disabled="!selectedIds\.length \|\| busy"/)
})

test('batch menu accepts the resource-center root, device child, and legacy menu grants', () => {
  assert.match(source, /function canDeviceBatchAction\(action: 'delete' \| 'enable' \| 'export' \| 'import'\)/)
  assert.match(source, /\[deviceMenuCode\.value, 'iot-user-device-list', 'iot-user\/device\/list', 'device\/Instance'\]/)
  assert.match(source, /action === 'enable' \? \['enable', 'action'\] : \[action\]/)
  assert.match(source, /return menu\.hasMenu\(deviceMenuCode\.value\)/)
  assert.match(source, /v-if="!isSaaS && canDeviceBatchAction\('import'\)"/)
  assert.match(source, /v-if="canDeviceBatchAction\('enable'\)" key="activateAll"/)
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
