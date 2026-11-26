import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { transformSync } from 'esbuild'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const feature = new URL('../views/device/list/components/device-detail/tags/', import.meta.url)
function load(name) {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(new URL(name + '.ts', feature), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(
    id => id === './tagEditor' ? load('tagEditor') : require(id), module, module.exports,
  )
  return module.exports
}
const { createTagDraft, serializeTagDraft, hasTagValue, findStoredTag } = load('tagEditor')
const { useTagEditor } = load('useTagEditor')

test('time-only and date-only tags round-trip without adding a date or time', () => {
  for (const [format, input, expected] of [
    ['HH:mm:ss', '08:09:10', '08:09:10'],
    ['HH:mm:ss', '2026-09-17T08:09:10', '08:09:10'],
    ['yyyy-MM-dd', '2026-09-17T08:09:10', '2026-09-17'],
    ['yyyy-MM-dd HH:mm:ss', '2026-09-17T08:09:10', '2026-09-17 08:09:10'],
  ]) {
    const tag = { key: 'schedule', dataType: { type: 'date', format }, value: input }
    assert.equal(serializeTagDraft(createTagDraft(tag)).value, expected)
  }
})

test('JSON drafts are isolated, geoPoint keeps coordinates, zero and false remain visible', () => {
  const tag = { key: 'config', dataType: { type: 'object' }, value: { enabled: true } }
  const draft = createTagDraft(tag)
  draft.value.enabled = false
  assert.equal(tag.value.enabled, true)
  assert.equal(serializeTagDraft(draft).value, '{"enabled":false}')
  assert.equal(serializeTagDraft(createTagDraft({ key: 'point', type: 'geoPoint', value: '121.5,31.2' })).value, '121.5,31.2')
  assert.equal(hasTagValue(0), true)
  assert.equal(hasTagValue(false), true)
  for (const value of ['', ' ', null, undefined]) assert.equal(hasTagValue(value), false)
})

test('saving a changed value excludes the stale formatted display and keeps the record ID', () => {
  const draft = createTagDraft({ id: 'record-id', key: 'mode', type: 'string', value: 'old', formatValue: 'Old text' })
  draft.value = 'new'
  const payload = serializeTagDraft(draft)
  assert.equal(payload.id, 'record-id')
  assert.equal(payload.key, 'mode')
  assert.equal(payload.value, 'new')
  assert.equal('formatValue' in payload, false)
  assert.equal('valueType' in payload, false)
})

test('deletion resolves the stored record, never a product definition ID', () => {
  const stored = [{ id: 'instance-tag-id', key: 'point', value: '121,31' }]
  assert.equal(findStoredTag(stored, { id: 'point' }).id, 'instance-tag-id')
  assert.equal(findStoredTag([], { id: 'point', value: 'default' }), undefined)
})

test('inline save retains draft after failure, retries only that tag, and cancel discards edits', async () => {
  const calls = []
  let fail = true
  const state = { savingTags: false, canDeviceAction: () => true,
    saveTags: async tags => { calls.push(tags); if (fail) throw Error('failed'); return true }, removeTag: async () => true }
  const editor = useTagEditor(() => state)
  const original = { key: 'position', value: 'old' }
  editor.edit(original)
  editor.draft.value.value = 'draft'
  await editor.save()
  assert.equal(editor.failed.value, true)
  assert.equal(editor.draft.value.value, 'draft')
  assert.equal(original.value, 'old')
  fail = false
  await editor.save()
  assert.equal(editor.activeKey.value, '')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].length, 1)
  assert.equal(calls[1][0].key, 'position')
  editor.edit(original)
  editor.draft.value.value = 'discard'
  editor.close()
  editor.edit(original)
  assert.equal(editor.draft.value.value, 'old')
})

test('read-only or busy tags cannot edit, save or remove', async () => {
  let allowed = false, calls = 0
  const state = { savingTags: false, canDeviceAction: () => allowed,
    saveTags: async () => { calls++; return true }, removeTag: async () => { calls++; return true } }
  const editor = useTagEditor(() => state)
  editor.edit({ key: 'x', value: 'old' })
  assert.equal(editor.activeKey.value, '')
  allowed = true
  editor.edit({ key: 'x', value: 'old' })
  state.savingTags = true
  editor.close()
  await editor.save()
  await editor.remove({ key: 'x' })
  assert.equal(editor.activeKey.value, 'x')
  assert.equal(calls, 0)
})

// 执行宿主真实保存函数，仅替换接口和刷新 I/O。
const source = readFileSync(new URL('../views/device/list/hooks/useIotDeviceDetailView.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('detail.ts', source, ts.ScriptTarget.Latest, true)
const hook = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useIotDeviceDetailView')
const names = ['getTagKey', 'isEmptyTagValue', 'saveTags', 'canRemoveTag', 'removeTag']
const functions = hook.body.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n')
const factory = new Function('findStoredTag', transformSync(`return function(state) {
 const {device,deviceId,projectId,savingTags,tagEditorOpen,iotDeviceDetailRealApi,loadDevice}=state;
 const disposed=false, canDeviceAction=()=>state.allowed, $t=key=>key, onlyMessage=()=>{};
 const detailContent={value:false},detailContentRef={value:null};
 const beginLoad=()=>({id:deviceId.value}),isCurrentLoad=context=>context.id===deviceId.value;
 ${functions}
 return {saveTags,canRemoveTag,removeTag};
}`, { loader: 'ts', format: 'cjs' }).code)(findStoredTag)
function fixture() {
  const calls = []
  const state = { allowed: true, device: { value: { id: 'A', thingModelTags: [{ key: 'point', id: 'stored', value: 'old' }] } }, deviceId: { value: 'A' }, projectId: { value: 'P' }, savingTags: { value: false }, tagEditorOpen: { value: true },
    iotDeviceDetailRealApi: { saveTags: async (...args) => calls.push(['save', ...args]), deleteTag: async (...args) => calls.push(['delete', ...args]) },
    loadDevice: async () => calls.push(['refresh']) }
  return {state,calls,...factory(state)}
}

test('remove uses the actual device record and never deletes an unfilled definition', async () => {
  const f = fixture()
  assert.equal(await f.removeTag({ id: 'missing-definition' }), false)
  assert.equal(f.calls.length, 0)
  assert.equal(await f.removeTag({ id: 'point' }), true)
  assert.deepEqual(f.calls, [['delete', 'A', 'stored'], ['refresh']])
  assert.equal(f.state.savingTags.value, false)
})

test('failed delete preserves values and releases busy state', async () => {
  const f = fixture()
  f.state.iotDeviceDetailRealApi.deleteTag = async () => { throw Error('failed') }
  await assert.rejects(f.removeTag({ id: 'point' }), /failed/)
  assert.equal(f.state.device.value.thingModelTags[0].value, 'old')
  assert.equal(f.state.savingTags.value, false)
  assert.equal(f.calls.length, 0)
})

test('permissions and route changes prevent stale mutation completion from refreshing another device', async () => {
  const f = fixture()
  f.state.allowed = false
  assert.equal(await f.removeTag({ id: 'point' }), false)
  assert.equal(f.calls.length, 0)
  f.state.allowed = true
  f.state.iotDeviceDetailRealApi.saveTags = async () => { f.state.deviceId.value = 'B' }
  assert.equal(await f.saveTags([{ key: 'point', value: 'new' }]), false)
  assert.equal(f.calls.length, 0)
  assert.equal(f.state.tagEditorOpen.value, true)
  assert.equal(f.state.savingTags.value, false)
})
