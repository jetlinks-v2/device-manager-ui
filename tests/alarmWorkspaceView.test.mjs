import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../views/device/alarm/index.vue', import.meta.url), 'utf8')

test('alarm sidebar top rows use the visual alarm dimensions and spacing', () => {
  assert.match(page, /class="alarm-rule-heading__content">\s*<strong>/)
  assert.match(page, /\.alarm-rule-heading \{[\s\S]*?min-height: var\(--visual-alarm-control-row-height\);[\s\S]*?align-items: center;/)
  assert.match(page, /\.alarm-rule-heading__content \{[\s\S]*?align-items: baseline;[\s\S]*?gap: var\(--space-2\);/)
  assert.match(page, /\.alarm-rule-heading__content strong \{[^}]*font-size: var\(--fs-18\);[^}]*font-weight: 700;/)
  assert.match(page, /\.alarm-rule-search \{ height: var\(--visual-alarm-control-row-height\); flex: none; \}/)
  assert.match(page, /\.alarm-rule-search :deep\(\.ant-input-affix-wrapper\) \{ height: 100%; \}/)
  assert.match(page, /class="alarm-all-records__icon">\s*<AIcon type="AlertOutlined"/)
  assert.match(page, /class="alarm-all-records__content">\s*<span class="alarm-all-records__title">\s*<strong>/)
  assert.match(page, /\.alarm-all-records \{[\s\S]*?display: grid;/)
  assert.match(page, /grid-template-columns: auto minmax\(0, 1fr\);/)
  assert.match(page, /min-height: 3\.5rem;/)
  assert.match(page, /padding: 0\.875rem;/)
  assert.match(page, /\.alarm-all-records__icon \{[\s\S]*?width: 1\.5rem;[\s\S]*?height: 1\.5rem;[\s\S]*?font-size: var\(--fs-18\);/)
  assert.match(page, /\.alarm-all-records__content strong \{[^}]*font-size: var\(--fs-14\);[^}]*font-weight: 600;/)
})
