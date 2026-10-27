import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
// Compile the existing extensionless TS imports with the same resolver as the app.
const result = await build({
  stdin: { contents: ['monitorData.test.ts', 'systemMonitor.test.ts', 'infrastructureDashboardLayout.test.ts']
    .map(name => `import ${JSON.stringify(path.join(root, 'tests', name))}`).join('\n'), resolveDir: root, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'monitor-transport-boundary', setup(plugin) {
    plugin.onResolve({ filter: /^@jetlinks-web\/core$/ }, () => ({ path: 'io', namespace: 'fixture' }))
    plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
      'export const request={post(){throw new Error("Unexpected real HTTP")}};export const wsClient={getWebSocket(){throw new Error("Unexpected real websocket")}};' }))
  } }],
})
const loaded = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, loaded, loaded.exports)
await import('../tests/realtimeResources.test.mjs')

await import('../tests/trendControls.test.mjs')
