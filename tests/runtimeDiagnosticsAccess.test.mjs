import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { computed, reactive } from 'vue'

const state = reactive({ menus: [], buttons: [] })
const permissionChecks = []
const stores = {
  '@jetlinks-web-core/store/auth': { useAuthStore: () => ({ hasPermission: code => { permissionChecks.push(code); return state.buttons.includes(code) } }) },
  '@jetlinks-web-core/store/menu': { useMenuStore: () => ({ hasMenu: code => state.menus.includes(code) }) },
  vue: { computed },
}
const source = readFileSync(new URL('../views/link/diagnostics/useDiagnosticsAccess.ts', import.meta.url), 'utf8')
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(id => stores[id], module, module.exports)
const access = module.exports.useDiagnosticsAccess()
const grant = (...buttons) => state.buttons = buttons.map(id => `link/RuntimeMonitor:${id}`)

test('new menu payloads use the backend button translation contract with explicit permissions', () => {
  const menus = JSON.parse(readFileSync(new URL('../baseMenu.json', import.meta.url), 'utf8'))
  const infrastructure = menus.find(menu => menu.code === 'link').children
  for (const code of ['link/RuntimeMonitor', 'link/Tracing']) {
    const menu = infrastructure.find(menu => menu.code === code)
    assert.ok(menu.permissions.length)
    assert.ok(menu.url !== '/infrastructure/dashboard')
    for (const button of menu.buttons) {
      // MenuButtonInfo implements SingleI18nSupportEntity (Map<String, String>).
      assert.ok(Object.values(button.i18nMessages).every(value => typeof value === 'string'), `${code}:${button.id}`)
      assert.ok(button.permissions.every(permission => permission.permission && permission.actions.length))
    }
  }
  assert.equal(infrastructure.find(menu => menu.code === 'link/DashBoard').buttons, undefined)
})

test('module menu transformation preserves diagnostics resource declarations while access only evaluates menu button codes', () => {
  function evaluate(path, imports) {
    const module = { exports: {} }, { code } = transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' })
    new Function('require', 'module', 'exports', code)(id => imports[id], module, module.exports)
    return module.exports
  }
  const declared = JSON.parse(readFileSync(new URL('../baseMenu.json', import.meta.url), 'utf8'))
  const menus = evaluate('../baseMenu.ts', {
    './baseMenu.json': { __esModule: true, default: declared }, './package.json': { __esModule: true, default: { name: 'device-manager-ui' } },
    '@jetlinks-web-core/locales': { __esModule: true, default: { global: { t: key => key } } },
  }).default()
  const { handleAuthMenu } = evaluate('../../../jetlinks-web-core/src/utils/menuMeta.ts', { './menuBadge': {} })
  const translated = new Map(); handleAuthMenu(menus, (code, buttons) => translated.set(code, buttons))
  const monitor = menus.find(menu => menu.code === 'link').children.find(menu => menu.code === 'link/RuntimeMonitor')
  assert.deepEqual(monitor.buttons.find(button => button.id === 'monitor-query').permissions, [{ permission: 'system-monitor', actions: ['query'] }])
  assert.deepEqual(monitor.buttons.find(button => button.id === 'mbean-invoke').permissions, [{ permission: 'system-monitor', actions: ['invoke'] }])
  assert.deepEqual(monitor.buttons.find(button => button.id === 'session-query').permissions, [{ permission: 'device-instance', actions: ['query'] }])
  assert.ok(translated.get('link/RuntimeMonitor').includes('monitor-query'))
  state.menus = ['link/RuntimeMonitor']; state.buttons = translated.get('link/RuntimeMonitor').map(id => `link/RuntimeMonitor:${id}`)
  permissionChecks.length = 0
  assert.equal(access.value.monitor, true); assert.equal(access.value.invoke, true)
  assert.equal(access.value.sessions, true)
  assert.ok(permissionChecks.length > 0)
  assert.ok(permissionChecks.every(code => code.startsWith('link/RuntimeMonitor:')), 'front-end actions use declared menu/button identifiers, never raw back-end resource permissions')
})

test('existing dashboard does not grant access to either new diagnostics menu', () => {
  state.menus = ['link/DashBoard']; grant()
  assert.equal(access.value.query, false)
  assert.equal(access.value.trace, false)
  state.buttons = ['link/DashBoard:monitor-query', 'link/DashBoard:mbean-invoke', 'link/DashBoard:log-query']
  for (const action of ['monitor', 'sessions', 'threads', 'invoke', 'logs', 'exportLogs', 'jfr', 'heap']) assert.equal(access.value[action], false, action)
})

test('runtime monitoring entry does not infer metrics or tool actions', () => {
  state.menus = ['link/RuntimeMonitor']; grant()
  assert.equal(access.value.enter, true)
  assert.equal(access.value.query, false)
  grant('query')
  assert.equal(access.value.query, true)
  for (const action of ['monitor', 'sessions', 'threads', 'invoke', 'logs', 'exportLogs', 'jfr', 'heap']) assert.equal(access.value[action], false, action)
})

test('device-session query requires its own declared button and entry independently of monitor statistics', () => {
  state.menus = ['link/RuntimeMonitor']
  grant('session-query')
  assert.equal(access.value.sessions, true)
  assert.equal(access.value.monitor, false)
  grant('monitor-query')
  assert.equal(access.value.sessions, false)
  grant('monitor-query', 'session-query')
  assert.equal(access.value.sessions, true)
  state.menus = []
  assert.equal(access.value.sessions, false, 'a button grant cannot bypass the owning menu entry')
})

test('live capture is independent of export; artifact actions still require both', () => {
  state.menus = ['link/RuntimeMonitor']; grant('jfr', 'heap-dump')
  assert.equal(access.value.jfr, true); assert.equal(access.value.exportJfr, false); assert.equal(access.value.heap, false)
  grant('jfr', 'heap-dump', 'diagnostic-export')
  assert.equal(access.value.jfr, true); assert.equal(access.value.exportJfr, true); assert.equal(access.value.heap, true)
  state.menus = []
  assert.equal(access.value.query, false); assert.equal(access.value.jfr, false)
})

test('cluster tracing is independent and invocation requires read plus invoke', () => {
  state.menus = ['link/Tracing']; grant()
  assert.equal(access.value.trace, false); assert.equal(access.value.query, false)
  state.buttons = ['link/Tracing:query']
  assert.equal(access.value.trace, true)
  state.menus = []
  assert.equal(access.value.trace, false)
  state.menus = ['link/RuntimeMonitor']; grant('mbean-invoke')
  assert.equal(access.value.trace, false); assert.equal(access.value.invoke, false)
  grant('monitor-query', 'mbean-invoke')
  assert.equal(access.value.invoke, true)
  grant('monitor-query')
  assert.equal(access.value.monitor, true); assert.equal(access.value.invoke, false)
})

test('log export requires read and export while metric access stays independent', () => {
  state.menus = ['link/RuntimeMonitor']; grant('log-export')
  assert.equal(access.value.exportLogs, false)
  grant('log-query', 'log-export')
  assert.equal(access.value.logs, true); assert.equal(access.value.exportLogs, true)
  assert.equal(access.value.query, false); assert.equal(access.value.monitor, false)
})
