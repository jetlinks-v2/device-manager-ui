import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')
const page = await readFile(new URL('../views/device/list/unified/index.vue', import.meta.url), 'utf8')
const list = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceList.ts', import.meta.url), 'utf8')
const workspace = await readFile(new URL('../views/device/list/unified/useUnifiedDeviceWorkspace.ts', import.meta.url), 'utf8')

test('统一设备列表状态按钮组脚本和模板可编译', () => {
  const { descriptor, errors } = parse(page, { filename: 'unified/index.vue' })
  assert.deepEqual(errors, [])
  compileScript(descriptor, { id: 'unified-status-filter' })
  const template = compileTemplate({ source: descriptor.template.content, filename: 'unified/index.vue', id: 'unified-status-filter' })
  assert.deepEqual(template.errors, [])
})

test('仅有三种状态，重复点击当前状态仍清除筛选', () => {
  assert.match(page, /class="unified-device-list__statuses"[^>]*role="group"[\s\S]*?v-for="option in statusOptions"/)
  assert.match(workspace, /\['online', 'offline', 'disabled'\]\.map/)
  assert.match(page, /@click="changeStatus\(option.value\)"/)
  assert.doesNotMatch(page, /<SwitchGroup|value:\s*'all'/)
  assert.match(list, /status: value === status\.value \? undefined : value/)
})

test('无路由状态时不选中，切换与取消保留其他条件，并支持恢复已有状态', () => {
  const ts = require('typescript')
  const { computed, reactive } = require('vue')
  const file = ts.createSourceFile('useUnifiedDeviceList.ts', list, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const setup = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useUnifiedDeviceList')
  const bindings = setup.body.statements.filter(node => (
    ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(file) === 'status')
  ) || (ts.isFunctionDeclaration(node) && node.name?.text === 'changeStatus'))
  assert.equal(bindings.length, 2)
  const code = ts.transpileModule(bindings.map(node => node.getText(file)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const query = { scopeType: 'area', type: 'gateway', scopeId: 'area-1', q: 'encoded-condition' }
  const route = reactive({ query: { ...query } })
  const router = { replace: ({ query }) => { route.query = query; return Promise.resolve() } }
  const { status, changeStatus } = new Function('computed', 'route', 'router', `${code}\nreturn { status, changeStatus }`)(computed, route, router)

  assert.equal(status.value, 'all')
  assert.equal(['online', 'offline', 'disabled'].includes(status.value), false)
  changeStatus('online')
  assert.equal(status.value, 'online')
  assert.deepEqual(route.query, { ...query, status: 'online' })
  changeStatus('offline')
  assert.equal(status.value, 'offline')
  changeStatus('offline')
  assert.equal(status.value, 'all')
  assert.deepEqual(route.query, { ...query, status: undefined })
  route.query = { ...query, status: 'disabled' }
  assert.equal(status.value, 'disabled')
  changeStatus('disabled')
  assert.equal(status.value, 'all')
})
