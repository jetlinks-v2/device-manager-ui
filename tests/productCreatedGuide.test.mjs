import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const hookSource = await readFile(new URL('../views/device/Product/hooks/useProductCreatedGuide.ts', import.meta.url), 'utf8')
const dialogSource = await readFile(new URL('../views/device/Product/DialogTips/index.vue', import.meta.url), 'utf8')
const detailSource = await readFile(new URL('../views/device/Product/Detail/index.vue', import.meta.url), 'utf8')
const saveSource = await readFile(new URL('../views/device/Product/Save/index.vue', import.meta.url), 'utf8')

test('keeps product onboarding in the current tab until the user skips or selects a device handoff', () => {
  assert.match(hookSource, /const storagePrefix = 'product-created-guide:'/)
  assert.match(hookSource, /const activeStorageKey = `\$\{storagePrefix\}active`/)
  assert.match(hookSource, /function resumePending\(\)[\s\S]*readActiveProductId/)
  assert.match(hookSource, /function skip\(\) \{[\s\S]*clearProductCreatedGuide/)
  assert.match(hookSource, /function addDevice\(\) \{[\s\S]*clearProductCreatedGuide[\s\S]*jumpPage\('iot-user-device-list'/)
  assert.match(hookSource, /function batchImport\(\) \{[\s\S]*clearProductCreatedGuide[\s\S]*jumpPage\('iot-user-device-list'/)
})

test('resumes deferred onboarding from the product list and enables products without a detail-page detour', async () => {
  const productIndexSource = await readFile(new URL('../views/device/Product/index.vue', import.meta.url), 'utf8')
  assert.match(productIndexSource, /onMounted\(\(\) => \{[\s\S]*resumePendingProductGuide/)
  assert.match(productIndexSource, /onActivated\(\(\) => \{[\s\S]*resumePendingProductGuide/)
  assert.match(hookSource, /async function enableProduct\(\)[\s\S]*await _deploy\(state\.value\.id\)[\s\S]*updateProductCreatedGuide\(state\.value\.id, \{ enabled: true \}\)/)
  assert.doesNotMatch(hookSource, /async function enableProduct\([\s\S]*jumpPage\('device\/Product\/Detail'/)
})

test('shows every onboarding step and explains disabled prerequisites', () => {
  assert.match(dialogSource, /key: 'metadata'/)
  assert.match(dialogSource, /key: 'enable'/)
  assert.match(dialogSource, /:disabled="!step.ready \|\| step.complete"/)
  assert.match(dialogSource, /product-created-guide__step-content :deep\(\.ant-btn\)[\s\S]*width: 5\.25rem/)
  assert.match(dialogSource, /@cancel="skip"/)
})

test('only prompts from the explicit newly-created-product detail flow', () => {
  assert.match(detailSource, /route\.query\.onboarding === 'product-created'/)
  assert.match(detailSource, /const activeTab = ref<ProductDetailTabKey>\(route\.query\.tab === 'Metadata' \? 'Metadata' : 'Device'\)/)
  assert.match(detailSource, /v-if="tabs\[activeTab\] && productStore\.current\?\.id"/)
  assert.match(detailSource, /syncActiveTab\(route\.query\.tab \?\? routerParams\.params\?\.value\.tab\)/)
  assert.match(detailSource, /watch\(\(\) => route\.query\.tab, \(tab\) => \{[\s\S]*syncActiveTab\(tab\)/)
  assert.match(detailSource, /EventEmitter\.subscribe\(\['ProductAccessConfigured'\]/)
  assert.match(detailSource, /EventEmitter\.subscribe\(\['MetadataChanged'\]/)
})

test('confirms product enablement before the guide invokes the enable API', () => {
  assert.match(saveSource, /import \{ Form, Modal \} from 'ant-design-vue';/)
  assert.match(saveSource, /const handleEnableCreatedProduct = \(\) => \{[\s\S]*Modal\.confirm\([\s\S]*onOk: async \(\) => \{[\s\S]*await enableCreatedProduct\(\)/)
})

test('guided device creation enables the new device before opening its access configuration', async () => {
  const actionsSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8')
  const listSource = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
  assert.match(actionsSource, /productOnboardingDeviceCreation\.value = onboarding === 'product-created'/)
  assert.match(actionsSource, /await deployDevice_api\(deviceId\)[\s\S]*buildIotDeviceDetailPath\(projectId\.value, deviceId, \{ tab: 'access', sub: 'connection' \}, route\)/)
  assert.match(listSource, /productOnboardingDeviceCreation\.value && payload\?\.deviceId/)
  assert.match(listSource, /IotDeviceList\.onboarding\.enableDevice\.title/)
})

test('guided batch import waits for the dialog and selected product before advancing', async () => {
  const actionsSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceActions.ts', import.meta.url), 'utf8')
  const listSource = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
  const importModalSource = await readFile(new URL('../views/device/Instance/Import/modal.vue', import.meta.url), 'utf8')
  const importHookSource = await readFile(new URL('../views/device/Instance/Import/hooks/useInitialDeviceImportProduct.ts', import.meta.url), 'utf8')

  assert.match(actionsSource, /await new Promise<void>\(\(resolve\) => window\.setTimeout\(resolve, 350\)\)/)
  assert.match(actionsSource, /productOnboardingDeviceImport\.value = onboarding === 'product-created'/)
  assert.match(listSource, /:auto-advance-initial-product="productOnboardingDeviceImport"/)
  assert.match(importModalSource, /function advanceInitialProduct\(\)[\s\S]*props\.autoAdvanceInitialProduct[\s\S]*next\(\)/)
  assert.match(importHookSource, /window\.setTimeout\(resolve, 250\)/)
  assert.match(importHookSource, /watch\(initialProductId, \(productId\) => \{[\s\S]*void load\(productId\)[\s\S]*immediate: true/)
  assert.match(importHookSource, /window\.setTimeout\(resolve, 450\)[\s\S]*advance\(\)/)
})
