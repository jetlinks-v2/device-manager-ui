import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { computed, ref } from 'vue'
import { parse } from 'vue/compiler-sfc'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('../views/device/list/unified/useUnifiedDeviceBatchNavigation.ts')
const page = read('../views/device/list/unified/index.vue')
const flatten = menus => menus.flatMap(menu => [menu, ...flatten(menu.children ?? [])])
const menuTree = () => JSON.parse(read('../baseMenu.json'))
const listMenu = menus => flatten(menus).find(menu => menu.code === 'iot-user-device-list')
const permission = 'iot-user-device-list:algorithms'

function fixture(initialGrants = [], initialType = 'gateway', hasMenu = true) {
  const grants = ref(initialGrants)
  const menuPresent = ref(hasMenu)
  const activeType = ref(initialType)
  const selected = ref([])
  const searchTerms = ref([])
  const calls = []
  const query = { type: initialType, projectId: 'project', q: 'previous-filter' }
  const imports = {
    vue: { computed },
    'vue-router': { useRoute: () => ({ query }) },
    '@jetlinks-web-core/store': {
      useMenuStore: () => ({
        hasMenu: code => code === 'algorithm-center' && menuPresent.value,
        jumpPage: (...args) => calls.push(args),
      }),
      useAuthStore: () => ({ hasPermission: code => grants.value.includes(code) }),
    },
    '@jetlinks-web-core/components/ConditionFilter': {
      encodeConditionFilterQuery: terms => terms.length ? 'encoded-filter' : '',
    },
  }
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', js)(id => {
    assert.ok(id in imports, `Unexpected dependency: ${id}`)
    return imports[id]
  }, module, module.exports)
  const state = module.exports.useUnifiedDeviceBatchNavigation({
    activeType, selected, searchTerms, filterFields: ref([]),
    syncGatewayStatus: () => calls.push(['sync']),
  })
  return { ...state, grants, menuPresent, activeType, selected, searchTerms, calls, query }
}

test('device list declares one independently assignable algorithms button with localized labels', () => {
  const buttons = listMenu(menuTree()).buttons.filter(button => button.id === 'algorithms')
  assert.equal(buttons.length, 1)
  assert.equal(buttons[0].name, '算法配置')
  for (const locale of ['zh_CN', 'en_US', 'en', 'ja', 'ja_JP']) {
    assert.ok(buttons[0].i18nMessages[locale], locale)
  }
  assert.deepEqual(buttons[0].permissions, [{ permission: 'ai_scene', actions: ['query'] }])
})

// 使用初始化页面的真实过滤函数，避免新增按钮在菜单同步时被过滤。
const initPage = read('../../../jetlinks-web-core/src/views/init-home/Menu/index.vue')
const { descriptor } = parse(initPage)
const initScript = ts.createSourceFile('init-menu.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
const declaration = initScript.statements.find(statement => ts.isVariableStatement(statement)
  && statement.declarationList.declarations.some(item => item.name.getText(initScript) === 'filterMenuByPermission'))
assert.ok(declaration)
const filterJs = ts.transpileModule(declaration.getText(initScript), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
const filterMenuByPermission = new Function(`${filterJs}; return filterMenuByPermission`)()

test('runtime initialization retains algorithms only when its backend resource is supported', () => {
  for (const supported of [true, false]) {
    const resources = ['device-instance', ...(supported ? ['ai_scene'] : [])]
    const menu = listMenu(filterMenuByPermission(resources, menuTree(), true))
    assert.ok(menu)
    assert.equal(menu.buttons.some(button => button.id === 'algorithms'), supported)
  }
})

test('menu access and unrelated button or API grants cannot open algorithms', () => {
  for (const grants of [[], ['algorithm-center:view'], ['ai_scene:query'],
    ...['view', 'update', 'action', 'enable', 'export', 'import'].map(action => [`iot-user-device-list:${action}`]),
    ['device/Instance:algorithms'], ['iot-user/device/list:algorithms']]) {
    const f = fixture(grants)
    assert.equal(f.canConfigureGatewayAlgorithms?.value, false, JSON.stringify(grants))
    f.openBatchPage({ key: 'algorithms' })
    assert.deepEqual(f.calls, [], JSON.stringify(grants))
  }
})

test('explicit grant opens the independent menu without passing selected devices or filters', () => {
  const f = fixture([permission])
  f.selected.value = [{ id: 'gateway-1', category: 'gateway' }]
  f.searchTerms.value = [{ column: 'name', value: 'gateway' }]
  assert.equal(f.canConfigureGatewayAlgorithms?.value, true)
  f.openBatchPage({ key: 'algorithms' })
  assert.deepEqual(f.calls, [['algorithm-center']])
})

test('grant alone cannot open algorithms outside the gateway category or without its menu', () => {
  for (const [category, hasMenu] of [['gateway', false], ['all', true], ['device', true], ['video', true]]) {
    const f = fixture([permission], category, hasMenu)
    assert.equal(f.canConfigureGatewayAlgorithms?.value, false)
    f.openBatchPage({ key: 'algorithms' })
    assert.deepEqual(f.calls, [])
  }
})

test('revoking a grant or menu, or changing category, immediately disables and blocks navigation', () => {
  for (const revoke of [f => { f.grants.value = [] }, f => { f.menuPresent.value = false },
    f => { f.activeType.value = 'video' }]) {
    const f = fixture([permission])
    assert.equal(f.canConfigureGatewayAlgorithms?.value, true)
    revoke(f)
    assert.equal(f.canConfigureGatewayAlgorithms?.value, false)
    f.openBatchPage({ key: 'algorithms' })
    assert.deepEqual(f.calls, [])
  }
  const f = fixture()
  f.grants.value = [permission]
  assert.equal(f.canConfigureGatewayAlgorithms?.value, true)
  f.openBatchPage({ key: 'algorithms' })
  assert.deepEqual(f.calls, [['algorithm-center']])
})

test('page binds disabled state to the guarded navigation hook and preserves menu visibility', () => {
  assert.match(page, /v-if="activeType === 'gateway' && menu\.hasMenu\('algorithm-center'\)" :disabled="!canConfigureGatewayAlgorithms" key="algorithms"/)
  assert.match(page, /const \{ openBatchPage, canConfigureGatewayAlgorithms \} = useUnifiedDeviceBatchNavigation\(\{ activeType,/)
})

test('plugin selection/query navigation and status synchronization keep their existing scopes', () => {
  const f = fixture()
  f.selected.value = [{ id: 'gateway-1', category: 'gateway' }, { id: 'device-1', category: 'device' }]
  f.openBatchPage({ key: 'plugins' })
  assert.deepEqual(f.calls.pop(), ['iot-user-device-list/Batch', {
    query: { ...f.query, gatewayIds: ['gateway-1'], gatewayScope: undefined, batchTab: 'plugins' },
  }])
  f.selected.value = []
  f.searchTerms.value = [{ column: 'name', value: 'gateway' }]
  f.openBatchPage({ key: 'plugins' })
  assert.deepEqual(f.calls.pop(), ['iot-user-device-list/Batch', {
    query: { ...f.query, q: 'encoded-filter', gatewayIds: undefined, gatewayScope: 'query', batchTab: 'plugins' },
  }])
  f.searchTerms.value = []
  f.openBatchPage({ key: 'plugins' })
  assert.equal(f.calls.pop()[1].query.q, 'previous-filter')
  f.openBatchPage({ key: 'syncStatus' })
  assert.deepEqual(f.calls, [['sync']])
})
