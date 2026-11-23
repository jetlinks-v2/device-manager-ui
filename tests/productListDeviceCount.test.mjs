import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const productListPath = new URL('../views/device/Product/index.vue', import.meta.url)
const productListSource = await readFile(productListPath, 'utf8')
const productListRequest = await readFile(new URL('../views/device/Product/services/productListRequest.ts', import.meta.url), 'utf8')

test('product list loads device counts through the existing product detail query', () => {
  assert.match(productListSource, /:request="queryProductList"/)
  assert.match(productListRequest, /await queryDetailList\(params, config\)/)
  assert.match(productListSource, /dataIndex: "deviceCount"/)
})

test('product device count drill-down preserves the unified device list filter contract', () => {
  assert.match(productListSource, /menuStory\.jumpPage\('iot-user-device-list'/)
  assert.match(productListSource, /encodeConditionFilterQuery\(/)
  assert.match(productListSource, /column: 'productId', termType: 'eq', value: productId/)
  assert.match(productListSource, /:disabled="!canViewDevices \|\| Number\(slotProps\.deviceCount \?\? 0\) === 0"/)
})
