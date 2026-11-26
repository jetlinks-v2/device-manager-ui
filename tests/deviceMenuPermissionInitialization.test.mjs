import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const tree = JSON.parse(readFileSync(new URL('../baseMenu.json', import.meta.url), 'utf8'))
const flatten = menus => menus.flatMap(menu => [menu, ...flatten(menu.children ?? [])])
const menus = new Map(flatten(tree).map(menu => [menu.id, menu]))
const actions = (entry, resource) => entry.permissions.find(p => p.permission === resource)?.actions

for (const id of ['access-center-device-list', 'iot-device-alarm', 'alarm-center-device-alarm']) {
  test(`${id} grants only query on devices and products at menu level`, () => {
    const menu = menus.get(id)
    assert.deepEqual(actions(menu, 'device-instance'), ['query'])
    assert.deepEqual(actions(menu, 'device-product'), ['query'])
  })
}

test('device mutation and import/export permissions remain on operation buttons', () => {
  const list = menus.get('access-center-device-list')
  const expected = {
    view: ['query'],
    add: ['query', 'save'],
    update: ['save'],
    delete: ['query', 'delete'],
    enable: ['query', 'enable', 'save'],
    action: ['query', 'save', 'enable', 'disable'],
    import: ['query', 'import'],
    export: ['query', 'export'],
  }
  for (const [id, expectedActions] of Object.entries(expected)) {
    const button = list.buttons.find(button => button.id === id)
    assert.deepEqual(actions(button, 'device-instance'), expectedActions, id)
    assert.ok(!actions(button, 'device-product')?.includes('save'), id)
  }
})
