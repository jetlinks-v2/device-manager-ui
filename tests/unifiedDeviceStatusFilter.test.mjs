import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')
const page = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const list = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')

test('统一设备列表状态按钮组脚本和模板可编译', () => {
  const { descriptor, errors } = parse(page, { filename: 'unified/index.vue' })
  assert.deepEqual(errors, [])
  compileScript(descriptor, { id: 'unified-status-filter' })
  const template = compileTemplate({ source: descriptor.template.content, filename: 'unified/index.vue', id: 'unified-status-filter' })
  assert.deepEqual(template.errors, [])
})

test('仅有三种状态，重复点击当前状态仍清除筛选', () => {
  assert.match(page, /<a-button-group[\s\S]*?v-for="option in statusOptions"/)
  assert.match(page, /\['online', 'offline', 'disabled'\]\.map/)
  assert.match(page, /@click="changeStatus\(option.value\)"/)
  assert.doesNotMatch(page, /<SwitchGroup|value:\s*'all'/)
  assert.match(list, /status: value === status\.value \? undefined : value/)
})
