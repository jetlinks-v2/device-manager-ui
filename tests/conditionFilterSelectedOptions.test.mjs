import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../../../jetlinks-web-core/src/components/ConditionFilter/ConditionFilter.vue', import.meta.url), 'utf8')

test('remote selected values load without static options and deduplicate in-flight lookups', () => {
  const loader = source.slice(source.indexOf('const createOptionsLoader'), source.indexOf('/**\n * 兼容旧 Search'))
  assert.doesNotMatch(loader, /if \(!rawOptions\) \{\s*return/)
  assert.match(loader, /loadSelectedOptions && term && hasTermValue\(term\)/)
  assert.match(loader, /selectedOptionsLoadingMap\[key\]/)
  assert.match(loader, /await loadSelectedOptions\(values\)/)
})
