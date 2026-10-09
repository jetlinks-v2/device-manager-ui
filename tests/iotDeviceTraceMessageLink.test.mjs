import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourcePath = new URL(
  '../views/device/list/components/device-detail/IotDeviceTraceTab.vue',
  import.meta.url,
)
const source = await readFile(sourcePath, 'utf8')

test('links the command result to a trace by the first response result messageId only', () => {
  assert.match(source, /v-if="invokeResult\.messageId"/)
  assert.match(source, /@click="focusMessageTrace\(invokeResult\.messageId\)"/)
  assert.match(source, /function extractResponseMessageId\(response: \{ result\?: Array<\{ messageId\?: unknown \}> \} \| undefined\)/)
  assert.match(source, /response\?\.result\?\.\[0\]\?\.messageId/)
  assert.match(source, /messageId: extractResponseMessageId\(resp\)/)
  assert.doesNotMatch(source, /response\?\.result\?\.messageId/)
})

test('queues and resolves an exact messageId match when the WebSocket trace arrives later', () => {
  assert.match(source, /const pendingMessageId = ref<string>\(\)/)
  assert.match(source, /normalizeMessageId\(item\.source\.messageId\) === normalized/)
  assert.match(source, /pendingMessageId\.value = normalized/)
  assert.match(source, /if \(pendingMessageId\.value\) \{\s+focusMessageTrace\(pendingMessageId\.value\)/)
})
