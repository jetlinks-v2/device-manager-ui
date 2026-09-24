import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const unifiedList = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const gatewayProvider = await readFile(new URL('../../edge-master-ui/deviceListProvider.ts', import.meta.url), 'utf8')
const saasRuntime = await readFile(new URL('../../saas-runtime-ui/index.ts', import.meta.url), 'utf8')

test('gateway provider create entry remains visible in the unified list', () => {
  assert.match(gatewayProvider, /id: 'gateway'[\s\S]*?create:\s*{[\s\S]*?GatewayDeviceList\.accessGateway[\s\S]*?GatewayAccessModal\.vue/)
  assert.match(unifiedList, /v-if="activeProvider\?\.create"[\s\S]*?:key="`create-\$\{activeProvider\.id\}`"/)
  assert.match(unifiedList, /<component v-if="createEntry"[\s\S]*?:is="createEntry\.component"/)
  assert.doesNotMatch(saasRuntime, /target:\s*'create-gateway'[\s\S]*?mode:\s*'hide'/)
  assert.ok(
    unifiedList.indexOf('v-if="activeProvider?.create"') < unifiedList.indexOf('<a-dropdown v-if="activeType === \'gateway\'">'),
    'gateway create entry must render before batch actions',
  )
})
