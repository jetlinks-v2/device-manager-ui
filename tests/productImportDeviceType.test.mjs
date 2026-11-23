import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const clone = value => JSON.parse(JSON.stringify(value))
const imported = () => ({ id: 'product-1', name: 'Imported product', deviceType: { value: 'device', text: '直连设备' } })

// 执行真实导入流程；隔离浏览器文件读取、环境预检与网络边界。
function harness(t, type, localProduct) {
  const originalReader = globalThis.FileReader
  globalThis.FileReader = class {
    readAsText(file, encoding) {
      assert.equal(encoding, 'UTF-8')
      file.text().then(value => { this.result = value; this.onload() })
    }
  }
  t.after(() => {
    if (originalReader) globalThis.FileReader = originalReader
    else delete globalThis.FileReader
  })
  const queries = [], saved = [], messages = [], events = []
  let local = localProduct, queryError
  const preflight = {
    environment: vue.ref({ storagePolicies: [], gatewayProviders: [] }), errors: vue.ref([]),
    load: async () => {}, validate: () => true, isStoragePolicyAvailable: () => true,
  }
  const modules = runtimeModules({
    vue: { ...vue, onBeforeUnmount: vue.onScopeDispose },
    '@jetlinks-web/utils': { onlyMessage: (...args) => messages.push(args) },
    '@jetlinks-web-core/utils': { encodeQuery: data => data, filterSelectNode: () => true },
    '../../../../assets': { device: {} },
    './useResourcePackagePreflight': { useResourcePackagePreflight: () => preflight },
    '../../../../api/link/type': {},
    '../../../../api/product': {
      category: async () => ({ result: [] }),
      queryNoPagingPost: async query => {
        queries.push(query)
        if (queryError) throw queryError
        return { result: local ? [clone(local)] : [] }
      },
      parseProductResourcePackage: async () => ({ result: { manifest: { product: imported() } } }),
      updateDevice: async product => { saved.push(clone(product)); return { status: 200 } },
      importProductResourcePackage: data => ({ subscribe(observer) {
        saved.push(data)
        observer.next({ type: 'completed' })
        return { unsubscribe() {} }
      } }),
    },
  })
  const { useResourcePackageWorkflow } = modules.load('views/device/Product/ResourcePackage/useResourcePackageWorkflow.ts')
  const scope = vue.effectScope()
  const view = scope.run(() => useResourcePackageWorkflow(event => events.push(event), vue.ref(type)))
  t.after(() => scope.stop())
  async function upload(product = imported()) {
    if (type === 'basic') await view.prepareBasicProduct(new File([JSON.stringify(product)], 'product.json'))
    else await view.beforeUpload(new File(['zip fixture'], 'product.zip'))
  }
  async function submit() {
    await view.next()
    if (type === 'resource') await view.next()
    await vue.nextTick()
    return type === 'basic' ? saved.at(-1) : JSON.parse(await saved.at(-1).get('request').text()).product
  }
  return { view, queries, saved, messages, events, upload, submit,
    setLocal: value => { local = value }, failQuery: () => { queryError = new Error('query failed') } }
}

for (const type of ['basic', 'resource']) {
  test(`${type} import locks an existing product to its local type, including products without access configuration`, async t => {
    const h = harness(t, type, { id: 'product-1', deviceType: { value: 'gateway', text: '网关设备' } })
    await h.upload()
    assert.equal(h.view.step.value, 1)
    assert.equal(h.view.deviceTypeDisabled.value, true)
    assert.equal(h.view.product.deviceType, 'gateway', 'local type overrides the file type')
    assert.deepEqual(h.queries, [{ terms: [{ column: 'id', termType: 'eq', value: 'product-1' }] }])
    h.view.product.deviceType = 'childrenDevice' // 模拟 v-model 先赋值、change 后处理。
    h.view.changeDeviceType(['childrenDevice'])
    assert.equal(h.view.product.deviceType, 'gateway')
    const submitted = await h.submit()
    assert.equal(submitted.deviceType, 'gateway')
    assert.equal(submitted.name, 'Imported product', 'other imported fields remain editable')
    assert.deepEqual(h.events, ['success'])
  })

  test(`${type} import allows selecting a type for a new product`, async t => {
    const h = harness(t, type)
    await h.upload()
    assert.equal(h.view.deviceTypeDisabled.value, false)
    assert.equal(h.view.product.deviceType, 'device')
    h.view.changeDeviceType(['childrenDevice'])
    assert.equal((await h.submit()).deviceType, 'childrenDevice')
  })

  test(`${type} import resets the type lock when another file is uploaded`, async t => {
    const h = harness(t, type, { id: 'product-1', deviceType: 'gateway' })
    await h.upload()
    assert.equal(h.view.deviceTypeDisabled.value, true)
    assert.equal(h.view.product.deviceType, 'gateway', 'string enum values are supported')
    h.setLocal(undefined)
    await h.upload()
    assert.equal(h.view.deviceTypeDisabled.value, false)
    assert.equal(h.view.product.deviceType, 'device')
    assert.equal(h.saved.length, 0, 'uploading never writes the product')
  })

  test(`${type} import stays on upload when the local product lookup fails`, async t => {
    const h = harness(t, type)
    h.failQuery()
    await h.upload()
    assert.equal(h.view.step.value, 0)
    assert.equal(h.view.loading.value, false)
    assert.equal(h.saved.length, 0)
    assert.ok(h.messages.some(([message, level]) => message === 'query failed' && level === 'error'))
  })
}

test('the shared import form compiles and binds the product type selector to the workflow lock', () => {
  const filename = new URL('../views/device/Product/ResourcePackage/index.vue', import.meta.url)
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
  assert.deepEqual(errors, [])
  // 用模板 AST 检查实际绑定，避免其他表单项的 disabled 掩盖类型选择器遗漏接线。
  function find(node) {
    if (node.tag === 'j-card-select') return node
    return node.children?.map(find).find(Boolean)
  }
  const card = find(descriptor.template.ast)
  assert.ok(card)
  assert.ok(card.props.some(prop => prop.name === 'bind' && prop.arg?.content === 'disabled' && prop.exp?.content === 'deviceTypeDisabled'))
  assert.doesNotThrow(() => compileScript(descriptor, { id: 'product-import-type', inlineTemplate: true }))
})
