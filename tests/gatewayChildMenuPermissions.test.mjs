import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = new URL('../', import.meta.url)
const compiled = await build({
  entryPoints: [fileURLToPath(new URL('baseMenu.ts', root))],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  tsconfigRaw: { compilerOptions: {} },
  plugins: [{
    name: 'menu-i18n-boundary',
    setup(api) {
      api.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: 'i18n', namespace: 'test' }))
      api.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export default { global: { t: key => key } }',
      }))
    },
  }],
})
const { default: initializeMenu } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const flatten = menus => menus.flatMap(menu => [menu, ...flatten(menu.children ?? [])])
const deviceList = flatten(initializeMenu()).find(menu => menu.url === '/resources/devices/list')
const gatewayActions = node => node.permissions?.find(item => item.permission === 'device-gateway-manager')?.actions ?? []

test('initialized device list includes gateway query and child binding permissions', () => {
  assert.ok(deviceList, 'device list menu must be initialized')
  for (const action of ['query', 'save']) {
    assert.ok(gatewayActions(deviceList).includes(action), `device-gateway-manager:${action} is required`)
  }
  assert.ok(deviceList.permissions.some(item => item.permission === 'device-gateway'), 'access gateway permission remains separate')
})

test('gateway child binding and unbinding belong to edit, while view remains query only', () => {
  const edit = deviceList.buttons.find(button => button.id === 'update')
  const view = deviceList.buttons.find(button => button.id === 'view')
  assert.ok(gatewayActions(edit).includes('save'), 'edit must allow binding and unbinding children')
  assert.deepEqual(gatewayActions(view), ['query'])
  for (const button of deviceList.buttons.filter(button => button.id !== 'update')) {
    assert.equal(gatewayActions(button).includes('save'), false, `${button.id} must not grant child binding`)
  }
})
