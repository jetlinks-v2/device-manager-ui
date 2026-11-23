import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import { computed, ref } from 'vue'
import { parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(readFileSync(new URL('../views/device/Product/hooks/useProductListColumnLayout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
new Function('require', 'exports', code)(id => id.endsWith('/useTableBodyWidth') ? {} : require(id), exports)
const { getProductListColumnLayout } = exports
const productSource = parse(readFileSync(new URL('../views/device/Product/index.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const productAst = ts.createSourceFile('product.ts', productSource, ts.ScriptTarget.Latest, true)
const declaration = name => productAst.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
  .find(node => node.name.getText(productAst) === name).initializer.getText(productAst)

test('product list prioritizes names and keeps device count and type readable at the desktop baseline', () => {
  const layout = getProductListColumnLayout(1340)
  assert.deepEqual([layout.name, layout.category, layout.brand], [440, 180, 220])
  assert.deepEqual([layout.deviceCount, layout.state, layout.deviceType, layout.action], [130, 90, 170, 110])
})

test('product widths fill different containers without shrinking fixed business columns', () => {
  for (const width of [1200, 1342, 1600, 1920, 2560]) {
    const layout = getProductListColumnLayout(width)
    assert.equal(layout.tableWidth, width)
    assert.equal(layout.name + layout.category + layout.brand + layout.deviceCount + layout.state + layout.deviceType + layout.action, width)
    assert(layout.name > layout.brand && layout.brand > layout.category)
    assert.deepEqual([layout.deviceCount, layout.state, layout.deviceType, layout.action], [130, 90, 170, 110])
  }
})

test('narrow product tables retain minimum content widths and scroll horizontally', () => {
  const layout = getProductListColumnLayout(800)
  assert.equal(layout.tableWidth, 1100)
  assert.deepEqual([layout.name, layout.category, layout.brand], [300, 140, 160])
})

test('device type follows product name before classification and brand', () => {
  const columns = new Function('computed', 'columnLayout', '$t', `return ${declaration('columns')}`)(
    computed, ref(getProductListColumnLayout(1340)), key => key,
  )
  assert.deepEqual(columns.value.map(column => column.key), ['name', 'deviceType', 'classifiedName', 'brandModel', 'deviceCount', 'state', 'action'])
})
