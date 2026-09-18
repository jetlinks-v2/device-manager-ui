import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('..', import.meta.url))
const drawerSource = readFileSync(resolve(directory, 'views/device/list/components/IotAddDeviceDrawer.vue'), 'utf8')
const extensionSource = readFileSync(resolve(directory, 'deviceCreationExtension.ts'), 'utf8')
const mediaSaveSource = readFileSync(resolve(directory, '../jetlinks-media-ui/views/Device/Save/index.vue'), 'utf8')
const mediaProviderSource = readFileSync(resolve(directory, '../jetlinks-media-ui/deviceListProvider.ts'), 'utf8')
const basicFieldsSource = readFileSync(resolve(directory, 'views/device/list/components/IotDeviceBasicFields.vue'), 'utf8')
const productStepSource = readFileSync(resolve(directory, 'views/device/list/components/IotAddDeviceProductStep.vue'), 'utf8')
const searchBarSource = readFileSync(resolve(directory, 'views/device/list/components/IotDeviceAssetSearchBar.vue'), 'utf8')

test('generic device drawer delegates specialized creation through a public extension contract', () => {
  assert.match(extensionSource, /matches:\s*\(accessProvider\?: string\)/)
  assert.match(drawerSource, /getResource\(moduleId, 'deviceCreationExtensions'\)/)
  assert.match(drawerSource, /selectedProductKey, selectedProduct, selectedTemplateKey/)
  assert.match(drawerSource, /bindCreatedDevice\(payload.deviceId, selectedProduct.value\)/)
  assert.doesNotMatch(drawerSource, /media\/device|fixed-media|gb28181-2016|media-plugin|onvif/)
})

test('embedded media creation keeps common fields and the dialog footer in the device module', () => {
  assert.match(drawerSource, /IotDeviceBasicFields[\s\S]*stack-fields[\s\S]*:on-area-change="onAreaChange"/)
  assert.match(drawerSource, /creationExtensionRef\.value\?\.submit\?\.\(\)/)
  assert.match(mediaSaveSource, /v-if="!embedded"[\s\S]*name="channel"/)
  assert.match(mediaSaveSource, /v-if="!embedded"[\s\S]*label="ID"/)
  assert.match(mediaSaveSource, /v-if="!embedded"[\s\S]*:span="12"/)
  assert.match(mediaSaveSource, /v-if="embedded"[\s\S]*label="ID"[\s\S]*required:\s*formData\.channel === 'gb28181-2016'/)
  assert.match(drawerSource, /:show-group="false"[\s\S]*:show-description="false"[\s\S]*creationExtensionRef/)
  assert.match(drawerSource, /#after-configuration[\s\S]*:show-area="true"[\s\S]*:show-group="true"[\s\S]*:show-description="true"/)
  assert.match(drawerSource, /#identity-icon[\s\S]*#identity-name[\s\S]*#after-configuration/)
  assert.match(mediaSaveSource, /name="identity-icon"[\s\S]*name="identity-name"[\s\S]*name="after-configuration"/)
  assert.match(mediaSaveSource, /embedded \? 'div' : 'a-card'/)
})

test('video deletion follows the unified disabled-only device rule', () => {
  assert.match(mediaProviderSource, /canDelete:\s*device\s*=>\s*device\.connectionStatus\s*===\s*'disabled'/)
})

test('device basics expose group by default and restore product search conditions after changing product', () => {
  assert.match(basicFieldsSource, /v-if="props\.showGroup !== false"/)
  assert.match(drawerSource, /:filter-terms="productFilterTerms"/)
  assert.match(productStepSource, /watch\(\(\) => props\.filterTerms/)
  assert.match(productStepSource, /type: 'select'[\s\S]*options: async \(\) => accessConfigTypeFilter/)
})

test('device icons reuse product-style upload and searches preserve raw editor terms', () => {
  assert.match(basicFieldsSource, /<pro-upload v-model="props\.form\.imageUrl"/)
  assert.match(basicFieldsSource, /props\.showName !== false[\s\S]*props\.showArea !== false[\s\S]*props\.showGroup !== false/)
  assert.match(basicFieldsSource, /showName: true,[\s\S]*showArea: true,[\s\S]*showGroup: true,[\s\S]*showDescription: true/)
  assert.match(basicFieldsSource, /props\.stackFields/)
  assert.doesNotMatch(basicFieldsSource, /presetIcon|MARKETPLACE_FONT_ICON_TYPES|a-tab-pane key="preset"/)
  assert.match(searchBarSource, /:modelValue="editorTerms"/)
  assert.match(searchBarSource, /emit\('search', \{ terms: latestRawTerms\.value \}\)/)
  assert.match(searchBarSource, /value\.startsWith\('%'\) && value\.endsWith\('%'\)/)
})
