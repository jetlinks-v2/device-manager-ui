import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { declarations } from './mbeanDeclarations.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), require = createRequire(import.meta.url)
export function runtimeModules(overrides = {}) {
  const collection = declarations(vue), cache = new Map(), access = vue.ref({ enter: true, query: true, monitor: true, invoke: true })
  function load(path) {
    if (cache.has(path)) return cache.get(path)
    const module = { exports: {} }
    const code = transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' }).code
    new Function('require', 'module', 'exports', code)(id => {
      if (Object.hasOwn(overrides, id)) return overrides[id]
      if (id.endsWith('collection/useMBeanCollection')) return collection
      if (id.endsWith('useDiagnosticsAccess')) return { useDiagnosticsAccess: () => access }
      if (id.endsWith('useDiagnosticPreferences')) return { useDiagnosticPreferences: () => undefined }
      if (id === 'vue') return { ...vue, onActivated: () => {}, onDeactivated: () => {} }
      if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
      if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
      if (id === '@jetlinks-web-core/components/RuntimeDiagnostics') return load(resolve(root, '../../jetlinks-web-core/src/components/RuntimeDiagnostics/samplingInterval.ts'))
      if (id.startsWith('@jetlinks-web-core/')) return load(resolve(root, '../../jetlinks-web-core/src', `${id.slice('@jetlinks-web-core/'.length)}.ts`))
      return id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
    }, module, module.exports)
    cache.set(path, module.exports); return module.exports
  }
  return { collection, access, load: filename => load(resolve(root, filename)) }
}
