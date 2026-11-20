import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageMetadataGroup, isInheritedMetadataGroup, renameMetadataGroup, removeMetadataGroup } from '../components/Metadata/groupPolicy.ts'

const rows = () => [
  { id: 'product', expands: { groupId: 'shared', groupName: 'Product group', isProduct: true }, valueType: { type: 'int' } },
  { id: 'local-in-shared', expands: { groupId: 'shared', groupName: 'Product group' } },
  { id: 'local', expands: { groupId: 'local', groupName: 'Device group', customConfig: { keep: true } }, valueType: { type: 'string' } },
]

test('a group with product members is inherited, including mixed device/product groups', () => {
  assert.equal(isInheritedMetadataGroup(rows(), 'shared', 'device'), true)
  assert.equal(isInheritedMetadataGroup(rows(), 'local', 'device'), false)
  assert.equal(isInheritedMetadataGroup(rows(), 'shared', 'product'), false)
  assert.equal(canManageMetadataGroup({ value: 'shared', inherited: true }, 'device', false), false)
  assert.equal(canManageMetadataGroup({ value: 'local' }, 'device', false), true)
  assert.equal(canManageMetadataGroup({ value: 'local' }, 'device', true), false)
})

test('inherited group edits and deletion are rejected without changing any property', () => {
  const data = rows(), before = structuredClone(data)
  assert.equal(renameMetadataGroup(data, { oldValue: 'shared', value: 'changed', label: 'Changed' }, 'device'), false)
  assert.equal(removeMetadataGroup(data, 'shared', 'device'), data)
  assert.deepEqual(data, before)
})

test('device group renaming preserves property configuration and cannot overwrite an existing group', () => {
  const data = rows(), inherited = structuredClone(data.slice(0, 2))
  assert.equal(renameMetadataGroup(data, { oldValue: 'local', value: 'renamed', label: 'New name' }, 'device'), true)
  assert.deepEqual(data.slice(0, 2), inherited)
  assert.deepEqual(data[2].expands.customConfig, { keep: true })
  assert.equal(data[2].expands.groupName, 'New name')
  assert.equal(renameMetadataGroup(data, { oldValue: 'renamed', value: 'shared', label: 'Overwrite' }, 'device'), false)
})

test('deleting a device group removes its properties without affecting inherited groups', () => {
  const data = rows(), before = structuredClone(data)
  const remaining = removeMetadataGroup(data, 'local', 'device')
  assert.deepEqual(remaining, before.slice(0, 2))
  assert.equal(remaining.some(row => row.id === 'local'), false)
  assert.equal(remaining.some(row => row.expands?.groupId === '_device_ungrouped'), false)
  assert.equal(canManageMetadataGroup({ value: '_device_ungrouped' }, 'device', false), true)
})

test('product group management remains editable in its owning product', () => {
  const data = rows()
  assert.equal(canManageMetadataGroup({ value: 'shared', inherited: true }, 'product', false), true)
  assert.equal(renameMetadataGroup(data, { oldValue: 'shared', value: 'shared', label: 'Product renamed' }, 'product'), true)
  assert.equal(data[0].expands.groupName, 'Product renamed')
})
