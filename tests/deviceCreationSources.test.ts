import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectProductCategoryScopeIds,
  hasAvailableStorePolicy,
} from '../utils/deviceCreationSources.ts'

test('includes all descendants when a product category is selected', () => {
  const tree = [{ id: 'root', children: [{ id: 'child', children: [{ id: 'leaf' }] }] }]
  assert.deepEqual(collectProductCategoryScopeIds(tree, 'root'), ['root', 'child', 'leaf'])
  assert.deepEqual(collectProductCategoryScopeIds(tree, 'missing'), ['missing'])
})

test('rejects an empty or stale product storage policy before device creation', () => {
  const policies = [{ id: 'default-row' }, { id: 'timescale' }]
  assert.equal(hasAvailableStorePolicy('timescale', policies), true)
  assert.equal(hasAvailableStorePolicy('missing', policies), false)
  assert.equal(hasAvailableStorePolicy('', policies), false)
})
