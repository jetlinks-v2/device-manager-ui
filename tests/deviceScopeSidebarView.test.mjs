import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { compileScript, parse } from 'vue/compiler-sfc'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import { cloneDeep } from 'lodash-es'
import { runtimeModules } from './helpers/runtimeModules.mjs'
import { createComponentLoader } from '../../../jetlinks-web-core/tests/helpers/componentRuntime.mjs'

globalThis.localStorage = { getItem: () => null }
const { filterTreeNodes } = runtimeModules({ 'ant-design-vue': { message: {} } }).load('../../node_modules/@jetlinks-web/utils/src/util.ts')

const require = createRequire(import.meta.url)
const translations = JSON.parse(readFileSync(new URL('../locales/lang/zh.json', import.meta.url), 'utf8'))
const t = (key, values = {}) => (translations[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`)
const hook = runtimeModules({ 'lodash-es': { cloneDeep }, '@jetlinks-web/utils': { filterTreeNodes }, 'vue-i18n': { useI18n: () => ({ t }) } }).load('views/device/list/hooks/useIotDeviceScopeSidebar.ts')
const NavigationTree = createComponentLoader({ 'vue-i18n': { useI18n: () => ({ t }) } })('components/NavigationTree/index.vue').default
const source = readFileSync(new URL('../views/device/list/components/IotDeviceScopeSidebar.vue', import.meta.url), 'utf8')
const descriptor = parse(source, { filename: 'IotDeviceScopeSidebar.vue' }).descriptor
const { code } = transformSync(compileScript(descriptor, { id: 'scope-sidebar-view', inlineTemplate: true }).content, { loader: 'ts', format: 'cjs' })
const rowDescriptor = parse(readFileSync(new URL('../components/IotTreeNodeRow.vue', import.meta.url), 'utf8')).descriptor
const rowCode = transformSync(compileScript(rowDescriptor, { id: 'scope-node-row-view', inlineTemplate: true }).content, { loader: 'ts', format: 'cjs' }).code
const rowModule = { exports: {} }
const SkeletonText = { props: ['width'], setup: () => () => vue.h('span', { class: 'skeleton-text' }) }
new Function('require', 'module', 'exports', rowCode)(id => id === '@jetlinks-web-core/components/SkeletonText' ? { __esModule: true, default: SkeletonText } : require(id), rowModule, rowModule.exports)
const menuDescriptor = parse(readFileSync(new URL('../views/device/list/components/IotDeviceGroupNodeMenu.vue', import.meta.url), 'utf8')).descriptor
const menuCode = transformSync(compileScript(menuDescriptor, { id: 'scope-menu-view', inlineTemplate: true }).content, { loader: 'ts', format: 'cjs' }).code
const menuModule = { exports: {} }
new Function('require', 'module', 'exports', menuCode)(require, menuModule, menuModule.exports)
const interactions = runtimeModules().load('views/device/list/hooks/iotDeviceGroupTreeInteractions.ts')

async function render({ props = {}, menus = [], permissions = [] } = {}) {
  const visible = new Set(menus), allowed = new Set(permissions)
  const pane = { setup: (_, { slots }) => () => vue.h('section', [slots.header?.(), slots.toolbar?.(), slots.default?.()]) }
  const row = rowModule.exports.default
  const imports = {
    '@jetlinks-web-core/components/SkeletonText': { __esModule: true, default: SkeletonText },
    vue,
    'vue-i18n': { useI18n: () => ({ t }) },
    'vue-router': { useRoute: () => ({ params: {}, path: '/resources/devices/list' }) },
    '@jetlinks-web-core/store': {
      useAuthStore: () => ({ hasPermission: code => allowed.has(code) }),
      useMenuStore: () => ({ hasMenu: code => visible.has(code), jumpPage: () => {} }),
    },
    '@jetlinks-web-core/components': { NavigationTree, SplitterPane: pane, AutoFitText: { props: ['text'], setup: props => () => vue.h('span', props.text) } },
    '@device-manager-ui/components/IotTreeNodeRow.vue': { __esModule: true, default: row },
    '../hooks/useIotDeviceScopeSidebar': hook,
    '../hooks/iotDeviceGroupTreeInteractions': interactions,
    './IotDeviceGroupNodeMenu.vue': { __esModule: true, default: menuModule.exports.default },
    '../hooks/useIotDeviceRouting': { getIotDeviceListMenuCode: () => 'iot-user-device-list' },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => imports[id] ?? require(id), module, module.exports)
  const app = vue.createSSRApp(module.exports.default, {
    activeType: 'area', activeId: '', areas: [], groups: [], totalDeviceCount: 8,
    areaDeviceCounts: {}, groupDeviceCounts: {}, unboundAreaDeviceCount: 8, unassignedGroupDeviceCount: 8, ...props,
  })
  app.config.globalProperties.$t = t
  const pass = tag => ({ inheritAttrs: false, setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
  for (const [name, tag] of [['a-button', 'button'], ['a-input', 'input'], ['a-segmented', 'div'], ['a-menu-item', 'li'], ['a-menu', 'ul'], ['a-dropdown', 'span'], ['a-tooltip', 'span'], ['j-ellipsis', 'span'], ['AIcon', 'i']]) app.component(name, pass(tag))
  app.component('CloudEmpty', { props: ['description'], setup: (props, { slots }) => () => vue.h('div', { 'data-empty': true }, [props.description, slots.default?.()]) })
  return renderToString(app)
}

test('empty spaces replace the entire directory and show a management guide only for an accessible menu', async () => {
  const html = await render({ menus: ['space/AreaManagement'], permissions: ['space/AreaManagement:view'] })
  assert.match(html, /暂无空间/)
  assert.match(html, /去空间管理/)
  assert.match(html, /可在空间管理中配置空间/)
  assert.doesNotMatch(html, /空间目录|全部空间|data-tree|展开空间搜索/)
  assert.equal((html.match(/class="iot-device-scope__shortcut(?: |")/g) || []).length, 2)
  for (const options of [{ menus: ['space/AreaManagement'] }, { permissions: ['space/AreaManagement:view'] }]) {
    const denied = await render(options)
    assert.match(denied, /暂无空间/)
    assert.doesNotMatch(denied, /去空间管理|可在空间管理中配置空间/)
  }
})

test('empty groups keep the existing creation action without inventing a group-management route', async () => {
  const options = { props: { activeType: 'group' }, permissions: ['iot-user-device-list:update'] }
  const html = await render(options)
  assert.match(html, /暂无分组/)
  assert.equal((html.match(/>新增顶级分组</g) || []).length, 1)
  assert.doesNotMatch(html, /分组目录|全部分组|data-tree/)
  for (const props of [{ activeType: 'group' }, { activeType: 'group', showGroupActions: false }]) {
    const denied = await render({ props, permissions: props.showGroupActions === false ? options.permissions : [] })
    assert.match(denied, /暂无分组/)
    assert.doesNotMatch(denied, /新增顶级分组|可新增分组组织设备/)
  }
})

test('zero devices in an existing space retain the directory and its selectable root', async () => {
  const html = await render({ props: { areas: [{ id: 'park', name: '园区' }], boundAreaDeviceCount: 0 } })
  assert.doesNotMatch(html, /空间目录|directory-header/)
  assert.match(html, /class="[^"]*\bnavigation-tree(?:\s|")/)
  assert.match(html, /全部空间/)
  assert.match(html, /aria-label="搜索空间名称"/)
  assert.doesNotMatch(html, /暂无空间|去空间管理/)
})

test('loading and failed scope requests are not displayed as an empty data set', async () => {
  for (const props of [{ loading: true }, { loadError: true }]) assert.doesNotMatch(await render({ props }), /暂无空间|去空间管理/)
})

test('permanent group search sits above the selectable directory without a duplicate heading', async () => {
  const html = await render({ props: { activeType: 'group', groups: [{ id: 'g1', name: '产线' }], assignedGroupDeviceCount: 0 } })
  assert.match(html, /class="[^"]*\bnavigation-tree(?:\s|")/)
  assert.match(html, /全部分组/)
  assert.match(html, /aria-label="搜索分组名称"/)
  assert.ok(html.indexOf('navigation-tree__search') < html.indexOf('navigation-tree__viewport'))
  assert.doesNotMatch(html, /分组目录|directory-header|暂无分组/)
})

test('scope layout strings exist in every shipped locale', () => {
  const keys = ['rootAreas', 'rootGroups', 'searchPlaceholder', 'areaManagementHint', 'goAreaManagement', 'groupCreateHint', 'createRootGroup', 'parentGroup', 'topLevelGroup', 'groupMoved', 'groupMoveFailed', 'groupMoveRefreshFailed', 'deviceCountShort']
  for (const locale of ['zh', 'en', 'ja']) {
    const messages = JSON.parse(readFileSync(new URL(`../locales/lang/${locale}.json`, import.meta.url), 'utf8'))
    for (const key of keys) assert.ok(messages[`IotDeviceList.scope.${key}`], `${locale}: ${key}`)
  }
})

test('the shared tree renders adjacent device badges and permission-aware group actions', async () => {
  const props = { activeType: 'group', groups: [{ id: 'g1', name: '产线' }], groupDeviceCounts: { g1: 12 } }
  const allowed = await render({ props, permissions: ['iot-user-device-list:update'] })
  assert.match(allowed, /navigation-tree__meta[^]*iot-device-scope__count[^]*?aria-hidden="true">12台<\/span>/)
  assert.match(allowed, /iot-device-scope__count-label[^>]*>12 台设备<\/span>/)
  assert.doesNotMatch(allowed, /navigation-tree__suffix/, 'group actions reuse the count position')
  assert.match(allowed, /aria-label="产线的分组操作"|aria-label="[^"]*产线[^"]*"/)
  assert.match(allowed, /draggable="true"/)
  assert.equal((allowed.match(/data-node-draggable="true"/g) || []).length, 1, 'only the real group can start dragging')
  assert.equal((allowed.match(/data-node-draggable="false"/g) || []).length, 1, 'the synthetic root remains a drop target but cannot start dragging')
  const denied = await render({ props })
  assert.doesNotMatch(denied, /iot-device-scope__action"|新增顶级分组|\sdraggable="true"/)
  const busy = await render({ props: { ...props, actionBusy: true }, permissions: ['iot-user-device-list:update'] })
  assert.doesNotMatch(busy, /\sdraggable="true"/, 'saving disables native dragging')
})

test('ordinary zero counts stay accessible without repeated visible zeros, while the root keeps its zero summary', async () => {
  const html = await render({ props: { activeType: 'group', groups: [{ id: 'g1', name: '产线' }], groupDeviceCounts: { g1: 0 }, assignedGroupDeviceCount: 0 } })
  assert.equal((html.match(/aria-hidden="true">0台<\/span>/g) || []).length, 1, 'only the scope root shows the zero summary')
  assert.equal((html.match(/iot-device-scope__count-label[^>]*>0 台设备<\/span>/g) || []).length, 2)
})

test('shared layout cells do not change with scope or group-management permissions', async () => {
  const data = { areas: [{ id: 'a1', name: '园区' }], groups: [{ id: 'g1', name: '产线' }] }
  for (const [activeType, permissions, showGroupActions] of [
    ['area', [], true], ['group', [], true], ['group', ['iot-user-device-list:update'], true],
    ['group', ['iot-user-device-list:update'], false],
  ]) {
    const html = await render({ props: { ...data, activeType, showGroupActions }, permissions })
    assert.doesNotMatch(html, /iot-tree-node-row--with-action/, 'shortcuts have no actions to reserve a column for')
    assert.equal([...html.matchAll(/class="iot-device-scope__meta(?: iot-device-scope__meta--actionable)?"/g)].length, 2, 'root and child always use the same metadata cell')
    for (const [, attrs, content] of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
      if (attrs.includes('iot-device-scope__action')) assert.doesNotMatch(content, /iot-device-scope__count/, 'the action overlays the count instead of owning its layout')
    }
  }
})
