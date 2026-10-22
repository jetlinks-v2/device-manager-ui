import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [types, api, hook, drawer, actions, list] = await Promise.all([
  readFile(new URL('../api/device-library/types.ts', import.meta.url), 'utf8'),
  readFile(new URL('../api/device.ts', import.meta.url), 'utf8'),
  readFile(new URL('../views/device/list/hooks/useIotAddDeviceDrawer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../views/device/list/components/IotAddDeviceDrawer.vue', import.meta.url), 'utf8'),
  readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8'),
  readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8'),
])

test('restricted device creation keeps access-provider filters in the product query', () => {
  assert.match(types, /accessProviders\?: string\[\]/)
  assert.match(api, /const accessProviders = \[\.\.\.new Set\(input\.accessProviders\?\.filter\(Boolean\) \?\? \[\]\)\]/)
  assert.match(api, /accessProviders\.length[\s\S]*?column: 'accessProvider', termType: 'in', value: accessProviders/)
  assert.match(hook, /accessProviders: props\.productFilter\?\.accessProviders/)
  assert.match(hook, /const createProductFilterTerms = \(\): DeviceQueryTerm\[\] =>/)
  assert.match(hook, /productFilterTerms\.value = createProductFilterTerms\(\)/)
})

test('product-only creation never exposes the device-library source', () => {
  assert.match(drawer, /productFilter\?: DeviceCreateDrawerOptions/)
  assert.match(hook, /const isProductOnly = computed\(\(\) => props\.productFilter\?\.productOnly === true\)/)
  assert.match(hook, /const isLibraryAvailable = computed\(\(\) => !isProductOnly\.value/)
  assert.match(hook, /if \(isProductOnly\.value\) \{[\s\S]*?void loadProductCandidates\(true\)[\s\S]*?return[\s\S]*?\}/)
})

test('provider drawer creation is explicit and tab changes do not open it', () => {
  assert.match(actions, /action !== 'create'\) return/)
  assert.match(actions, /'drawer' in provider\.create[\s\S]*?createDrawerOptions\.value = provider\.create\.drawer[\s\S]*?editOpen\.value = true/)
  assert.match(actions, /'drawer' in entry[\s\S]*?createDrawerOptions\.value = entry\.drawer[\s\S]*?editOpen\.value = true/)
  assert.match(list, /:product-filter="createDrawerOptions"/)
})
