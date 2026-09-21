import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const sourcePath = new URL('../api/spaceArea.ts', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath.pathname, source, ts.ScriptTarget.Latest, true)
const deviceScopePath = new URL('../deviceScope.ts', import.meta.url)
const unifiedListPath = new URL('../views/device/list/unified/index.vue', import.meta.url)
const deviceScopeSource = await readFile(deviceScopePath, 'utf8')
const unifiedListSource = await readFile(unifiedListPath, 'utf8')

function exportedFunctionBody(name) {
  const statement = sourceFile.statements.find((item) => (
    ts.isVariableStatement(item)
    && item.declarationList.declarations.some((declaration) => declaration.name.getText(sourceFile) === name)
  ))
  assert.ok(statement, `Production export ${name} exists`)
  return statement.getText(sourceFile)
}

test('device area support probe accepts the standard command response envelope', () => {
  const probe = exportedFunctionBody('existsDeviceSpaceAreaSupport_api')
  assert.match(probe, /command-supports\/service\/\$\{DEVICE_SPACE_AREA_SERVICE_ID\}\/exists/)
  assert.match(probe, /unwrapResult<boolean>\(response\)\s*===\s*true/)
  assert.match(source, /const unwrapResult = <T>\(response: ApiResponse<T> \| T\)/)
})

test('a failed probe remains unknown and is retried instead of being cached as no space service', () => {
  const probe = exportedFunctionBody('existsDeviceSpaceAreaSupport_api')

  assert.match(source, /export type DeviceSpaceAreaSupport = boolean \| undefined/)
  assert.match(probe, /deviceSpaceAreaSupportPromise\s*=\s*undefined/)
  assert.match(probe, /return undefined/)
  assert.doesNotMatch(probe, /\.catch\(\(\)\s*=>\s*false\)/)
})

test('the unified list hides area operations only after space service absence is confirmed', () => {
  assert.match(deviceScopeSource, /existsDeviceSpaceAreaSupport_api\(\)/)
  assert.match(deviceScopeSource, /showArea:\s*spaceAreaSupported\.value\s*!==\s*false/)
  assert.match(deviceScopeSource, /if \(spaceAreaSupported\.value !== true\) return \[\]/)
  assert.match(deviceScopeSource, /useIotDeviceScopeCounts\([\s\S]*spaceAreaSupported\)/)
  assert.match(unifiedListSource, /v-if="spaceAreaSupported !== false"/)
  assert.match(unifiedListSource, /spaceAreaSupported !== true/)
})
