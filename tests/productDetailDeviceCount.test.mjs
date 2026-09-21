import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const productSummaryPath = new URL('../views/device/Product/Detail/components/ProductDetailSummary.vue', import.meta.url)
const productSummarySource = await readFile(productSummaryPath, 'utf8')

test('does not expose a device list link when the product has no devices', () => {
  assert.match(productSummarySource, /v-if="canViewDevices && hasDevices"/)
  assert.match(productSummarySource, /Number\(props\.product\.count \?\? 0\) > 0/)
})
