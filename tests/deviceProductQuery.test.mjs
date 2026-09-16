import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transform } from 'esbuild'
import ts from 'typescript'

const sourcePath = new URL('../api/device.ts', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const sourceFile = ts.createSourceFile(sourcePath.pathname, source, ts.ScriptTarget.Latest, true)
const statement = sourceFile.statements.find((item) => (
  ts.isVariableStatement(item)
  && item.declarationList.declarations.some((declaration) => declaration.name.getText(sourceFile) === 'normalizeLikeTermValue')
))

assert.ok(statement, 'Production like-term normalizer exists')
const { code } = await transform(`${statement.getText(sourceFile)}\nexport { normalizeLikeTermValue }`, {
  loader: 'ts',
  format: 'esm',
})
const { normalizeLikeTermValue } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('product query normalizes nested like terms without changing explicit wildcards', () => {
  const value = normalizeLikeTermValue({
    terms: [
      { column: 'name', termType: 'like', value: '温度' },
      { column: 'accessProvider', termType: 'nlike', value: '%mqtt%' },
      { column: 'deviceType', termType: 'eq', value: 'device' },
    ],
  })

  assert.deepEqual(value, {
    terms: [
      { column: 'name', termType: 'like', value: '%温度%' },
      { column: 'accessProvider', termType: 'nlike', value: '%mqtt%' },
      { column: 'deviceType', termType: 'eq', value: 'device' },
    ],
  })
})
