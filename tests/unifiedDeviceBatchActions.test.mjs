import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = (await Promise.all(['index.vue', 'useUnifiedDeviceWorkspace.ts', 'UnifiedDeviceResults.vue'].map(file => readFile(new URL('../views/device/list/unified/' + file, import.meta.url), 'utf8')))).join('\n')
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

test('state menu retains the existing action permission and confirmation owner', () => {
  assert.match(source, /authStore.hasPermission\(`\$\{deviceMenuCode.value\}:action`\)/)
  assert.match(source, /v-if="model.stateAction.allowed"/)
  assert.match(source, /@toggle="toggle"/)
  assert.match(actionsSource, /Modal.confirm\(\{ title: t\(enable/)
  assert.match(actionsSource, /return menu\.hasMenu\(provider\.menuCode\)/)
  assert.doesNotMatch(actionsSource, /auth\.hasPermission\(`\$\{provider\.menuCode\}:\$\{action\}`\)/)
})

test('counts all devices without applying category access-provider terms', () => {
  assert.match(listSource, /countDevice_api\(\{\}\)\.then\(value => \['all', value\] as const\)/)
  assert.doesNotMatch(listSource, /allTerms/)
})
