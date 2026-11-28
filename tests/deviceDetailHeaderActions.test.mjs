import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as vue from 'vue'
import { createComponentLoader, flush } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

const header = await readFile(new URL('../views/device/list/components/device-detail/IotDeviceDetailHeader.vue', import.meta.url), 'utf8')
const state = await readFile(new URL('../views/device/list/hooks/useIotDeviceDetailView.ts', import.meta.url), 'utf8')

test('device fields and descriptions have local editing entries without a summary edit button', () => {
  assert.match(header, /<DetailMetaItem kind="description"/)
  assert.match(header, /<DeviceDetailDescription/)
  assert.doesNotMatch(header, /meta-editable|@edit-meta=/)
})

test('device detail header copies the device ID and opens the linked product detail', () => {
  assert.match(header, /@copy="copyDeviceId"/)
  assert.match(header, /@click="openProductDetail"/)
  assert.match(state, /await toClipboard\(device\.value\.id\)/)
  assert.match(state, /deviceMenu\.jumpPage\('device\/Product\/Detail', \{ params: \{ id: productId \} \}\)/)
})


test('ordinary device summary fields opt into merged tooltips and keep the complete values', () => {
  for (const [kind, value] of [
    ['product', 'productNameText'], ['category', 'parentDeviceName'],
  ]) {
    assert.match(header, new RegExp(`<DetailMetaItem[^>]+kind="${kind}"[^>]* merged-tooltip[^>]+:tooltip="${value}"`))
  }
  assert.doesNotMatch(header, /kind="id" merged-tooltip/)
  assert.match(header, /@click="openParentDevice"/)
  assert.match(header, /:disabled="!canOpenProductDetail"/)
  assert.doesNotMatch(header, /kind="report"/)
  assert.match(header, /:last-report-at="device.lastReportAt"/)
})

test('parent lookup discards a late previous binding and follows the parent provider route', async t => {
  const pending = new Map(), navigated = []
  const load = createComponentLoader({
    'vue-router': { useRoute: () => ({ params:{}, query:{} }), useRouter: () => ({ push: path => navigated.push(path) }) },
    '@jetlinks-web-core/store': { useMenuStore: () => ({ jumpPage() { throw Error('Unexpected fallback route') } }) },
    '@device-manager-ui/api/instance': { detail: id => new Promise(resolve => pending.set(id, resolve)) },
    '../services/adapters/iotDeviceApiAdapter': { mapApiDevice: value => value },
    './useIotDeviceRouting': { resolveIotProjectId: () => 'project', buildIotDeviceDetailPath: () => { throw Error('Unexpected generic route') } },
    './useDeviceListProvider': { useDeviceListProvider: current => vue.computed(() => current.value ? { id:'gateway', detailPath: device => `/gateways/${device.id}` } : undefined) },
  })
  const { useIotDeviceParentLink } = load('../../modules/device-manager-ui/views/device/list/hooks/useIotDeviceParentLink.ts')
  const scope = vue.effectScope(), device = vue.ref({ id:'child', deviceTypeValue:'childrenDevice', parentId:'old' })
  const link = scope.run(() => useIotDeviceParentLink(device))
  t.after(() => scope.stop())
  device.value = { ...device.value, parentId:'current' }; await flush()
  pending.get('old')({ result:{ id:'old', name:'Stale parent' } }); await flush()
  assert.equal(link.parentDeviceName.value,'current')
  pending.get('current')({ result:{ id:'current', name:'Current parent' } }); await flush()
  assert.equal(link.parentDeviceName.value,'Current parent')
  await link.openParentDevice()
  assert.deepEqual(navigated,['/gateways/current'])
  device.value = { id:'ordinary', deviceTypeValue:'device' }; await flush()
  await link.openParentDevice()
  assert.deepEqual(navigated,['/gateways/current'])
})
