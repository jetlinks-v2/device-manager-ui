import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const tabSource = await readFile(new URL('../views/device/list/components/device-detail/IotDeviceInvalidDataTab.vue', import.meta.url), 'utf8')
const hookSource = await readFile(new URL('../views/device/list/hooks/useIotDeviceInvalidData.ts', import.meta.url), 'utf8')

test('invalid data uses the shared condition filter instead of page-local search controls', () => {
  assert.match(tabSource, /<ConditionFilter/)
  assert.match(tabSource, /@change="handleSearch"/)
  assert.doesNotMatch(tabSource, /<a-range-picker|invalid-filters__value|resetSearch/)
})

test('invalid data keeps the device boundary while building conditions from the shared filter model', () => {
  assert.match(hookSource, /filterCommonFields = \['description', 'value'\]/)
  assert.match(hookSource, /column: 'thingId', value: deviceId, termType: 'eq'/)
  assert.match(hookSource, /\.\.\.submittedTerms\.value/)
  assert.doesNotMatch(hookSource, /buildQueryFilter/)
})
