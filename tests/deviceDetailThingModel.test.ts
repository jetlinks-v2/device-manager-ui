import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collectOverviewPropertyKeys,
  isKeyMetricProperty,
  resolveEffectiveDeviceThingModel,
} from '../utils/deviceThingModel.ts'

test('writes and reads the canonical key metric marker while accepting historical markers', () => {
  assert.equal(isKeyMetricProperty({ expands: { isKeyMetric: true } }), true)
  assert.equal(isKeyMetricProperty({ expands: { focus: 'true' } }), true)
  assert.equal(isKeyMetricProperty({ expands: { isKeyMetric: false } }), false)
})

test('returns an empty overview when no effective property is marked as key', () => {
  assert.deepEqual(collectOverviewPropertyKeys({ properties: [{ id: 'temperature' }] }), [])
})

test('uses inherited product metadata until a device has independent metadata', () => {
  const productMetadata = { properties: [{ id: 'temperature', expands: { isKeyMetric: true } }] }
  const deviceMetadata = { properties: [{ id: 'pressure', expands: { isKeyMetric: true } }] }

  assert.deepEqual(
    collectOverviewPropertyKeys(resolveEffectiveDeviceThingModel({ productMetadata, deviceMetadata, independentMetadata: false })),
    ['temperature'],
  )
  assert.deepEqual(
    collectOverviewPropertyKeys(resolveEffectiveDeviceThingModel({ productMetadata, deviceMetadata, independentMetadata: true })),
    ['pressure'],
  )
})

test('returns to product key metrics after an independent device model is reset', () => {
  const productMetadata = { properties: [{ id: 'temperature', expands: { isKeyMetric: true } }] }
  const staleDeviceMetadata = { properties: [{ id: 'pressure', expands: { isKeyMetric: true } }] }

  assert.deepEqual(
    collectOverviewPropertyKeys(resolveEffectiveDeviceThingModel({
      productMetadata,
      deviceMetadata: staleDeviceMetadata,
      independentMetadata: false,
    })),
    ['temperature'],
  )
})
