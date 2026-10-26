import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
const require = createRequire(import.meta.url), cache = new Map()
const root = resolve(import.meta.dirname, '../views/link/diagnostics')
const dictionary = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/locales/lang/en.json'), 'utf8'))
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8')
  const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'log-explorer', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => dictionary[key] ?? key }) }
    if (id.startsWith('.')) { const path = resolve(dirname(filename), id); return load(existsSync(path) ? path : `${path}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { logFileKey, logFileMetadata } = load(resolve(root, 'logFilePresentation.ts'))
const file = { id: 'active', providerId: 'java', name: 'a-very-long-application-log-name.log', directory: false, operations: ['readWindow', 'download'], size: 1536, lastModified: 1792840000000 }
async function render(state = { status: 'ready' }) {
  const app = vue.createSSRApp({ render: () => vue.h(load(resolve(root, 'LogFileExplorer.vue')).default, { model: { files: [{ ...file, id: 'folder', name: 'history', directory: true, size: undefined }, file], parents: [{ ...file, id: 'root', name: 'Java logs', directory: true }], selectedKey: logFileKey(file), state } }) })
  const { Button, Breadcrumb, BreadcrumbItem, Spin, Empty, SpaceCompact } = require('ant-design-vue')
  for (const [name, component] of Object.entries({ 'a-button': Button, 'a-breadcrumb': Breadcrumb, 'a-breadcrumb-item': BreadcrumbItem, 'a-spin': Spin, 'a-empty': Empty, 'a-space-compact': SpaceCompact })) app.component(name, component)
  return renderToString(app)
}

test('file explorer uses actual Ant controls, one selected row, compact metadata and distinct directory breadcrumbs', async () => {
  const html = await render()
  assert.ok(html.includes(file.name)); assert.ok(html.includes('1.5 KB'))
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1)
  assert.ok(html.includes('log-file-entry--selected')); assert.ok(html.includes('Java logs'))
  for (const key of ['fileDirectory', 'refreshDirectory', 'fileParent', 'fileRoot']) assert.ok(html.includes(dictionary[`runtimeDiagnostics.${key}`]), key)
  assert.ok(!html.includes('log-reader-window'), 'directory is only navigation, not a second reader or card')
  const failed = await render({ status: 'error', message: 'Directory unavailable' })
  assert.ok(failed.includes('Directory unavailable')); assert.ok(failed.includes(file.name), 'a failed refresh retains the last coherent directory')
})

test('metadata omits unavailable values and file identity includes ZIP entry without path guessing', () => {
  assert.equal(logFileMetadata({ ...file, size: undefined, lastModified: undefined }).summary, '')
  assert.equal(logFileMetadata({ ...file, size: -1, lastModified: NaN }).summary, '')
  assert.notEqual(logFileKey(file), logFileKey({ ...file, entry: 'app.log' }))
  assert.equal(logFileKey({ ...file, name: 'alias' }), logFileKey(file))
})

test('file picker opens explicitly and closes when its cached file workspace becomes inactive', () => {
  const scope = vue.effectScope(), enabled = vue.ref(true), layout = scope.run(() => load(resolve(root, 'useLogExplorerLayout.ts')).useLogExplorerLayout(enabled))
  try {
    assert.equal(layout.open.value, false)
    layout.setOpen(true); assert.equal(layout.open.value, true)
    enabled.value = false; assert.equal(layout.open.value, false)
    layout.setOpen(true); assert.equal(layout.open.value, false, 'hidden workspaces cannot leave a floating directory on screen')
    enabled.value = true; assert.equal(layout.open.value, false, 'returning to logs does not reopen the picker')
    layout.setOpen(true); layout.close(); assert.equal(layout.open.value, false)
  } finally { scope.stop() }
})

test('file explorer and composed workspace templates and styles compile', () => {
  for (const name of ['LogFileExplorer.vue', 'NodeLogPanel.vue']) {
    const filename = resolve(root, name), { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
    assert.deepEqual(errors, []); assert.ok(compileScript(descriptor, { id: 'log-explorer', inlineTemplate: true }).content)
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'log-explorer', source: style.content, filename, scoped: style.scoped }).errors, [])
  }
})
