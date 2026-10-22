import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('..', import.meta.url))
const paneSource = readFileSync(resolve(directory, 'views/device/list/components/device-detail/IotDeviceAccessGuidePane.vue'), 'utf8')
const asideSource = readFileSync(resolve(directory, 'views/device/list/components/device-detail/IotDeviceAccessGuideAside.vue'), 'utf8')
const detailHookSource = readFileSync(resolve(directory, 'views/device/list/hooks/useIotDeviceAccessDetail.ts'), 'utf8')

test('private deployment hides the access guide and does not request its document', () => {
  assert.match(paneSource, /isPrivateDeployment/)
  assert.match(paneSource, /const showAccessGuide = !isPrivateDeployment\(\)/)
  assert.match(paneSource, /:show-access-guide="showAccessGuide"/)
  assert.match(paneSource, /showAccessGuide \|\| Boolean\(protocolDocument\.value\)/)
  assert.match(asideSource, /v-if="props\.showAccessGuide" key="guide"/)
  assert.match(asideSource, /props\.showAccessGuide \? 'guide' : 'protocol'/)
  assert.match(detailHookSource, /showAccessGuide \? \[loadAccessGuideDocument\(\)\] : \[\]/)
})
