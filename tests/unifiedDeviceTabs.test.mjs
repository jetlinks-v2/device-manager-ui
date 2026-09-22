import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const listSource = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')
const providerContract = await readFile(new URL('../deviceListProvider.ts', import.meta.url), 'utf8')
const videoProvider = await readFile(new URL('../../jetlinks-media-ui/deviceListProvider.ts', import.meta.url), 'utf8')

test('video tab visibility follows the deployment type', () => {
  assert.match(providerContract, /showInTabs\?: boolean/)
  assert.match(videoProvider, /import \{ isPrivateDeployment \} from '@jetlinks-web-core\/utils\/deployment'/)
  assert.match(videoProvider, /id: 'video'[\s\S]*?showInTabs: isPrivateDeployment\(\)/)
  assert.match(listSource, /const tabs = computed<SlantedTabOption\[]>\(\(\) => \[[\s\S]*?provider\.showInTabs !== false/)
})

test('hidden providers still serve category links and classify devices', () => {
  assert.match(listSource, /providers\.value\.some\(provider => provider\.id !== 'device' && provider\.id === requested\)/)
  assert.match(listSource, /extensions\.find\(provider => provider\.matches\(device\)\)/)
  assert.match(videoProvider, /menuCode: 'video\/resources'/)
})
