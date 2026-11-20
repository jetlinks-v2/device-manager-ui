import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const filename = new URL('../views/device/Instance/Import/file.vue', import.meta.url)
const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename: filename.pathname })
assert.deepEqual(errors, [])
compileScript(descriptor, { id: 'device-plugin-file-import' })
const script = ts.createSourceFile('file.ts', descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true)
const body = script.statements.filter(statement => !ts.isImportDeclaration(statement))
  .map(statement => statement.getFullText(script)).join('\n')
const { outputText } = ts.transpileModule(body, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})

for (const [accessProvider, prefix] of [
  ['plugin_gateway', '/device/instance/plugin'],
  ['agent-device-gateway', '/device-instance'],
]) {
  test(`${accessProvider} downloads its template from the same controller used for file import`, async () => {
    const requests = [], streams = [], downloads = []
    const modules = runtimeModules({
      '@jetlinks-web/core': { request: { get: async (...args) => {
        requests.push(args)
        return new Uint8Array([1])
      } } },
      '@jetlinks-web/utils': { getToken: () => 'test-token' },
      '@jetlinks-web/constants': { TOKEN_KEY_URL: 'token' },
      '@jetlinks-web-core/utils': { getBaseApi: () => '/api' },
    })
    const api = modules.load('api/instance.ts')
    const bindings = {
      ...vue, ...api, defineOptions() {},
      defineProps: () => ({ product: 'product-1', accessProvider }),
      inject: () => vue.ref(false),
      useI18n: () => ({ t: key => key }),
      onlyMessage() {}, FileStaticPath() {}, getUploadHeaders() {},
      downloadFileByUrl: (...args) => downloads.push(args),
      Blob, URL: { createObjectURL: () => 'blob:template' },
      EventSourcePolyfill: class { constructor(url) { streams.push(url) } },
    }
    const view = vm.runInNewContext(`${outputText}\n({ downFile, submitData })`, bindings)

    for (const format of ['csv', 'xlsx']) {
      await view.downFile(format)
      assert.deepEqual(requests.at(-1), [
        `${prefix}/product-1/template.${format}`, {}, { responseType: 'blob' },
      ])
      assert.equal(downloads.at(-1)[2], format)
    }
    await view.submitData('https://files.example/devices.csv')
    assert.ok(streams[0].startsWith(`/api${prefix}/product-1/import/_withlog?`))
  })
}
