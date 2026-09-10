import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { computed, ref, shallowRef } from 'vue'
import { transform } from 'esbuild'

// 直接加载生产纯函数，node --test 即可运行，无需预生成 work 目录产物。
const source = await readFile(new URL('../views/device/list/hooks/deviceDetailTabs.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { normalizeDeviceDetailTab, selectDeviceDetailTabs } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const deviceOf = accessProvider => ({ id: 'camera-1', accessProvider })
const channels = {
  key: 'channels', label: () => 'Channels', icon: 'VideoCameraOutlined', component: {},
  matches: device => device.accessProvider === 'fixed-media',
}

test('channel deep link restores after device and module resolve without rewriting query', () => {
  const device = ref(null)
  const registered = shallowRef([])
  const query = ref('channels')
  const tabs = computed(() => selectDeviceDetailTabs(device.value, registered.value))
  const active = computed(() => normalizeDeviceDetailTab(query.value, tabs.value))
  assert.equal(active.value, 'overview')
  device.value = deviceOf('fixed-media')
  assert.equal(active.value, 'overview')
  registered.value = [channels]
  assert.equal(active.value, 'channels')
  registered.value = []
  assert.equal(active.value, 'overview')
  registered.value = [channels]
  assert.equal(active.value, 'channels')
  assert.equal(query.value, 'channels')
})

test('device capability governs tabs when switching from a camera to an ordinary device', () => {
  assert.deepEqual(selectDeviceDetailTabs(null, [channels]), [])
  assert.equal(selectDeviceDetailTabs(deviceOf('fixed-media'), [channels]).length, 1)
  const ordinaryTabs = selectDeviceDetailTabs(deviceOf('mqtt'), [channels])
  assert.deepEqual(ordinaryTabs, [])
  assert.equal(normalizeDeviceDetailTab('channels', ordinaryTabs), 'overview')
})

test('built-in tabs and legacy deep links retain their destinations', () => {
  for (const tab of ['overview', 'access', 'commands', 'data', 'alarm', 'logs']) {
    assert.equal(normalizeDeviceDetailTab(tab, [channels]), tab)
  }
  assert.equal(normalizeDeviceDetailTab('advanced', [channels]), 'access')
  assert.equal(normalizeDeviceDetailTab('realtime', [channels]), 'data')
  assert.equal(normalizeDeviceDetailTab('records', [channels]), 'logs')
  assert.equal(normalizeDeviceDetailTab('simulator', [channels]), 'commands')
  assert.equal(normalizeDeviceDetailTab(['channels'], [channels]), 'overview')
  assert.equal(normalizeDeviceDetailTab('missing', [channels]), 'overview')
  assert.equal(normalizeDeviceDetailTab('__proto__', [channels]), 'overview')
})

test('registration order is stable and extensions cannot shadow built-in or duplicate tabs', () => {
  const late = { ...channels, order: 20 }
  const early = { ...channels, key: 'recording', order: 10 }
  const duplicate = { ...channels, order: 30 }
  const shadow = { ...channels, key: 'overview', order: 0 }
  const selected = selectDeviceDetailTabs(deviceOf('fixed-media'), [late, early, duplicate, shadow])
  assert.deepEqual(selected.map(tab => tab.key), ['recording', 'channels'])
  assert.equal(selected[1], late)
})
