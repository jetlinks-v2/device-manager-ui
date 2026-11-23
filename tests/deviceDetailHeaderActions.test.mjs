import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const header = await readFile(new URL('../views/device/list/components/device-detail/IotDeviceDetailHeader.vue', import.meta.url), 'utf8')
const state = await readFile(new URL('../views/device/list/hooks/useIotDeviceDetailView.ts', import.meta.url), 'utf8')

test('device detail header copies the device ID and opens the linked product detail', () => {
  assert.match(header, /@click="copyDeviceId"/)
  assert.match(header, /@click="openProductDetail"/)
  assert.match(state, /await toClipboard\(device\.value\.id\)/)
  assert.match(state, /deviceMenu\.jumpPage\('device\/Product\/Detail', \{ params: \{ id: productId \} \}\)/)
})


test('ordinary device summary fields opt into merged tooltips and keep the complete values', () => {
  for (const [kind, value] of [
    ['product', 'productNameText'], ['category', 'parentDeviceName'], ['space', 'regionFullText'],
    ['group', 'businessGroupFullText'], ['time', 'lastSeenText'],
  ]) {
    assert.match(header, new RegExp(`<DetailMetaItem[^>]+kind="${kind}" merged-tooltip[^>]+:tooltip="${value}"`))
  }
  assert.doesNotMatch(header, /kind="id" merged-tooltip/)
  assert.match(header, /@click="openParentDevice"/)
  assert.match(header, /:disabled="!canOpenProductDetail"/)
})
