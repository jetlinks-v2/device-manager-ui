import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { build } from 'esbuild'

const root = new URL('../', import.meta.url)
const source = JSON.parse(readFileSync(new URL('baseMenu.json', root), 'utf8'))
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
const product = flatten(initializeMenu()).find(menu => menu.code === 'device/Product')
const originalProduct = flatten(source).find(menu => menu.code === 'device/Product')

test('initialized import button grants the save actions required by package resources', () => {
  const button = product.buttons.find(button => button.id === 'resource-package-import')
  const permissions = new Map(button.permissions.map(item => [item.permission, item.actions]))
  for (const resource of ['device-product', 'device-category', 'protocol-supports', 'network-config', 'certificate', 'device-gateway', 'plugin-driver']) {
    assert.ok(permissions.get(resource)?.includes('save'), `${resource}:save is required`)
  }
  assert.ok(permissions.get('device-product').includes('resource-package-import'))
  for (const resource of ['protocol-supports', 'plugin-driver', 'certificate', 'device-gateway', 'network-config']) {
    assert.ok(permissions.get(resource)?.includes('query'), `${resource}:query is required for local references`)
  }
})

test('menu initialization preserves parent and unrelated button permission boundaries', () => {
  assert.deepEqual(product.permissions, originalProduct.permissions)
  for (const button of product.buttons.filter(button => button.id !== 'resource-package-import')) {
    assert.deepEqual(button.permissions, originalProduct.buttons.find(original => original.id === button.id).permissions)
  }
})
