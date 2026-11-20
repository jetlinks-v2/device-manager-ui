import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { createReusableTemplate } from '@vueuse/core'
import { cloneDeep, omit } from 'lodash-es'
import { canManageMetadataGroup, isInheritedMetadataGroup, renameMetadataGroup, removeMetadataGroup } from '../components/Metadata/groupPolicy.ts'

const require = createRequire(import.meta.url)
const root = new URL('../', import.meta.url)
const productFile = 'views/device/Product/index.vue'
const metadataFile = 'views/device/components/Metadata/index.vue'
const baseFile = 'views/device/components/Metadata/Base/Base.vue'
const read = file => readFileSync(new URL(file, root), 'utf8')
const descriptor = file => parse(read(file), { filename: file }).descriptor
const t = key => key

// 从真实页面读取环境判断和操作集合；渲染模板时只替换网络、路由和外围组件。
function binding(file, name, scope) {
  const source = file.endsWith('.ts') ? read(file) : descriptor(file).scriptSetup.content
  const ast = ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true)
  let declaration
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) declaration ??= node
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(declaration, name)
  const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(scope), `const ${code}; return ${name}`)(...Object.values(scope))
}

const pass = vue.defineComponent({ setup: (_, { slots }) => () => vue.h('div', slots.default?.()) })
const button = vue.defineComponent({ inheritAttrs: false, setup: (_, { attrs, slots }) => () => vue.h('button', attrs, slots.default?.()) })
const columns = ['id', 'name', 'valueType', 'other'].map(dataIndex => ({ dataIndex }))
const row = { id: 'temperature', name: 'Temperature', valueType: { type: 'float' }, expands: {}, state: 1, deviceCount: 2 }

function templateComponent(file, context, components = {}) {
  const compiled = compileTemplate({ source: descriptor(file).template.content, filename: file, id: file })
  assert.deepEqual(compiled.errors, [])
  const code = ts.transpileModule(compiled.code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('require', 'exports', code)(require, exports)
  const resolved = Object.fromEntries([...compiled.code.matchAll(/resolveComponent\("([^"]+)"\)/g)].map(([, name]) => [name,
    components[name] || (name === 'a-input' ? { render: () => vue.h('input') }
      : /button/i.test(name) ? button : pass),
  ]))
  return vue.defineComponent({
    components: resolved,
    setup: () => context,
    render: exports.render,
  })
}

async function render(file, context, components = {}, slots) {
  const component = templateComponent(file, context, components)
  const app = vue.createSSRApp({ render: () => vue.h(component, {}, slots) })
  app.config.globalProperties.$t = t
  // 只提供当前分支会读取的状态；不让未定义的旁支字段掩盖渲染错误。
  app.config.warnHandler = () => {}
  return renderToString(app)
}

function productState(isProject) {
  const scope = { isProject, computed: vue.computed, authStore: { hasPermission: () => true } }
  const getActions = binding(productFile, 'getActions', { isProject, inject: () => ({}), $t: t })
  const state = { isProject, getActions, showEmptyCreate: true, hasSearch: false, batchActions: [],
    columns: [], tableParams: {}, categoryTree: [], categoryLoading: false, totalProductCount: 1,
    unclassifiedProductCount: 1, selectedCategoryId: undefined, filterFields: [], commonFilterFields: [], filterTerms: [],
    syncCacheVisible: false, isAdd: 0, title: '', categoryTitle: '', categoryModalMode: 0, categoryModalChildMode: 0,
    exportVisible: false, exporting: false, canViewDevices: true, getI18nText: item => item.name,
    getBrandModel: () => 'Brand / Model',
  }
  for (const name of ['canAddCategory', 'canUpdateCategory', 'canDeleteCategory', 'canImportBasic', 'canImportResourcePackage']) {
    state[name] = binding(productFile, name, scope).value
  }
  return state
}

const productTable = vue.defineComponent({ setup: (_, { slots }) => () => vue.h('section', [
  slots.headerLeftRender?.(), slots.emptyText?.(), slots.name?.(row), slots.deviceCount?.(row), slots.action?.(row),
]) })
const marker = name => ({ render: () => vue.h('button', { 'data-component': name }, name) })

test('SaaS product menu is included in runtime synchronization without changing its identity', () => {
  const walk = menus => menus.flatMap(menu => [menu, ...walk(menu.children || [])])
  const menu = walk(JSON.parse(read('baseMenu.json'))).find(menu => menu.code === 'device/Product')
  assert.equal(menu.runtime, true)
  assert.equal(menu.owner, 'iot')
  assert.equal(menu.url, '/resources/devices/products')
})

test('legacy SaaS product aliases resolve to the shared pages and no longer register a creation route', () => {
  const source = read('../saas-runtime-ui/index.ts')
  const ast = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true)
  const resolve = name => {
    const declaration = ast.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
      .find(node => node.name.getText(ast) === name)
    const code = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
    return new Function('routerModules', `const ${code}; return ${name}`)({})()
  }
  const routes = resolve('getAsyncRoutesMap')
  assert.equal(routes['device/Product'], routes['device/product'])
  assert.equal(routes['device/Product/Detail'], routes['device/product/Detail'])
  assert.match(String(routes['device/Product']), /@device-manager-ui\/views\/device\/Product\/index.vue/)
  assert.match(String(routes['device/Product/Detail']), /@device-manager-ui\/views\/device\/Product\/Detail\/index.vue/)
  assert.equal(resolve('getExtraRoutesMap')['device/Product'], undefined)
})

test('project product list hides creation and transfer while keeping editing, lifecycle and classification', async () => {
  const state = productState(true)
  assert.deepEqual(state.getActions(row).map(action => action.key), ['update', 'action', 'delete'])
  for (const name of ['canAddCategory', 'canUpdateCategory', 'canDeleteCategory']) assert.equal(state[name], true)
  const html = await render(productFile, state, {
    DefineEmptyCreate: { render: () => null }, EmptyCreateButton: marker('create'), JProTable: productTable,
    EqualHeightColumns: { setup: (_, { slots }) => () => vue.h('main', [slots.left?.(), slots.right?.()]) },
    BatchDropdown: marker('batch'), Save: marker('edit'), ResourcePackage: marker('import'),
    ProductExportModal: marker('export'), ModifyModal: marker('classification'),
  })
  assert.doesNotMatch(html, /data-component="(?:create|import|export|batch)"/)
  assert.doesNotMatch(html, /product-page__actions/)
  assert.match(html, /data-component="edit"/)
  assert.match(html, /data-component="classification"/)
  assert.match(html, /Temperature/)
})

test('private product list retains its editing, transfer, lifecycle and category permissions', () => {
  const state = productState(false)
  assert.deepEqual(state.getActions(row).map(action => action.key), ['update', 'export', 'action', 'delete'])
  for (const name of ['canAddCategory', 'canUpdateCategory', 'canDeleteCategory', 'canImportBasic', 'canImportResourcePackage']) {
    assert.equal(state[name], true)
  }
})

test('product entry policy distinguishes admin, project and private deployment', () => {
  for (const [projectRuntime, privateDeployment, expected] of [[false, false, false], [true, false, true], [true, true, false]]) {
    for (const file of [productFile, 'views/device/Product/Save/index.vue', 'views/device/Product/Detail/DeviceAccess/index.vue', 'views/device/Product/Detail/MetadataMap/index.vue']) {
      const isProject = binding(file, 'isProject', { isProjectRuntime: () => projectRuntime, isPrivateDeployment: () => privateDeployment })
      assert.equal(isProject, expected, file)
    }
  }
})

test('restored product editing still respects existing permissions', () => {
  for (const isProject of [true, false]) {
    const scope = { isProject, computed: vue.computed, authStore: { hasPermission: () => false } }
    for (const name of ['canAddCategory', 'canUpdateCategory', 'canDeleteCategory', 'canImportBasic', 'canImportResourcePackage']) {
      assert.equal(binding(productFile, name, scope).value, false)
    }
    const updatePermission = binding(metadataFile, 'updatePermission', { props: { type: 'product' }, permission: vue.ref('device/Product'), ...scope })
    assert.equal(updatePermission.value, false)
    assert.equal(binding(metadataFile, 'readonly', { updatePermission, computed: vue.computed }).value, true)
    assert.equal(binding('views/device/Product/Detail/DataAnalysis/useProductDataAnalysis.ts', 'canUpdate', {
      computed: vue.computed, permissionStore: { hasPermission: () => false },
    }).value, false)
  }
})

test('metadata editing follows permission for products and devices in both project and admin', async () => {
  for (const [isProject, type, expected] of [[true, 'product', false], [true, 'device', false], [false, 'product', false]]) {
    const readonly = binding(metadataFile, 'readonly', { updatePermission: vue.ref(true), computed: vue.computed }).value
    assert.equal(readonly, expected)
    const html = await render(metadataFile, { type, readonly, tabActiveKey: 'properties', updatePermission: true, showReset: type === 'device',
      visible: false, cat: false, content: null,
    }, {
      DeviceDetailTabs: { setup: (_, { slots }) => () => vue.h('div', [slots.rightExtra?.(), slots.default?.()]) },
      BaseMetadata: { props: ['readonly'], setup: props => () => vue.h('span', { 'data-readonly': String(props.readonly) }) },
    })
    assert.equal(html.includes('Metadata.index.838029-3'), !readonly && type === 'product')
    assert.equal(html.includes('Metadata.index.838029-4'), !readonly)
    assert.equal((html.match(/data-readonly="true"/g) || []).length, readonly ? 4 : 0)
  }
})

test('readonly metadata reuses the configuration cell without editable fields, save or import buttons', async () => {
  const [DefineOtherSetting, OtherSettingCell] = createReusableTemplate()
  const editTable = { props: ['readonly'], setup: (props, { slots }) => () => vue.h('div', [
    slots.extra?.({ isFullscreen: false, fullScreenToggle() {} }),
    ...columns.map(column => props.readonly ? slots.readonly?.({ record: row, column }) : slots[column.dataIndex]?.({ record: row, index: 0 })),
  ]) }
  const html = await render(baseFile, {
    readonly: true, heavyLoad: false, dataSource: [row], columns, type: 'properties', target: 'product', _target: 'product',
    selectedRowKeys: [], hasOperate: () => false, searchData: { show: false }, copyDetail: {}, permission: false,
    loading: false, detailData: { visible: false }, effectiveDataLength: 1, props: { type: 'properties', target: 'product' },
    readonlyValue: (record, field) => field === 'valueType' ? record.valueType.type : record[field],
  }, { EditTable: editTable, Import: marker('import'), EditTableFormItem: pass, DefineOtherSetting, OtherSettingCell,
    OtherSetting: { props: ['readonly', 'disabled'], setup: props => () => vue.h('button', { 'data-readonly': String(props.readonly), disabled: props.disabled }, 'Properties.OtherSetting.237457-18') },
  })
  assert.match(html, /Temperature/)
  assert.match(html, /float/)
  assert.match(html, /Properties.OtherSetting.237457-18/)
  assert.match(html, /data-readonly="true"/)
  assert.doesNotMatch(html, /Product.index.660348-12|disabled=""/)
  assert.doesNotMatch(html, /<input|key="update"|data-component="import"/)
})

test('readonly body slots replace input cells and readonly groups hide action dropdowns', async () => {
  const state = {
    dataSource: [row], virtualData: [row], columns, readonly: true, height: 300, cellHeight: 50,
    style: {}, tableStyle: {}, containerStyle: {}, virtualRang: { start: 0 }, selectedRowKeys: [], rowKey: 'id',
  }
  const html = await render('components/Metadata/body.vue', state)
  assert.match(html, /readonly-mask/)
  const text = await render('components/Metadata/body.vue', state, {}, {
    readonly: ({ record }) => vue.h('span', record.name),
    name: () => vue.h('input'),
  })
  assert.match(text, /Temperature/)
  assert.doesNotMatch(text, /readonly-mask|<input/)
  const groups = await render('components/Metadata/group.vue', {
    canManageMetadataGroup,
    readonly: true, target: 'product', myActiveKey: 'default', options: [{ value: 'default', label: 'Default', effective: 1 }],
    errorMap: {}, visible: false,
  }, {
    'a-tabs': pass, 'a-tab-pane': { setup: (_, { slots }) => () => vue.h('section', slots.tab?.()) },
    'a-dropdown': marker('group-actions'), 'a-modal': { render: () => null },
  })
  assert.match(groups, /Default/)
  assert.doesNotMatch(groups, /data-component="group-actions"/)
})

test('device metadata group commands preserve inherited definitions and mark local group changes unsaved', () => {
  const dataSource = vue.ref([
    { id: 'product', expands: { groupId: 'product-group', groupName: 'Product', isProduct: true } },
    { id: 'device', expands: { groupId: 'device-group', groupName: 'Device' } },
  ])
  const editStatus = vue.ref(false)
  const context = { props: { readonly: false }, hasMetadataUpdatePermission: () => true, dataSource, editStatus,
    _target: 'device', $t: t, isInheritedMetadataGroup, renameMetadataGroup, removeMetadataGroup }
  const rename = binding(baseFile, 'groupEdit', context)
  const remove = binding(baseFile, 'groupDelete', context)
  const inherited = structuredClone(vue.toRaw(dataSource.value[0]))
  rename({ oldValue: 'product-group', value: 'product-group', label: 'Changed' })
  remove('product-group')
  assert.deepEqual(vue.toRaw(dataSource.value[0]), inherited)
  assert.equal(editStatus.value, false)
  rename({ oldValue: 'device-group', value: 'device-group', label: 'Custom' })
  assert.equal(dataSource.value[1].expands.groupName, 'Custom')
  assert.equal(editStatus.value, true)
  editStatus.value = false
  remove('device-group')
  assert.equal(dataSource.value.length, 1)
  assert.equal(dataSource.value[0].id, 'product')
  assert.equal(editStatus.value, true)
})

test('project and admin detail keep basic editing, deletion and lifecycle controls', async () => {
  for (const isProject of [true, false]) {
    const html = await render('views/device/Product/Detail/index.vue', {
      isProject, productStore: { current: row }, permissionStore: { hasPermission: () => true },
      canViewDevices: true, activeTab: 'Device', tabOptions: [], tabs: {},
    }, {
      Save: marker('edit'),
      ProductDetailSummary: {
        props: ['canUpdate', 'canDelete', 'canAction', 'showLifecycle'],
        setup: props => () => vue.h('div', {
          'data-edit': String(props.canUpdate), 'data-delete': String(props.canDelete), 'data-lifecycle': String(props.showLifecycle !== false),
        }),
      },
    })
    assert.match(html, /data-edit="true"/)
    assert.match(html, /data-delete="true"/)
    assert.match(html, /data-lifecycle="true"/)
    assert.equal(html.includes('data-component="edit"'), true)
  }
})

test('SaaS device access hides the save button while private deployment retains it', async () => {
  for (const isProject of [true, false]) {
    const html = await render('views/device/Product/Detail/DeviceAccess/index.vue', {
      isProject, accessError: false, accessLoading: false, access: { id: 'gateway-1' },
      permissionStore: { hasPermission: () => true }, productStore: { current: row },
      form: { storePolicy: 'default' }, formData: { data: {} }, productData: {}, productTypes: [],
      metadata: [], dataSource: [], storageList: [{ id: 'default', name: 'Default' }],
      submitLoading: false, metadataVisible: false, visible: false,
      getI18nText: () => 'Gateway',
    }, { Title: { setup: (_, { slots }) => () => vue.h('header', slots.extra?.()) } })
    assert.equal(html.includes('product-device-access__save'), !isProject)
    assert.equal(html.includes('product-device-access__change'), !isProject)
  }
})

test('changed Vue components compile their scripts and templates', () => {
  for (const file of [productFile, metadataFile, baseFile, 'views/device/Product/Detail/index.vue', 'views/device/Product/Detail/DeviceAccess/index.vue', 'components/Metadata/body.vue', 'components/Metadata/group.vue', 'components/Metadata/components/Popover/index.vue',
    'views/device/components/Metadata/Base/components/Properties/OtherSetting.vue',
    'views/device/components/Metadata/Base/components/Properties/Metrics/Metrics.vue',
    'views/device/Product/Detail/DataAnalysis/index.vue',
    'views/device/Product/Detail/DeviceAccess/ProductAccessFields.vue',
    'views/device/Product/Detail/components/ProductDetailSummary.vue',
    'views/device/Product/Detail/components/ProductAlarmConfigTab.vue',
    'views/device/Product/Detail/MetadataMap/index.vue']) {
    const current = descriptor(file)
    assert.ok(compileScript(current, { id: file }).content)
    assert.deepEqual(compileTemplate({ source: current.template.content, filename: file, id: file }).errors, [])
  }
})


function loadHook(file, dependencies) {
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => {
    assert.ok(name in dependencies, `Missing dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}

test('readonly metadata configuration cannot emit changes or save metrics, and opens an isolated copy', async () => {
  const calls = []
  const original = { nested: { value: 1 }, isKeyMetric: true }
  const { usePropertyOtherSettings } = loadHook('views/device/components/Metadata/Base/components/Properties/usePropertyOtherSettings.ts', {
    vue: { ...vue, inject: () => 'product' },
    'vue-i18n': { useI18n: () => ({ t }) },
    'lodash-es': { cloneDeep, omit },
    '../../../../../../../store/product': { useProductStore: () => ({ current: { id: 'product' } }) },
    '../../../../../../../store/instance': { useInstanceStore: () => ({ current: {} }) },
    '../../../../../../../api/product': { getMetadataConfig: async () => ({ success: true, result: [] }) },
    '../../../../../../../components/Metadata/context': { useTableWrapper: () => null },
    './hooks': { useMetrics: () => ({ metrics: vue.ref([]), metricsQuery: () => calls.push('query'), metricsUpdate: () => calls.push('write') }) },
  })
  const scope = vue.effectScope()
  const settings = scope.run(() => usePropertyOtherSettings({ readonly: true, target: 'product', id: 'temperature', type: 'float',
    metadataType: 'properties', value: original, record: row }, (...args) => calls.push(args)))
  settings.metricsRef.value = { getData: () => { calls.push('validate'); return [] } }
  assert.equal(await settings.confirm(), false)
  assert.deepEqual(calls, [])
  settings.modalVisible.value = true
  await vue.nextTick()
  settings.configValue.value.nested.value = 2
  assert.equal(original.nested.value, 1)
  assert.equal(original.isKeyMetric, true)
  scope.stop()
})

test('metadata configuration popup keeps the existing button and hides confirmation and editable content in readonly mode', async () => {
  const file = 'views/device/components/Metadata/Base/components/Properties/OtherSetting.vue'
  for (const readonly of [true, false]) {
    const html = await render(file, { readonly, disabled: false, props: { isProduct: false }, target: 'product',
      modalVisible: true, showContent: true, visible: true, activeKey: [], config: [{ properties: [{ property: 'precision', type: { type: 'int' } }] }],
      columns: [], configValue: { precision: 2, isKeyMetric: true }, showMetrics: true, metrics: [], booleanOptions: [], showKeyProperty: true,
      _disabled: () => false, getOptions: () => [], settingValue: () => '2',
    }, {
      'a-modal': { setup: (_, { slots }) => () => vue.h('div', [slots.default?.(), slots.footer ? slots.footer() : [vue.h('button', { 'data-confirm': true }), vue.h('button', { 'data-cancel': true }, 'Popover.index.047673-0')]]) },
      'a-table': { setup: (_, { slots }) => () => slots.bodyCell?.({ column: { dataIndex: 'value' }, record: { property: 'precision' }, index: 0 }) },
      'j-value-item': marker('editable-value'), CardItem: marker('editable-key-property'),
      Metrics: { props: ['readonly'], setup: props => () => vue.h('span', { 'data-readonly-metrics': String(props.readonly) }) },
    })
    assert.match(html, /Properties.OtherSetting.237457-18/)
    assert.equal(html.includes('data-confirm'), !readonly)
    assert.equal(html.includes('data-cancel'), !readonly)
    assert.match(html, readonly ? /IotDeviceDetail.common.close/ : /Popover.index.047673-0/)
    assert.equal(html.includes('editable-value'), !readonly)
    assert.equal(html.includes('editable-key-property'), !readonly)
    assert.match(html, new RegExp(`data-readonly-metrics="${readonly}"`))
  }
})

test('product parsing preserves scripts and JSON providers and supplies a template when absent', async () => {
  for (const isProject of [true, false]) {
    let response
    const { useProductCodec } = loadHook('views/device/Product/Detail/DataAnalysis/useProductCodec.ts', {
      vue, '../../../../../api/instance': { productCode: async () => response },
      '@jetlinks-web-core/utils/consts': { isProject },
    })
    const state = useProductCodec(() => 'product', 'default-template')
    response = { status: 200, result: { provider: 'jsr223', configuration: { script: 'codec.onUpstream(handler)' } } }
    await state.getProductCode()
    assert.equal(state.editorValue.value, 'codec.onUpstream(handler)')
    response = { status: 200, result: { provider: 'modbus', configuration: { mapping: { address: 12 } } } }
    await state.getProductCode()
    assert.deepEqual(JSON.parse(state.editorValue.value), response.result.configuration)
    assert.equal(state.editorLanguage.value, 'json')
    state.editorValue.value = JSON.stringify({ mapping: { address: 13 } })
    assert.deepEqual(state.buildProductCode(), { provider: 'modbus', configuration: { mapping: { address: 13 } } })
    state.editorValue.value = '[]'
    assert.throws(() => state.buildProductCode())
    response = { status: 200, result: null }
    await state.getProductCode()
    assert.equal(state.editorValue.value, 'default-template')
    response = { status: 500 }
    await state.getProductCode()
    assert.equal(state.codecFailed.value, true)
    assert.equal(state.codecLoading.value, false)
    assert.equal(state.editorValue.value, '')
  }
})

test('product parsing editor and test/save actions are available in project and admin', async () => {
  const file = 'views/device/Product/Detail/DataAnalysis/index.vue'
  const debugPanel = vue.defineComponent({
    props: ['state', 'topic', 'url', 'payload'],
    setup: props => () => vue.h(templateComponent('views/device/components/CodecDebugPanel.vue', props)),
  })
  for (const isProject of [true, false]) {
    const canUpdate = binding('views/device/Product/Detail/DataAnalysis/useProductDataAnalysis.ts', 'canUpdate', { isProject, computed: vue.computed, permissionStore: { hasPermission: () => true } }).value
    const html = await render(file, { isProject, canUpdate, codec: { provider: 'jsr223' }, codecFailed: false, codecLoading: false,
      codecMenuItems: [{ value: 'jsr223', label: 'IotDeviceDetail.parsing.javascriptLabel' }], typeDescription: '', editorLanguage: 'javascript', editorValue: 'library-script', typescriptTip: {}, loading: false, saving: false, isDisabled: false, saveDisabled: false, isDirty: false,
      productStore: { current: { transportProtocol: 'MQTT' } }, topicList: [], resStyle: {}, result: '', simulation: '', topic: '',
    }, { CodecDebugPanel: debugPanel, 'a-select': { props: ['value'], setup: (props, { slots }) => () => vue.h('select', { 'data-codec-type': props.value }, slots.default?.()) }, 'monaco-editor': { props: ['readOnly', 'modelValue'], setup: props => () => vue.h('pre', { 'data-readonly-editor': String(props.readOnly) }, props.modelValue) } })
    assert.match(html, /library-script/)
    assert.match(html, /JavaScript \(ECMAScript 5\)/)
    assert.match(html, /data-readonly-editor="false"/)
    assert.equal(html.includes('IotDeviceDetail.scriptCodec.debug'), true)
    assert.equal(html.includes('IotDeviceDetail.parsing.saveConfig'), true)
    assert.equal(html.includes('class="codec-debug"'), true)
  }
})

test('SaaS and private product rules use product edit permission and retain product-wide scope', () => {
  for (const isProject of [true, false]) {
    const scope = binding('views/device/Product/Detail/components/ProductAlarmConfigTab.vue', 'scope', {
      isProject, computed: vue.computed, store: { current: { id: 'product', name: 'Product' } },
    }).value
    assert.equal(scope.productId, 'product')
    assert.equal(scope.canUpdate, undefined)
    assert.equal(scope.deviceId, undefined)
    for (const allowed of [true, false]) {
      const permission = { hasPermission: code => allowed && code === 'device/Product:update' }
      for (const file of ['views/device/components/PropertyRules/usePropertyRules.ts', 'views/device/components/PropertyRules/usePropertyRuleEditor.ts']) {
        const canSave = binding(file, 'canSave', { props: { scope }, permission, computed: vue.computed })
        assert.equal(canSave.value, allowed, `${file} preserves product permission checks`)
      }
    }
  }
})


test('SaaS mapping inspection neither saves changes nor auto-saves defaults when leaving', async () => {
  const file = 'views/device/Product/Detail/MetadataMap/index.vue'
  const source = descriptor(file).scriptSetup.content
  const ast = ts.createSourceFile('map.ts', source, ts.ScriptTarget.Latest, true)
  const unmount = ast.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(ast) === 'onUnmounted')
  const code = ts.transpileModule(unmount.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const isProject of [true, false]) {
    const writes = []
    const onMapData = binding(file, 'onMapData', { isProject, productDetail: { value: { id: 'product' } },
      metadataMapById: async (...args) => { writes.push(args); return { success: true } },
    })
    await onMapData([{ metadataId: 'temperature' }])
    assert.equal(writes.length, isProject ? 0 : 1)
    let leave
    new Function('isProject', 'onUnmounted', '_delTag', 'dataSourceCache', 'onMapData', code)(isProject, fn => { leave = fn },
      { value: true }, { value: [{ id: 'temperature', plugin: 'original-temperature' }] }, onMapData)
    await leave()
    assert.equal(writes.length, isProject ? 0 : 2)
  }
})

test('readonly metric rows hide add/delete and render values without editors', async () => {
  const file = 'views/device/components/Metadata/Base/components/Properties/Metrics/Metrics.vue'
  const newColumns = binding(file, 'newColumns', { props: { readonly: true, type: 'boolean' }, computed: vue.computed,
    columns: [{ dataIndex: 'id' }, { dataIndex: 'value' }, { dataIndex: 'action' }],
  }).value
  assert.deepEqual(newColumns.map(column => column.dataIndex), ['id', 'value'])
  const html = await render(file, { readonly: true, newColumns, dataSource: [] }, {
    EditTable: { props: ['readonly', 'columns'], setup: (props, { slots }) => () => vue.h('div',
      props.columns.map(column => slots.readonly?.({ record: { id: 'normal', value: 0 }, column }))) },
  })
  assert.match(html, /normal/)
  assert.match(html, /0/)
  assert.doesNotMatch(html, /<button|<input/)
})

test('product summary hides lifecycle controls without hiding status or device navigation', async () => {
  const file = 'views/device/Product/Detail/components/ProductDetailSummary.vue'
  for (const showLifecycle of [true, false]) {
    const html = await render(file, { showLifecycle, product: row, name: 'Temperature', canAction: true, canUpdate: false, canDelete: false,
      deviceType: 'Device', classification: 'Classification', hasDevices: true, canViewDevices: true,
    }, {
      DetailHeader: { setup: (_, { slots }) => () => vue.h('header', [slots.titleExtra?.(), slots.meta?.(), slots.actions?.()]) },
      DetailMetaItem: pass,
      StatusTag: marker('status'),
    })
    assert.match(html, /data-component="status"/)
    assert.equal(html.includes('Detail.index.478940-3'), showLifecycle)
  }
})


test('readonly configuration close button invokes the existing cancel path and hides the mask without confirming', async () => {
  const file = 'components/Metadata/components/Popover/index.vue'
  const events = [], visibility = [], clicks = []
  const state = { visible: true, showCancel: true, showOk: false, cancelText: 'Close', placement: 'bottomRight', warpClassNames: 'test' }
  state.cancel = binding(file, 'cancel', { emit: event => events.push(event), visibleChange: visible => { visibility.push(visible); state.visible = visible } })
  state.submit = () => events.push('ok')
  const html = await render(file, state, {
    'a-popover': { setup: (_, { slots }) => () => vue.h('section', slots.content?.()) },
    'a-button': { setup: (_, { attrs, slots }) => { clicks.push(attrs.onClick); return () => vue.h('button', slots.default?.()) } },
  })
  assert.match(html, /Close/)
  assert.equal(clicks.length, 1)
  clicks[0]()
  assert.deepEqual(events, ['cancel'])
  assert.deepEqual(visibility, [false])
  assert.equal(state.visible, false)
})
