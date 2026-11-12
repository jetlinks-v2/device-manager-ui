import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const moduleRoot = path.resolve(here, '../../..')
const core = path.resolve(moduleRoot, '../../jetlinks-web-core/src')
const boundary = path.join(here, 'boundaries.mjs')
export default defineConfig({
  root: here,
  plugins: [vue(), AutoImport({ imports: ['vue', 'vue-router'], dts: false }), {
    name: 'gateway-fixture-boundaries',
    resolveId(id) {
      if (id.includes('components/ConditionFilter')) return '\0gateway-empty'
    },
    load(id) { if (id === '\0gateway-empty') return 'export default { render: () => null }' },
  }],
  resolve: { alias: [
    ...['@jetlinks-web/core', '@jetlinks-web/utils', '@jetlinks-web/hooks', '@jetlinks-web-core/hooks', '@jetlinks-web-core/store/menu', '@jetlinks-web-core/store', '@jetlinks-web-core/locales', '@jetlinks-web-core/utils/comm', '@jetlinks-web-core/utils'].map(id => ({ find: new RegExp('^' + id + '$'), replacement: boundary })),
    { find: /^@jetlinks-web-core\/components$/, replacement: path.join(here, 'components.mjs') },
    { find: '@jetlinks-web-core', replacement: core },
    { find: '@device-manager-ui', replacement: moduleRoot },
  ], dedupe: ['vue', 'vue-router', 'ant-design-vue'] },
  css: { preprocessorOptions: { less: { javascriptEnabled: true, modifyVars: { 'primary-color': '#1677ff' } } } },
  server: { host: '127.0.0.1', port: 9310, strictPort: true, fs: { allow: [path.resolve(moduleRoot, '../..')] } },
})
