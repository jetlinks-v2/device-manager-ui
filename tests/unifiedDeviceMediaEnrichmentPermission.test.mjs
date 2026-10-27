import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const listSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')
const gatewayProvider = await readFile(new URL('../../edge-master-ui/deviceListProvider.ts', import.meta.url), 'utf8')
const mediaRegister = await readFile(new URL('../../jetlinks-media-ui/register.ts', import.meta.url), 'utf8')
const mediaChannelCountApi = await readFile(new URL('../../jetlinks-media-ui/api/deviceChannelCount.ts', import.meta.url), 'utf8')

test('all devices do not trigger media enrichment before a media category is selected', () => {
  assert.match(listSource, /const selectedProvider = activeProvider\.value[\s\S]*?selectedProvider\?\.enrich[\s\S]*?selectedProvider\.enrich\(data\.filter\(device => device\.category === selectedProvider\.id\)\)/)
  assert.doesNotMatch(listSource, /providers\.value\.filter\(provider => provider\.enrich\)/)
})

test('gateway list requests channel counts through the public media capability, not the video device catalogue', () => {
  assert.match(mediaRegister, /queryMediaDeviceChannelCounts/)
  assert.match(mediaChannelCountApi, /request\.post\('\/media\/device\/channel\/_agg'/)
  assert.match(mediaChannelCountApi, /column: 'deviceId', termType: 'in', value: ids/)
  assert.match(gatewayProvider, /accessProvider === MEDIA_GATEWAY_PROVIDER/)
  assert.match(gatewayProvider, /'jetlinks-media-ui', 'apis', 'queryMediaDeviceChannelCounts'/)
  assert.doesNotMatch(gatewayProvider, /useMenuStore|deviceListProviders', 'video'|video\?\.enrich/)
})
