import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'
import ts from 'typescript'

// 从页面 AST 读取实际切卡入口，验证受控 SlantedTabs 不绕过物模型确认。
const file = new URL('../views/device/Product/Detail/index.vue', import.meta.url)
const source = readFileSync(file, 'utf8').split('<script setup lang="ts">')[1].split('</script>')[0]
const ast = ts.createSourceFile('detail.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'handleTabChange')
const code = transformSync(handler.getText(ast), { loader: 'ts' }).code
function fixture(tab) {
  const replacements = [], confirmations = []
  const activeTab = { value: tab }
  const router = { replace: value => { replacements.push(value); return Promise.resolve() } }
  const route = { query: { tab, type: 'product', ruleProperty: 'temperature' } }
  const EventEmitter = { emit: (event, callback) => confirmations.push({ event, callback }) }
  const change = new Function('activeTab', 'router', 'route', 'EventEmitter', code + '; return handleTabChange;')(activeTab, router, route, EventEmitter)
  return { change, replacements, confirmations, activeTab }
}

test('leaving Metadata changes the route only after its confirmation accepts', async () => {
  const state = fixture('Metadata')
  state.change('Device')
  assert.equal(state.replacements.length, 0)
  assert.equal(state.activeTab.value, 'Metadata')
  assert.equal(state.confirmations[0].event, 'MetadataTabs')
  await state.confirmations[0].callback()
  assert.deepEqual(state.replacements, [{ query: { tab: 'Device', type: 'product', ruleProperty: undefined } }])
})

test('ordinary tab changes retain unrelated route query parameters', () => {
  const state = fixture('Device')
  state.change('Metadata')
  assert.equal(state.confirmations.length, 0)
  assert.deepEqual(state.replacements, [{ query: { tab: 'Metadata', type: 'product', ruleProperty: undefined } }])
})
