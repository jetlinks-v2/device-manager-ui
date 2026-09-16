import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const sourcePath = new URL('../api/device-library/index.ts', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath.pathname, source, ts.ScriptTarget.Latest, true)
const addDrawerSource = await readFile(new URL('../views/device/list/hooks/useIotAddDeviceDrawer.ts', import.meta.url), 'utf8')
const bizKeyPickerSource = await readFile(new URL('../views/link/AccessConfig/components/DeviceLibraryBizKeyPicker.vue', import.meta.url), 'utf8')

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
    ['queryDeviceLibraryTemplates_api', 'hasMore: false', '/marketplace/'],
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

test('gateway business identifier is only shown after marketplace support is confirmed', () => {
  assert.match(bizKeyPickerSource, /available\.value = await probeDeviceLibraryCapability_api\(\)/)
  assert.match(bizKeyPickerSource, /if \(available\.value\) void loadTags\(\)/)
  assert.doesNotMatch(bizKeyPickerSource, /await probeDeviceLibraryCapability_api\(\)\s*\n\s*available\.value = true/)
})
