import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const menuTree = JSON.parse(await readFile(new URL('../baseMenu.json', import.meta.url), 'utf8'))

const findMenuByCode = (menus, code) => {
  for (const menu of menus) {
    if (menu.code === code) return menu
    const found = findMenuByCode(menu.children || [], code)
    if (found) return found
  }
}

test('device list grants alarm configuration query with an explicit data-access type', () => {
  const deviceList = findMenuByCode(menuTree, 'iot-user-device-list')

  assert.ok(deviceList)
  assert.equal(deviceList.supportDataAccess, true)
  assert.ok(deviceList.assetTypes.includes('alarmConfig'))
  assert.deepEqual(
    deviceList.permissions.find(({ permission }) => permission === 'alarm-config')?.actions,
    ['query'],
  )
})
