import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const sourcePath = new URL('../api/device-library/index.ts', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath.pathname, source, ts.ScriptTarget.Latest, true)
const addDrawerSource = await readFile(new URL('../views/device/list/hooks/useIotAddDeviceDrawer.ts', import.meta.url), 'utf8')
const bizKeyPickerSource = await readFile(new URL('../views/link/AccessConfig/components/DeviceLibraryBizKeyPicker.vue', import.meta.url), 'utf8')
const networkAccessConfigSource = await readFile(new URL('../views/link/AccessConfig/components/Network/index.vue', import.meta.url), 'utf8')
const templateOptionSource = await readFile(new URL('../views/device/list/hooks/iotAddDeviceProductOptions.ts', import.meta.url), 'utf8')
const libraryCardSource = await readFile(new URL('../views/device/list/hooks/device-library/useDeviceLibraryCard.ts', import.meta.url), 'utf8')
const librarySelectionSource = await readFile(new URL('../views/device/list/hooks/device-library/useDeviceLibrarySelection.ts', import.meta.url), 'utf8')

function exportedFunctionBody(name) {
  const statement = sourceFile.statements.find((item) => (
    ts.isVariableStatement(item)
    && item.declarationList.declarations.some((declaration) => declaration.name.getText(sourceFile) === name)
  ))
  assert.ok(statement, `Production export ${name} exists`)
  return statement.getText(sourceFile)
}

test('device library uses the marketplace command service as its availability probe', () => {
  const probe = exportedFunctionBody('probeDeviceLibraryCapability_api')
  assert.match(probe, /command-supports\/service\/\$\{MARKETPLACE_SERVICE_ID\}\/exists/)
  assert.match(probe, /hiddenError:\s*true/)
  assert.match(probe, /unwrapResult<boolean>\(response\)\s*===\s*true/)
})

test('marketplace reads are short-circuited before their marketplace request', () => {
  const expectations = [
    ['queryProjectInstalledDeviceLibrary_api', 'new Map()', '/marketplace/'],
    ['queryDeviceLibraryTags_api', '[]', 'queryMarketplaceTagClassifiers()'],
    ['queryDeviceLibraryProductFilterOptions_api', '[]', '/marketplace/'],
    ['queryDeviceLibraryTemplates_api', 'total: 0', '/marketplace/'],
    ['queryDeviceLibraryTemplateById_api', 'null', '/marketplace/'],
  ]

  expectations.forEach(([name, fallback, marketplaceCall]) => {
    const body = exportedFunctionBody(name)
    const guardIndex = body.indexOf('await probeDeviceLibraryCapability_api()')
    const marketplaceIndex = body.indexOf(marketplaceCall)
    assert.ok(guardIndex >= 0, `${name} checks marketplace support`)
    assert.ok(marketplaceIndex > guardIndex, `${name} probes before accessing marketplace`)
    assert.ok(body.slice(guardIndex, marketplaceIndex).includes(fallback), `${name} returns its private-deployment fallback`)
  })
})

test('a missing marketplace service keeps device creation on project products', () => {
  assert.match(addDrawerSource, /const available = await probeDeviceLibraryCapability_api\(\)/)
  assert.match(addDrawerSource, /if \(!available\) \{[\s\S]*?creationSource\.value = 'product'[\s\S]*?loadProductCandidates\(true\)/)
  assert.match(addDrawerSource, /creationSource\.value = 'product'; marketplaceCapability\.value = 'checking'/)
})

test('gateway business identifier belongs to the parent configuration instead of composite children', () => {
  assert.match(bizKeyPickerSource, /const isCompositeChild = computed\(\(\) => Boolean\(route\.query\.provider\)\)/)
  assert.match(bizKeyPickerSource, /<a-form-item v-if="!isCompositeChild"/)
  assert.doesNotMatch(bizKeyPickerSource, /probeDeviceLibraryCapability_api/)
})

test('network gateway submits the current business identifier', () => {
  const saveDataStart = networkAccessConfigSource.indexOf('const saveData = () => {')
  const saveDataEnd = networkAccessConfigSource.indexOf('\nconst next = async () => {', saveDataStart)
  assert.ok(saveDataStart >= 0 && saveDataEnd > saveDataStart, 'Network gateway save handler exists')
  const saveDataSource = networkAccessConfigSource.slice(saveDataStart, saveDataEnd)
  assert.match(saveDataSource, /bizKey:\s*formData\.value\.bizKey/)
})

test('device library reads card display type from version resources returned by the marketplace search', () => {
  const templates = exportedFunctionBody('queryDeviceLibraryTemplates_api')
  const templateMapperStart = source.indexOf('const toDeviceLibraryTemplateInput =')
  const templateMapperEnd = source.indexOf('\nconst getMarketplaceCapabilityVersions', templateMapperStart)
  const templateMapper = source.slice(templateMapperStart, templateMapperEnd)
  assert.match(templateMapper, /const resourceMetadata = isRecord\(resource\.metadata\) \? resource\.metadata : \{\}/)
  assert.match(templateMapper, /const versionMetadata = isRecord\(versionResource\?\.metadata\) \? versionResource\.metadata : \{\}/)
  assert.match(source, /deviceType:\s*deviceTypeValueOf\(source\.deviceType\)\s*\|\|\s*'device'/)
  assert.match(source, /displayDeviceType:\s*deviceTypeValueOf\(source\.deviceType\)\s*\|\|\s*undefined/)
  assert.match(templates, /includeVersionResources:\s*true/)
  assert.match(templates, /capabilities\/version\/_query/)
  assert.match(templates, /unwrapPage<MarketplaceResource>\(response, pageIndex, pageSize\)/)
  assert.match(templates, /return toDeviceLibraryTemplateInput\(resource, version, templateResourceOf\(version\), tagLookup\)/)
  assert.doesNotMatch(templates, /resource,\s*template:\s*toDeviceLibraryTemplateInput/)
  assert.doesNotMatch(source, /resolveDeviceLibraryTemplateDisplayType/)
  assert.doesNotMatch(source, /deviceLibraryTemplateDisplayTypeCache/)
  assert.match(templateOptionSource, /deviceType: normalizeDeviceTypeValue\(template\.deviceType\)/)
  assert.match(templateOptionSource, /displayDeviceType: template\.displayDeviceType/)
  assert.match(libraryCardSource, /subtitle: props\.template\.displayDeviceType/)
  assert.doesNotMatch(librarySelectionSource, /if \(!template\.deviceType\) return true/)
})
