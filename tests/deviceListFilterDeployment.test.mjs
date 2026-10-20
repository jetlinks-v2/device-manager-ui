import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'
import test from 'node:test'
import { build, transform } from 'esbuild'
import { parse } from 'vue/compiler-sfc'
import { effectScope, nextTick, reactive, ref, watch } from 'vue'
import ts from 'typescript'

const moduleRoot = fileURLToPath(new URL('../', import.meta.url))
const coreRoot = fileURLToPath(new URL('../../../jetlinks-web-core/src/', import.meta.url))
const messages = JSON.parse(await readFile(new URL('../locales/lang/zh.json', import.meta.url), 'utf8'))

async function loadDeployment(environment, { community = false, hasDepartmentMenu = true } = {}) {
  const result = await build({
    stdin: {
      contents: `export * from './deviceListFilter.ts'; export * from '${coreRoot}components/ConditionFilter/utils.ts'; export { findOptionPathByValue } from '${coreRoot}components/ConditionFilter/option-display.ts'; export { calls } from 'search-fixtures'`,
      resolveDir: moduleRoot,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    banner: { js: 'const window = { btoa: globalThis.btoa, atob: globalThis.atob };' },
    define: { 'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(environment) },
    plugins: [{
      name: 'device-search-boundaries',
      setup(plugin) {
        plugin.onResolve({ filter: /^vue$/ }, () => ({ path: import.meta.resolve('vue'), external: true }))
        plugin.onResolve({ filter: /^@jetlinks-web-core\/components\/ConditionFilter$/ }, () => ({ path: `${coreRoot}components/ConditionFilter/utils.ts` }))
        plugin.onResolve({ filter: /^@jetlinks-web-core\/utils\/deployment$/ }, () => ({ path: `${coreRoot}utils/deployment.ts` }))
        plugin.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'locales', namespace: 'search-fixture' }))
        plugin.onResolve({ filter: /^@jetlinks-web-core\/store\/menu$/ }, () => ({ path: 'menu', namespace: 'search-fixture' }))
        plugin.onResolve({ filter: /^@jetlinks-web-core\/utils\/utils$/ }, () => ({ path: 'edition', namespace: 'search-fixture' }))
        plugin.onResolve({ filter: /^@jetlinks-web\/utils$/ }, () => ({ path: 'random', namespace: 'search-fixture' }))
        plugin.onResolve({ filter: /^(\.\/api\/(device|product|category)|search-fixtures)$/ }, () => ({ path: 'api', namespace: 'search-fixture' }))
        plugin.onResolve({ filter: /TagSearch\.vue$/ }, () => ({ path: 'tag-editor', namespace: 'search-fixture' }))
        plugin.onLoad({ filter: /.*/, namespace: 'search-fixture' }, ({ path }) => ({ contents: {
          locales: `const messages = ${JSON.stringify(messages)}; export default {global: {t: key => messages[key] || key}}`,
          edition: `export const isNoCommunity = ${!community}`,
          menu: `export const useMenuStore = () => ({ hasMenu: code => code === 'system/Department' && ${hasDepartmentMenu} })`,
          random: 'export const randomString = () => Math.random().toString(36).slice(2)',
          'tag-editor': 'export default {}',
          api: `export const calls = [];
            export const queryNoPagingPost = async data => { calls.push(['product', data]); return {result: [{id: 'p1', name: 'Product', i18nName: '产品一'}]} };
            export const queryGatewayList = async data => { calls.push(['gateway', data]); return {result: [{id: 'g1', name: 'MQTT 接入'}]} };
            export const queryTree = async data => { calls.push(['category', data]); return {result: [{id: 'c1', name: '分类', children: [{id: 'c2', name: '子分类'}]}]} };
            export const queryOrgThree = async data => { calls.push(['organization', data]); return {result: [{id: 'org1', name: '一级组织', children: [{id: 'org2', name: '二级组织'}]}]} };
            export const queryDeviceProductById_api = async id => { calls.push(['product-detail', id]); return {id, name: '历史产品'} };`,
        }[path], loader: 'js' }))
      },
    }],
  })
  const directory = await mkdtemp(join(tmpdir(), 'device-list-filter-'))
  try {
    const bundlePath = join(directory, 'contract.mjs')
    await writeFile(bundlePath, result.outputFiles[0].text)
    return await import(pathToFileURL(bundlePath).href)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('SaaS keeps five fields and offers distinct device types and access providers', async () => {
  const api = await loadDeployment('saas')
  const products = [
    { templateId: 't1', productId: 'p1', productName: '产品一', accessProvider: 'mqtt', accessName: 'MQTT' },
    { templateId: 't2', productId: 'p2', productName: '产品二', accessProvider: 'mqtt', accessName: 'MQTT' },
  ]
  const fields = api.getDeviceListFilterFields([], [], products)
  assert.deepEqual(fields.map(field => field.dataIndex), ['name', 'id', 'deviceType', 'accessProvider', 'productId'])
  const deviceType = fields.find(field => field.dataIndex === 'deviceType').search
  assert.equal(deviceType.type, 'select')
  assert.equal(deviceType.defaultTermType, 'eq')
  assert.deepEqual(deviceType.options.map(option => option.value), ['device', 'childrenDevice', 'gateway'])
  const access = fields.find(field => field.dataIndex === 'accessProvider').search
  assert.equal(access.type, 'select')
  assert.deepEqual(access.options, [{ label: 'MQTT', value: 'mqtt' }])
  assert.deepEqual(await fields[4].search.optionPanel.loadSelectedOptions(['p1', 'retired']), [
    { label: '产品一', value: 'p1' }, { label: '历史产品', value: 'retired' },
  ])
})

test('only an empty environment enables the complete private field set', async () => {
  const api = await loadDeployment('')
  const fields = api.getDeviceListFilterFields()
  assert.deepEqual(fields.map(field => field.dataIndex), [
    'id', 'name', 'productId', 'createTime', 'state', 'classifiedId', 'accessId', 'deviceType', 'id$dim-assets', 'id$dev-tag', 'description',
  ])
  assert.equal(fields.find(field => field.dataIndex === 'id').search.defaultTermType, 'eq')
  assert.equal(fields.find(field => field.dataIndex === 'createTime').search.type, 'date')
  assert.equal(fields.find(field => field.dataIndex === 'classifiedId').search.type, 'treeSelect')
  assert.deepEqual(fields.find(field => field.dataIndex === 'state').search.options.map(option => option.value), ['notActive', 'offline', 'online'])
  assert.equal((await loadDeployment('cloud')).getDeviceListFilterFields().length, 5)
})

test('organization filtering follows the private edition and menu boundaries', async () => {
  for (const [environment, options, expected] of [
    ['', {}, true],
    ['', { community: true }, false],
    ['', { hasDepartmentMenu: false }, false],
    ['saas', {}, false],
    ['cloud', {}, false],
  ]) {
    const api = await loadDeployment(environment, options)
    assert.equal(api.getDeviceListFilterFields().some(field => field.dataIndex === 'id$dim-assets'), expected)
  }
})

test('private organization trees round-trip selected paths and query device asset bindings', async () => {
  const api = await loadDeployment('')
  const fields = api.getDeviceListFilterFields()
  const organization = fields.find(field => field.dataIndex === 'id$dim-assets')
  assert.equal(organization.title, '所属组织')
  assert.equal(organization.search.type, 'treeSelect')
  assert.equal(organization.search.defaultTermType, 'eq')
  assert.deepEqual(organization.search.termOptions, ['eq'])
  const options = await organization.search.options()
  assert.deepEqual(api.calls.at(-1), ['organization', { paging: false }])
  const selectedValue = options[0].children[0].value
  assert.deepEqual(JSON.parse(selectedValue), { assetType: 'device', targets: [{ type: 'org', id: 'org2' }] })
  const query = api.encodeConditionFilterQuery([{ terms: [
    { column: 'deviceType', termType: 'eq', value: 'device' },
    { column: organization.dataIndex, termType: 'eq', value: selectedValue, type: 'or' },
  ] }], fields)
  const selected = api.decodeConditionFilterQuery(query, fields)[0].terms[1]
  assert.equal(selected.column, organization.dataIndex)
  assert.equal(selected.value, selectedValue)
  assert.equal(api.findOptionPathByValue(options, selected.value).map(option => option.label).join('/'), '一级组织/二级组织')
  const term = api.getDeviceListSearchTerms(query)[0].terms[1]
  assert.equal(term.column, 'id$dim-assets')
  assert.equal(Object.hasOwn(term, 'termType'), false)
  assert.equal(term.type, 'or')
  assert.equal(term.value, selectedValue)
})

test('private products and gateways search remotely and recover selected labels; categories keep their tree', async () => {
  const api = await loadDeployment('')
  const fields = api.getDeviceListFilterFields()
  const productPanel = fields.find(field => field.dataIndex === 'productId').search.optionPanel
  assert.deepEqual(await productPanel.loadOptions('产品'), [{ label: '产品一', value: 'p1' }])
  assert.deepEqual(api.calls.at(-1), ['product', { paging: false, terms: [{ column: 'name', termType: 'like', value: '%产品%' }] }])
  await productPanel.loadSelectedOptions(['p1'])
  assert.deepEqual(api.calls.at(-1)[1].terms, [{ column: 'id', termType: 'in', value: ['p1'] }])
  const accessPanel = fields.find(field => field.dataIndex === 'accessId').search.optionPanel
  assert.deepEqual(await accessPanel.loadOptions('MQTT'), [{ label: 'MQTT 接入', value: 'g1' }])
  assert.equal(api.calls.at(-1)[0], 'gateway')
  await accessPanel.loadSelectedOptions(['g1'])
  assert.deepEqual(api.calls.at(-1)[1].terms, [{ column: 'id', termType: 'in', value: ['g1'] }])
  assert.deepEqual(await fields.find(field => field.dataIndex === 'classifiedId').search.options(), [
    { label: '分类', value: 'c1', children: [{ label: '子分类', value: 'c2' }] },
  ])
})

test('private URL conditions preserve product relations, tag logic, dates and the description alias', async () => {
  const api = await loadDeployment('')
  const fields = api.getDeviceListFilterFields()
  const tags = [
    { column: 'id$dev-tag', type: 'and', value: [{ key: 'zone', value: 'A' }] },
    { column: 'id$dev-tag', type: 'or', value: [{ key: 'zone', value: 'B' }] },
  ]
  const input = [{ terms: [
    { column: 'classifiedId', termType: 'in', value: ['c2'] },
    { column: 'accessId', termType: 'eq', value: 'g1', type: 'or' },
    { column: 'description', termType: 'like', value: '测试' },
    { column: 'id$dev-tag', termType: 'eq', value: tags },
    { column: 'createTime', termType: 'btw', value: [1000, 2000] },
  ] }]
  const query = api.encodeConditionFilterQuery(input, fields)
  const decoded = api.decodeConditionFilterQuery(query, fields)
  assert.equal(decoded[0].terms[2].column, 'description')
  assert.equal(decoded[0].terms[2].value, '测试')
  const terms = api.getDeviceListSearchTerms(query)[0].terms
  assert.equal(terms[0].column, 'productId$product-info')
  assert.deepEqual(terms[0].value, [{ column: 'classifiedId', termType: 'in', value: ['c2'] }])
  assert.equal(terms[1].type, 'or')
  assert.deepEqual(terms[1].value, [{ column: 'accessId', termType: 'eq', value: 'g1' }])
  assert.equal(terms[2].column, 'describe')
  assert.equal(terms[2].value, '%测试%')
  assert.equal(terms[3].terms.length, 2)
  assert.equal(terms[3].terms[1].type, 'or')
  assert.deepEqual(terms[3].terms[1].value, [{ key: 'zone', value: 'B' }])
  assert.deepEqual(terms[4].value, [1000, 2000])
  assert.equal(fields.find(field => field.dataIndex === 'id$dev-tag').search.formatValuePreview(tags), 'zone: A、zone: B')
  assert.deepEqual(api.getDeviceListSearchTerms(undefined), [])
})

test('SaaS selection queries use enum values and the product access-provider relation', async () => {
  const api = await loadDeployment('saas')
  const fields = api.getDeviceListFilterFields()
  const query = api.encodeConditionFilterQuery([
    { column: 'deviceType', termType: 'eq', value: 'childrenDevice' },
    { column: 'accessProvider', termType: 'eq', value: 'mqtt' },
  ], fields)
  const terms = api.getDeviceListSearchTerms(query)
  assert.equal(terms[0].column, 'deviceType')
  assert.equal(terms[0].value, 'childrenDevice')
  assert.equal(terms[0].termType, 'eq')
  assert.equal(terms[1].column, 'productId$product-info')
  assert.deepEqual(terms[1].value, [{ column: 'accessProvider', termType: 'eq', value: 'mqtt' }])
})

test('the reused tag editor replays more than three tags, emits its value and resets when cleared', async () => {
  const source = await readFile(new URL('../views/device/Instance/components/TagSearch.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const file = ts.createSourceFile('TagSearch.js', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const statements = file.statements.filter(node => (
    ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(file) === 'submitSearch')
  ) || (
    ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(file) === 'watch'
  ))
  const { code } = await transform(statements.map(node => node.getText(file)).join('\n'), { loader: 'js' })
  const props = reactive({ value: Array.from({ length: 4 }, (_, index) => ({ column: 'id$dev-tag', value: [{ key: 'zone', value: String(index) }], type: index ? 'or' : 'and' })) })
  const formData = reactive({ list: [] }), events = []
  const context = { props, formData, watch, listCache: ref([]), randomString: () => Math.random().toString(36), cloneDeep: value => JSON.parse(JSON.stringify(value)), formRef: ref({ validateFields: async () => ({}) }), visible: ref(true), emit: (...args) => events.push(args) }
  const scope = effectScope()
  const submit = scope.run(() => new vm.Script(`${code}\nsubmitSearch`).runInNewContext(context))
  try {
    assert.equal(formData.list.length, 4)
    assert.equal(formData.list[3].value, '3')
    await submit()
    assert.equal(events[1][0], 'change')
    assert.equal(events[1][1].length, 4)
    assert.deepEqual(JSON.parse(JSON.stringify(events[1][1])), JSON.parse(JSON.stringify(props.value)))
    props.value = []
    await nextTick()
    assert.equal(formData.list.length, 3)
    assert.equal(formData.list.every(item => item.key === undefined && item.value === undefined), true)
  } finally {
    scope.stop()
  }
})
