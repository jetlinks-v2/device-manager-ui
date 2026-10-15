import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('../views/device/Product/Detail/DeviceAccess/index.vue', import.meta.url),
  'utf8',
)

test('clears reused device-access state before loading another product', () => {
  assert.match(source, /const resetAccessState = \(\) => \{[\s\S]*?access\.value = \{\};/)
  assert.match(source, /const loadVersion = \+\+accessLoadVersion;\s+const _accessId[\s\S]*?resetAccessState\(\);/)
})

test('ignores stale gateway requests after the active product changes', () => {
  assert.match(source, /if \(!isCurrentAccessLoad\(loadVersion\)\) return;/)
  assert.match(source, /const queryAccessDetail = async \(id: string, loadVersion: number\)/)
  assert.match(source, /if \(access\.value\?\.id !== val\) return;/)
})
