import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'

const sourcePath = new URL('../views/device/list/hooks/useIotDeviceRouting.ts', import.meta.url)
const source = (await readFile(sourcePath, 'utf8')).replace(
  "import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'",
  "const getProjectIdFromLocation = () => ''",
)
const { code } = await transform(source, { loader: 'ts', format: 'cjs' })
const module = { exports: {} }
vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams })

const { buildIotDeviceDetailPath } = module.exports

test('keeps the resource-center device-list entry when opening a detail page', () => {
  assert.equal(
    buildIotDeviceDetailPath('project-1', 'device/1', undefined, { path: '/resources/devices/list' }),
    '/resources/devices/list/Detail/device%2F1',
  )
})

test('keeps the hidden device submenu when it is the active entry', () => {
  assert.equal(
    buildIotDeviceDetailPath('project-1', 'device-1', undefined, { path: '/resources/devices/list/device' }),
    '/resources/devices/list/device/Detail/device-1',
  )
})
