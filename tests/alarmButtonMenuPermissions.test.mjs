import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build, transform } from 'esbuild'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

const compiled = await build({
  entryPoints: [fileURLToPath(new URL('../baseMenu.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', tsconfigRaw: { compilerOptions: {} },
  plugins: [{ name: 'menu-i18n', setup(api) {
    api.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'i18n', namespace: 'test' }))
    api.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export default { global: { t: key => key } }' }))
  } }],
})
const { default: initializeMenu } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const flatten = menus => menus.flatMap(menu => [menu, ...flatten(menu.children ?? [])])
const menus = flatten(initializeMenu()).filter(menu => menu.code === 'iot-user/device/alarm')

test('both alarm entries retain query access and expose four independently assignable buttons', () => {
  assert.deepEqual(menus.map(menu => menu.owner).sort(), ['app', 'iot'])
  for (const menu of menus) {
    assert.ok(menu.permissions.every(permission => permission.actions.every(action => action === 'query')))
    assert.deepEqual(menu.buttons.map(button => button.id), ['add', 'update', 'delete', 'handle'])
    for (const button of menu.buttons) {
      const resources = button.id === 'handle' ? ['alarm-record'] : ['device-product', 'device-instance']
      assert.deepEqual(button.permissions, resources.map(permission => ({ permission, actions: ['save'] })))
    }
    assert.ok(menu.assetTypes.includes('user'))
  }
})

test('alarm workspace and device detail pass the same explicit handle grant to shared cards', () => {
  for (const path of ['views/device/alarm/index.vue', 'views/device/list/components/device-detail/IotDeviceAlarmWorkspace.vue']) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    assert.match(source, /:can-handle="canHandle"/)
    assert.match(source, /<DeviceAlarmHandleModal v-if="canHandle"/)
  }
})


// 使用运行时初始化页面的真实过滤函数，确认按钮不会在生成初始化请求时丢失。
const initPage = readFileSync(new URL('../../../jetlinks-web-core/src/views/init-home/Menu/index.vue', import.meta.url), 'utf8')
const { descriptor } = parse(initPage)
const script = ts.createSourceFile('init-menu.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
const filterDeclaration = script.statements.find(statement => ts.isVariableStatement(statement)
  && statement.declarationList.declarations.some(declaration => declaration.name.getText(script) === 'filterMenuByPermission'))
assert.ok(filterDeclaration, 'runtime initialization permission filter must exist')
const { code } = await transform(filterDeclaration.getText(script), { loader: 'ts', target: 'node22' })
const filterMenuByPermission = new Function(`${code}; return filterMenuByPermission`)()

test('runtime menu initialization retains the four alarm buttons for supported backend resources', () => {
  const resources = [...new Set(menus.flatMap(menu => menu.permissions.map(permission => permission.permission)))]
  const result = flatten(filterMenuByPermission(resources, initializeMenu(), true))
    .filter(menu => menu.code === 'iot-user/device/alarm')
  assert.equal(result.length, 2)
  for (const menu of result) assert.deepEqual(menu.buttons.map(button => button.id), ['add', 'update', 'delete', 'handle'])
})
