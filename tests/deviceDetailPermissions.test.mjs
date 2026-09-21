import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'

const routingSourcePath = new URL('../views/device/list/hooks/useIotDeviceRouting.ts', import.meta.url)
const permissionSourcePath = new URL('../views/device/list/hooks/useDeviceDetailPermissions.ts', import.meta.url)
const routingSource = (await readFile(routingSourcePath, 'utf8')).replace(
  "import { getProjectIdFromLocation } from '@jetlinks-web-core/utils/project-runtime'",
  "const getProjectIdFromLocation = () => ''",
)
const permissionSource = (await readFile(permissionSourcePath, 'utf8'))
  .replace("import type { Ref } from 'vue'\n", '')
  .replace("import { useRoute } from 'vue-router'", 'const useRoute = () => globalThis.__route')
  .replace(
    "import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'",
    "const useAuthStore = () => ({ hasPermission: globalThis.__hasPermission })\nconst useMenuStore = () => ({ hasMenu: globalThis.__hasMenu })",
  )
  .replace("import { useDeviceListProvider } from './useDeviceListProvider'", 'const useDeviceListProvider = () => ({ value: undefined })')
  .replace("import { getIotDeviceListMenuCode } from './useIotDeviceRouting'\n", '')
  .replace("import type { IotDevice } from '../types'\n", '')

const { code } = await transform(`${routingSource}\n${permissionSource}\nmodule.exports = { useDeviceDetailPermissions }`, {
  loader: 'ts',
  format: 'cjs',
})
const module = { exports: {} }
const context = { module, exports: module.exports, __route: {}, __hasPermission: () => false, __hasMenu: () => false }
vm.runInNewContext(code, context)
const { useDeviceDetailPermissions } = module.exports

test('uses the resource-center menu update button for device detail writes', () => {
  context.__route = { path: '/resources/devices/list/Detail/device-1' }
  context.__hasPermission = code => code === 'iot-user-device-list:update'
  context.__hasMenu = () => false

  assert.equal(useDeviceDetailPermissions({ value: { id: 'device-1' } })('update'), true)
})

test('does not grant a resource-center detail write without its update button', () => {
  context.__route = { path: '/resources/devices/list/Detail/device-1' }
  context.__hasPermission = () => false
  context.__hasMenu = () => false

  assert.equal(useDeviceDetailPermissions({ value: { id: 'device-1' } })('update'), false)
})

test('keeps the old IoT menu visibility fallback for detail writes', () => {
  context.__route = { path: '/iot-center/device/list/Detail/device-1' }
  context.__hasPermission = () => false
  context.__hasMenu = code => code === 'iot-user/device/list'

  assert.equal(useDeviceDetailPermissions({ value: { id: 'device-1' } })('update'), true)
})
