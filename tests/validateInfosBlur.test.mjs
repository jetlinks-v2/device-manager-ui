import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { transformSync } from 'esbuild'
import { createRenderer, effectScope, h, nextTick, reactive, ref } from 'vue'
import { Form } from 'ant-design-vue'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../hooks/useValidateInfosBlur.ts', import.meta.url), 'utf8')
const compiled = { exports: {} }
new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
  require, compiled, compiled.exports,
)
const { useValidateInfosBlur } = compiled.exports

const nameRules = () => [
  { required: true, message: '名称必填', trigger: 'blur' },
  { max: 64, message: '最多64个字符', trigger: 'blur' },
]

/** 等待真实 async-validator 与 Vue 的状态回填，不替换校验器。 */
async function settle() {
  for (let turn = 0; turn < 8; turn++) {
    await nextTick()
    await setImmediate()
  }
}

function createForm(t, values = { name: '', description: '' }, rules = {
  name: nameRules(), description: [{ max: 200, message: '最多200个字符' }],
}, options = {}) {
  const scope = effectScope()
  const model = reactive(values)
  const rulesRef = ref(rules)
  const form = scope.run(() => {
    const result = Form.useForm(model, rulesRef, options)
    useValidateInfosBlur(result)
    return result
  })
  t.after(() => scope.stop())
  return { scope, model, rulesRef, form }
}

test('blur-only name validates required and 64/65 boundary, then clears the error', async t => {
  const { model, form } = createForm(t)
  assert.equal(form.validateInfos.name.autoLink, false)
  assert.equal(form.validateInfos.name.required, true)
  assert.equal(form.validateInfos.description.onBlurCapture, undefined)
  model.name = 'a'.repeat(65)
  await settle()
  assert.notEqual(form.validateInfos.name.validateStatus, 'error', 'change does not run blur rules')
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.equal(form.validateInfos.name.validateStatus, 'error')
  assert.match(JSON.stringify(form.validateInfos.name.help), /最多64个字符/)

  model.name = 'a'.repeat(64)
  await settle()
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.equal(form.validateInfos.name.validateStatus, 'success')
  assert.equal(form.validateInfos.name.help, null)

  model.name = ''
  await settle()
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.match(JSON.stringify(form.validateInfos.name.help), /名称必填/)
})

test('blur filters rules, supports trigger arrays, and preserves submit and change validation', async t => {
  const calls = []
  const rule = (name, trigger) => ({ trigger, validator: async () => { calls.push(name) } })
  const { model, form } = createForm(t, { name: '' }, {
    name: [rule('default'), rule('change', 'change'), rule('blur', 'blur'), rule('both', ['change', 'blur'])],
  })
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.deepEqual(calls.sort(), ['blur', 'both'])
  calls.length = 0
  model.name = 'changed'
  await settle()
  assert.deepEqual(calls.sort(), ['both', 'change', 'default'])
  calls.length = 0
  assert.deepEqual(await form.validate(), { name: 'changed' })
  assert.deepEqual(calls.sort(), ['blur', 'both', 'change', 'default'])
})

test('resetFields and clearValidate keep subsequent blur validation working', async t => {
  const { form } = createForm(t)
  const previous = form.validateInfos.name
  form.resetFields({ name: 'b'.repeat(65) })
  await settle()
  assert.notEqual(form.validateInfos.name, previous)
  assert.equal(form.validateInfos.name.help, undefined)
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.equal(form.validateInfos.name.validateStatus, 'error')
  form.clearValidate()
  assert.equal(form.validateInfos.name.help, null)
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.equal(form.validateInfos.name.validateStatus, 'error')
})

test('dynamic rules add/remove listeners and old listeners ignore removed rules', async t => {
  const { form, model, rulesRef } = createForm(t)
  const oldBlur = form.validateInfos.name.onBlurCapture
  rulesRef.value.name = [{ required: true, trigger: 'change' }]
  oldBlur()
  await settle()
  assert.equal(form.validateInfos.name.onBlurCapture, undefined)
  assert.notEqual(form.validateInfos.name.validateStatus, 'error')

  model.profile = { title: '' }
  rulesRef.value['profile.title'] = [{ required: true, message: '标题必填', trigger: ['change', 'blur'] }]
  await settle()
  form.validateInfos['profile.title'].onBlurCapture()
  await settle()
  assert.match(JSON.stringify(form.validateInfos['profile.title'].help), /标题必填/)
  const removedBlur = form.validateInfos['profile.title'].onBlurCapture
  delete rulesRef.value['profile.title']
  delete model.profile
  await settle()
  assert.equal(form.validateInfos['profile.title'], undefined)
  assert.doesNotThrow(removedBlur)
  rulesRef.value.name = nameRules()
  await settle()
  form.validateInfos.name.onBlurCapture()
  await settle()
  assert.match(JSON.stringify(form.validateInfos.name.help), /名称必填/)
})

test('blur only validates the active field and its own form instance', async t => {
  const first = createForm(t, { name: '', alias: '' }, { name: nameRules(), alias: nameRules() })
  const second = createForm(t)
  first.form.validateInfos.name.onBlurCapture()
  await settle()
  assert.equal(first.form.validateInfos.name.validateStatus, 'error')
  assert.equal(first.form.validateInfos.alias.validateStatus, undefined)
  assert.equal(second.form.validateInfos.name.validateStatus, undefined)
})

test('fields without blur rules do not start validation or invalidate a pending submit', async t => {
  let finish
  const { form } = createForm(t, { name: 'valid' }, {
    name: [{ validator: () => new Promise(resolve => { finish = resolve }) }],
  })
  const submission = form.validate()
  await settle()
  assert.equal(form.validateInfos.name.onBlurCapture, undefined)
  finish()
  assert.deepEqual(await submission, { name: 'valid' })
})

test('watchers are disposed with the component scope', async t => {
  const { scope, form } = createForm(t)
  scope.stop()
  form.validateInfos.name = { autoLink: false, required: true }
  await settle()
  assert.equal(form.validateInfos.name.onBlurCapture, undefined)
})

test('unchanged FormItem binding forwards the listener to its DOM row', async t => {
  // 使用真实 FormItem 和 Vue 渲染，仅将宿主 DOM 替换为可检查的内存节点。
  const previousWindow = globalThis.window
  globalThis.window = {
    matchMedia: media => ({ media, matches: false, addListener() {}, removeListener() {} }),
  }
  const node = type => ({ type, props: {}, children: [], parent: null })
  const renderer = createRenderer({
    createElement: node, createText: node, createComment: node,
    setText(target, text) { target.text = text },
    setElementText(target, text) { target.text = text; target.children = [] },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
    patchProp(target, key, previous, value) { target.props[key] = value },
    insert(target, parent, anchor) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
      target.parent = parent
    },
    remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  })
  let form
  const app = renderer.createApp({ setup() {
    form = Form.useForm(reactive({ name: 'valid' }), reactive({ name: nameRules() }))
    useValidateInfosBlur(form)
    return () => h(Form.Item, { ...form.validateInfos.name }, { default: () => h('input') })
  } })
  const root = node('root')
  t.after(() => {
    app.unmount()
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  })
  app.mount(root)
  const flatten = root => [root, ...root.children.flatMap(flatten)]
  const rows = flatten(root).filter(element => element.props.onBlurCapture)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'div')
  assert.equal(rows[0].props.onBlurCapture, form.validateInfos.name.onBlurCapture)
  rows[0].props.onBlurCapture()
  await settle()
  assert.equal(form.validateInfos.name.validateStatus, 'success')
})
