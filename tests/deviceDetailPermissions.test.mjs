import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test, { beforeEach } from 'node:test'
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
  .replace("import { useDeviceListProvider } from './useDeviceListProvider'", 'const useDeviceListProvider = () => ({ value: globalThis.__provider })')
  .replace("import { getIotDeviceListMenuCode } from './useIotDeviceRouting'\n", '')
  .replace("import type { IotDevice } from '../types'\n", '')

const { code } = await transform(`${routingSource}\n${permissionSource}\nmodule.exports = { useDeviceDetailPermissions }`, {
  loader: 'ts',
  format: 'cjs',
})
const module = { exports: {} }
const context = { module, exports: module.exports, __route: {}, __provider: undefined, __hasPermission: () => false, __hasMenu: () => false }
vm.runInNewContext(code, context)
const { useDeviceDetailPermissions } = module.exports

beforeEach(() => {
  context.__route = { path: '/resources/devices/list/Detail/device-1' }
  context.__provider = undefined
  context.__hasPermission = () => false
  context.__hasMenu = () => false
})

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

test('uses the resource-center action button for device detail enable or disable', () => {
  context.__route = { path: '/resources/devices/list/Detail/device-1' }
  context.__hasPermission = code => code === 'iot-user-device-list:action'
  context.__hasMenu = () => false

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), true)
  assert.equal(canDeviceAction('disable'), true)
})

test('keeps the old IoT menu visibility fallback for detail writes', () => {
  context.__route = { path: '/iot-center/device/list/Detail/device-1' }
  context.__hasPermission = () => false
  context.__hasMenu = code => code === 'iot-user/device/list'

  assert.equal(useDeviceDetailPermissions({ value: { id: 'device-1' } })('update'), true)
})

test('allows video device enable and disable with the device list action permission', () => {
  context.__provider = { id: 'video', menuCode: 'video/resources' }
  context.__hasPermission = code => code === 'iot-user-device-list:action'

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), true)
  assert.equal(canDeviceAction('disable'), true)
})

test('allows video device enable and disable with the existing device instance action permission', () => {
  context.__provider = { id: 'video', menuCode: 'video/resources' }
  context.__hasPermission = code => code === 'device/Instance:action'

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), true)
  assert.equal(canDeviceAction('disable'), true)
})

test('does not grant video device enable or disable from media permissions alone', () => {
  context.__provider = { id: 'video', menuCode: 'video/resources' }
  context.__hasPermission = code => code.startsWith('video/resources:')

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), false)
  assert.equal(canDeviceAction('disable'), false)
})

test('does not grant video device enable or disable from update permissions or resource menu visibility', () => {
  context.__provider = { id: 'video', menuCode: 'video/resources' }
  context.__hasPermission = code => code === 'iot-user-device-list:update' || code === 'video/resources:update'
  context.__hasMenu = () => true

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), false)
  assert.equal(canDeviceAction('disable'), false)
})

test('keeps video update and delete restricted by both device and media button permissions', () => {
  context.__provider = { id: 'video', menuCode: 'video/resources' }
  const permissions = new Set(['iot-user-device-list:update', 'iot-user-device-list:delete'])
  context.__hasPermission = code => permissions.has(code)

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  for (const action of ['update', 'delete']) {
    assert.equal(canDeviceAction(action), false)
    permissions.add(`video/resources:${action}`)
    assert.equal(canDeviceAction(action), true)
    permissions.delete(`iot-user-device-list:${action}`)
    assert.equal(canDeviceAction(action), false)
  }
})

test('keeps gateway enable and disable available through its device list action permission', () => {
  context.__provider = { id: 'gateway', menuCode: 'iot-user-device-list' }
  context.__hasPermission = code => code === 'iot-user-device-list:action'

  const canDeviceAction = useDeviceDetailPermissions({ value: { id: 'device-1' } })
  assert.equal(canDeviceAction('enable'), true)
  assert.equal(canDeviceAction('disable'), true)
})
