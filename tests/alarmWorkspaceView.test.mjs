import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const page = await readFile(new URL('../views/device/alarm/index.vue', import.meta.url), 'utf8')
const editor = await readFile(new URL('../views/device/alarm/components/DeviceAlarmEditorModal.vue', import.meta.url), 'utf8')
const editorStyle = await readFile(new URL('../views/device/alarm/components/DeviceAlarmEditorModal.less', import.meta.url), 'utf8')
const alarmPageHook = await readFile(new URL('../views/device/alarm/hooks/useDeviceAlarmPage.ts', import.meta.url), 'utf8')
const productAlarmTab = await readFile(new URL('../views/device/Product/Detail/components/ProductAlarmConfigTab.vue', import.meta.url), 'utf8')
const deviceAlarmTab = await readFile(new URL('../views/device/list/components/device-detail/IotDeviceAlarmConfigTab.vue', import.meta.url), 'utf8')

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

test('alarm create and edit share the three-section visual-alarm-style configuration workspace', () => {
  assert.match(editor, /width="min\(100rem, calc\(100vw - 2\.25rem\)\)"/)
  assert.match(editor, /class="device-alarm-editor__workspace"/)
  assert.match(editorStyle, /grid-template-columns: 18\.75rem minmax\(26\.875rem, 1\.1fr\) minmax\(22\.5rem, 1fr\);/)
  assert.match(editorStyle, /:global\(\.device-alarm-editor-modal-wrap \.ant-modal-content\)/)
  assert.doesNotMatch(editorStyle, /\.device-alarm-editor-modal-wrap \.ant-modal-header\)[^{]*\{[^}]*border-bottom:/)
  assert.match(editor, /type EditorPanel = 'target' \| 'trigger' \| 'notification'/)
  assert.doesNotMatch(editor, /activePanel === 'relieve'/)
  assert.match(editor, /activePanel === 'trigger'[\s\S]*?model\.autoRelieve/)
  assert.match(editor, /device-alarm-editor__summary/)
  assert.match(editor, /<RegistryComponent page-code="device\/alarm" code="alarm-editor">/)
  assert.match(editor, /v-model:checked="model\.autoRelieve"/)
  assert.match(editorStyle, /@media \(max-width: 68\.75rem\)/)
  assert.match(editorStyle, /@media \(max-width: 45rem\)/)
})

test('all three device alarm entry points keep using the shared editor', () => {
  assert.match(page, /<DeviceAlarmEditorModal/)
  assert.match(productAlarmTab, /<DeviceAlarmEditorModal/)
  assert.match(productAlarmTab, /fixed-product-scope/)
  assert.match(deviceAlarmTab, /<DeviceAlarmEditorModal/)
  assert.match(deviceAlarmTab, /readonly-scope/)
})

test('all three device alarm entry points resolve selected notification user names', () => {
  for (const source of [alarmPageHook, productAlarmTab, deviceAlarmTab]) {
    assert.match(source, /const selectedUserIds =/)
    assert.match(source, /queryDeviceAlarmNotifyUsers\(\{ paging: false, userIds: selectedUserIds \}\)/)
    assert.match(source, /mergeNotifyUsersById\(selectedUsers\.data, users\.data\)/)
  }
})
