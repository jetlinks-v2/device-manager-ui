import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const actionsSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8')

test('batch enable and disable are available whenever devices are selected', () => {
  const batchActions = source.match(/<template v-else>[\s\S]*?<\/template>/)?.[0] || ''
  assert.match(batchActions, /batchToggle\('enable'\)/)
  assert.match(batchActions, /batchToggle\('disable'\)/)
  assert.doesNotMatch(batchActions, /selected\.every\(device => allowed\(device, '(enable|disable)'\)\)/)
  assert.match(batchActions, /:disabled="!selectedIds\.length \|\| busy"/)
})

test('shows normal-device enable, disable, and delete actions through the list-menu permission', () => {
  assert.match(source, /<table-actions>[\s\S]*allowed\(record, record\.connectionStatus === 'disabled' \? 'enable' : 'disable'\)[\s\S]*allowed\(record, 'delete'\)[\s\S]*<\/table-actions>/)
  assert.match(actionsSource, /if \(provider\.id === 'device'\) return menu\.hasMenu\(provider\.menuCode\)/)
})
