import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const coreRoot = path.resolve(packageRoot, '../../jetlinks-web-core/src')
const creationGuideId = 'device-product:create-private-product'
const messages = Object.fromEntries(['zh', 'en'].map(language => [
  language,
  JSON.parse(readFileSync(path.join(packageRoot, `locales/lang/${language}.json`), 'utf8')),
]))
const guidanceMessages = Object.fromEntries(Object.entries(messages).map(([language, values]) => [
  language,
  Object.fromEntries(Object.entries(values).filter(([key]) => (
    key.startsWith('Product.homeAgent.')
    || key.startsWith('Save.index.')
    || key.startsWith('DeviceFunctionGuidance.')
    || key === 'IotDeviceList.action.create'
  ))),
]))

// Load only the real provider and deployment predicate; inventory APIs and browser registration
// are test boundaries. This avoids compiling the application or contacting a backend.
async function loadProvider(environment) {
  const result = await build({
    stdin: {
      contents: `
        export { deviceProductHomeAgentProvider as provider } from ${JSON.stringify(path.join(packageRoot, 'views/device/Product/homeAgentProvider.ts'))}
        export { setLocale } from 'product-creation-test-i18n'
      `,
      resolveDir: packageRoot,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    tsconfigRaw: { compilerOptions: {} },
    define: { 'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(environment) },
    plugins: [{
      name: 'product-creation-test-boundaries',
      setup(buildApi) {
        buildApi.onResolve({ filter: /^(@jetlinks-web-core\/locales|product-creation-test-i18n)$/ }, () => ({
          path: 'i18n', namespace: 'product-creation-test',
        }))
        buildApi.onLoad({ filter: /^i18n$/, namespace: 'product-creation-test' }, () => ({
          contents: `
            const messages = ${JSON.stringify(guidanceMessages)}
            let locale = 'zh'
            export const setLocale = value => { locale = value }
            export default { global: { t: (key, args = []) => {
              const message = messages[locale][key]
              if (typeof message !== 'string') throw new Error('Missing translation: ' + locale + ':' + key)
              return message.replace(/\\{(\\d+)\\}/g, (_, index) => {
                if (args[Number(index)] === undefined) throw new Error('Missing argument: ' + key + ':' + index)
                return String(args[Number(index)])
              })
            } } }
          `,
          loader: 'js',
        }))
        buildApi.onResolve({ filter: /^@jetlinks-web-core\/utils\/deployment$/ }, () => ({
          path: path.join(coreRoot, 'utils/deployment.ts'),
        }))
        buildApi.onResolve({ filter: /^@jetlinks-web-core\/layout\/components\/AiChat\/homeAgentCatalog$/ }, () => ({
          path: path.join(coreRoot, 'layout/components/AiChat/homeAgentCatalog.ts'),
        }))
        buildApi.onResolve({ filter: /^@jetlinks-web-core\/layout\/components\/AiChat\/homeAgentCapabilities$/ }, () => ({
          path: 'registration', namespace: 'product-creation-test',
        }))
        buildApi.onLoad({ filter: /^registration$/, namespace: 'product-creation-test' }, () => ({
          contents: 'export const registerHomeAgentCapabilityProvider = () => () => {}',
          loader: 'js',
        }))
        buildApi.onResolve({ filter: /^\.\.\/\.\.\/\.\.\/api\/product$/ }, () => ({
          path: 'product-api', namespace: 'product-creation-test',
        }))
        buildApi.onLoad({ filter: /^product-api$/, namespace: 'product-creation-test' }, () => ({
          contents: `export const queryProductList = () => { throw new Error('Product guidance must not query or mutate products') }`,
          loader: 'js',
        }))
      },
    }],
  })
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
}

const privateRuntime = await loadProvider('')
const saasRuntime = await loadProvider('saas')
const menu = (code, title = code) => ({ code, title })
const productMenu = menu('device/Product', '产品列表')

function createContext(menus = [productMenu]) {
  return {
    currentRoute: { name: 'device/Product', path: '/resources/devices/products' },
    currentView: 'device/Product',
    capabilities: [],
    menus,
    findMenu(value) { return this.menus.find(item => item.code === value) },
    navigateToMenu() { throw new Error('Guidance must not navigate') },
    navigateToRoute() { throw new Error('Guidance must not navigate') },
  }
}

const creationGuide = (runtime, context) => runtime.provider.getWorkflowGuides(context)
  .find(guide => guide.id === creationGuideId)

test('private product guidance adds a creation flow while retaining product ID resolution and read-only lookup', () => {
  const context = createContext()
  const { provider } = privateRuntime
  assert.ok(creationGuide(privateRuntime, context))
  assert.ok(provider.getWorkflowGuides(context).some(guide => guide.id === 'device-product:resolve-product-id'))
  assert.deepEqual(provider.getClientTools(context).map(tool => [tool.id, tool.annotations.readOnlyHint]), [
    ['device_product_search', true],
  ])
})

test('SaaS keeps existing product guidance without private creation facts', () => {
  for (const language of ['zh', 'en']) {
    saasRuntime.setLocale(language)
    const context = createContext()
    assert.equal(creationGuide(saasRuntime, context), undefined)
    assert.deepEqual(saasRuntime.provider.getSystemPromptLines(context), [messages[language]['Product.homeAgent.prompt.globalSystem']])
    assert.deepEqual(saasRuntime.provider.getWorkflowGuides(context).map(guide => guide.id), ['device-product:resolve-product-id'])
  }
})

test('missing product permission and lookalike menu titles expose no product instructions or tools', () => {
  for (const menus of [[], [menu('other/products', '产品列表')], [menu('iot-user-device-list', '设备列表')]]) {
    const context = createContext(menus)
    assert.deepEqual(privateRuntime.provider.getWorkflowGuides(context), [])
    assert.deepEqual(privateRuntime.provider.getSystemPromptLines(context), [])
    assert.deepEqual(privateRuntime.provider.getClientTools(context), [])
  }
})

test('first-device instructions follow the current authorized device-list identity', () => {
  privateRuntime.setLocale('zh')
  for (const code of ['iot-user-device-list', 'iot-user/device/list', 'device/Instance']) {
    const context = createContext([productMenu, menu(code, '已授权设备入口')])
    let guide = creationGuide(privateRuntime, context)
    assert.equal(guide.steps.length, 4)
    assert.match(guide.steps[3].description, /接入设备/)
    const expectedLink = code === 'device/Instance'
      ? `#menu=${encodeURIComponent(code)}`
      : `#feature=${encodeURIComponent('device-entry:onboarding')}`
    assert.ok(guide.steps[3].description.includes(`](${expectedLink})`))
    assert.ok(privateRuntime.provider.getSystemPromptLines(context).join('\n').includes(`](${expectedLink})`))

    context.menus = [productMenu]
    guide = creationGuide(privateRuntime, context)
    assert.equal(guide.steps.length, 3)
    assert.ok(guide.notes.includes(messages.zh['Product.homeAgent.workflow.createPrivateProduct.noDeviceMenu']))
    assert.ok(privateRuntime.provider.getSystemPromptLines(context).includes(messages.zh['Product.homeAgent.workflow.createPrivateProduct.noDeviceMenu']))
  }
})

test('product permission revocation removes already available creation instructions', () => {
  const context = createContext([productMenu, menu('iot-user-device-list')])
  assert.ok(creationGuide(privateRuntime, context))
  context.menus = [menu('iot-user-device-list')]
  assert.equal(creationGuide(privateRuntime, context), undefined)
  assert.deepEqual(privateRuntime.provider.getSystemPromptLines(context), [])
})

test('localized prompts and workflows use real form types and fully resolve their placeholders', () => {
  for (const language of ['zh', 'en']) {
    privateRuntime.setLocale(language)
    const context = createContext([productMenu, menu('iot-user-device-list', 'Authorized device list')])
    const guide = creationGuide(privateRuntime, context)
    const prompt = privateRuntime.provider.getSystemPromptLines(context).join('\n')
    for (const key of ['Save.index.912481-11', 'Save.index.912481-13', 'Save.index.912481-15']) {
      assert.ok(prompt.includes(messages[language][key]))
    }
    assert.doesNotMatch(JSON.stringify({ guide, prompt }), /Product\.homeAgent\.|\{\d+\}/)
    assert.ok(guide.steps[3].description.includes(messages[language]['IotDeviceList.action.create']))
    // Search keywords intentionally remain bilingual; user-facing guide text must be localized.
    const { keywords, ...localizedGuide } = guide
    if (language === 'en') assert.doesNotMatch(JSON.stringify({ guide: localizedGuide, prompt }), /[\u4e00-\u9fff]/)
  }
})

test('private creation facts cover access stage, table editing, and the zero-device entry', () => {
  privateRuntime.setLocale('zh')
  const context = createContext([productMenu, menu('iot-user-device-list', '设备列表')])
  const guide = creationGuide(privateRuntime, context)
  const prompt = privateRuntime.provider.getSystemPromptLines(context).join('\n')
  assert.match(prompt, /没有接入方式字段/)
  assert.match(prompt, /不要求填写产品 ID/)
  assert.match(prompt, /保存后在产品详情“设备接入”页/)
  assert.match(prompt, /点击“确定”创建产品/)
  assert.match(prompt, /点击其中的“查看详情”进入详情，不会自动跳转/)
  assert.match(prompt, /“物模型”→“属性定义”/)
  assert.match(prompt, /在空白表格行填写.*点击“保存”，没有“新增属性”按钮/)
  assert.match(prompt, /设备数量为 0 时不可点击/)
  assert.match(guide.steps[2].description, /表格行.*标识、名称、数据类型、属性来源.*保存/)
  assert.match(guide.steps[3].description, /不通过设备数量跳转/)
  assert.ok(guide.steps.every(step => !step.tools && !step.capability))
})

test('entry guidance permits details only for explicit requests with a declared workflow', () => {
  assert.match(messages.zh['DeviceFunctionGuidance.prompt'], /明确追问详细步骤且已有对应页面流程/)
  assert.match(messages.zh['DeviceFunctionGuidance.prompt'], /否则详细引导留给目标功能，不推断步骤/)
  assert.match(messages.en['DeviceFunctionGuidance.prompt'], /only when explicitly requested and a matching page workflow is declared/)
  assert.ok(messages.zh['DeviceFunctionGuidance.prompt'].length < 220)
  assert.ok(messages.en['DeviceFunctionGuidance.prompt'].length < 600)
})
