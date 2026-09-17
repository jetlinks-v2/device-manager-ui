import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { transform } from 'esbuild'
import ts from 'typescript'

const sourcePath = new URL('../views/device/list/components/IotDeviceTagEditorModal.vue', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
assert.ok(script, 'tag editor script exists')

const sourceFile = ts.createSourceFile(sourcePath.pathname, script, ts.ScriptTarget.Latest, true)
const expectedNames = new Set([
  'TIME_ONLY_DATE_FORMAT',
  'getTagType',
  'getTagDateFormat',
  'isTimeOnlyTag',
  'normalizeTimeOnlyValue',
])
const declarations = sourceFile.statements
  .filter((statement) => {
    if (ts.isFunctionDeclaration(statement)) return expectedNames.has(statement.name?.text || '')
    return ts.isVariableStatement(statement) && statement.declarationList.declarations.some((item) => expectedNames.has(item.name.getText(sourceFile)))
  })
  .map(statement => statement.getText(sourceFile))
  .join('\n')

const dayjsStub = `
const dayjs = (value) => {
  const date = new Date(value)
  return {
    isValid: () => !Number.isNaN(date.getTime()),
    format: () => [date.getHours(), date.getMinutes(), date.getSeconds()].map(value => String(value).padStart(2, '0')).join(':'),
  }
}
`
const { code } = await transform(`${dayjsStub}\n${declarations}\nmodule.exports = { isTimeOnlyTag, normalizeTimeOnlyValue }`, {
  loader: 'ts',
  format: 'cjs',
})
const module = { exports: {} }
vm.runInNewContext(code, { module, exports: module.exports, Date, Number, String })

const { isTimeOnlyTag, normalizeTimeOnlyValue } = module.exports

test('uses a time-only editor for date tags configured as HH:mm:ss', () => {
  assert.equal(isTimeOnlyTag({ dataType: { type: 'date', format: 'HH:mm:ss' } }), true)
  assert.equal(isTimeOnlyTag({ dataType: { type: 'date', format: 'yyyy-MM-dd HH:mm:ss' } }), false)
})

test('normalizes an existing date-time value to the configured time-only value', () => {
  assert.equal(normalizeTimeOnlyValue('08:09:10'), '08:09:10')
  assert.equal(normalizeTimeOnlyValue('2026-09-17T08:09:10'), '08:09:10')
})

test('renders the Ant Design time picker and preserves its HH:mm:ss value on save', () => {
  assert.match(source, /<a-time-picker[\s\S]*format="HH:mm:ss"[\s\S]*value-format="HH:mm:ss"/)
  assert.match(source, /isTimeOnlyTag\(row\)\s*\?\s*row\.value\s*:\s*dayjs\(row\.value\)/)
})
