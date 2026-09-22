import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const listSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')
const providerContract = await readFile(new URL('../deviceListProvider.ts', import.meta.url), 'utf8')
const videoProvider = await readFile(new URL('../../jetlinks-media-ui/deviceListProvider.ts', import.meta.url), 'utf8')

test('video is hidden only from the unified device-list tabs', () => {
  assert.match(providerContract, /showInTabs\?: boolean/)
  assert.match(videoProvider, /id: 'video'[\s\S]*?showInTabs: false/)
  assert.match(listSource, /const tabs = computed<SlantedTabOption\[]>\(\(\) => \[[\s\S]*?provider\.showInTabs !== false/)
})

test('hidden providers still serve category links and classify devices', () => {
  assert.match(listSource, /providers\.value\.some\(provider => provider\.id !== 'device' && provider\.id === requested\)/)
  assert.match(listSource, /extensions\.find\(provider => provider\.matches\(device\)\)/)
  assert.match(videoProvider, /menuCode: 'video\/resources'/)
})
