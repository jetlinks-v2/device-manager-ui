import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(packageRoot, '../..')
const coreSourceRoot = path.join(runtimeRoot, 'jetlinks-web-core/src')
const coreTransportEntry = realpathSync(path.join(runtimeRoot, 'node_modules/@jetlinks-web/core/dist/index.mjs'))
const coreUtilsRequestContextEntry = realpathSync(path.join(coreSourceRoot, 'utils/request-context.ts'))
const webUtilsEntry = realpathSync(path.join(runtimeRoot, 'node_modules/@jetlinks-web/utils/dist/index.mjs'))
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'device-manager-agent-tool-tests-'))
const outputFile = path.join(outputDirectory, 'agentTools.test.mjs')
const exactPathFilter = (entry) => new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

try {
  await build({
    entryPoints: [path.join(packageRoot, 'tests/agentTools.test.ts')],
    outfile: outputFile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    logLevel: 'warning',
    define: {
      'import.meta.env.BASE_URL': JSON.stringify('/'),
      'import.meta.env.VITE_APP_BASE_API': JSON.stringify('/api'),
      'import.meta.env.VITE_APP_ENVIRONMENT': JSON.stringify(''),
      'import.meta.env.VITE_APP_NAME': JSON.stringify('iot'),
      'import.meta.env.VITE_APP_PROJECT_CODE': JSON.stringify(''),
      'import.meta.env.VITE_APP_RUNTIME_SCOPE': JSON.stringify('auto'),
      'import.meta.env.VITE_MICRO_APP': JSON.stringify('false'),
      'import.meta.env.VITE_PERSONAL_TOKEN_AI_KEY': JSON.stringify('personal_token'),
      'import.meta.env.VITE_PERSONAL_TOKEN_KEY': JSON.stringify('X-Personal-Token'),
      'import.meta.env.VITE_PERSONAL_TOKEN_URL_KEY': JSON.stringify(':X_Personal_Token'),
      'import.meta.env.VITE_STORE_TOKEN_KEY': JSON.stringify('X-Access-Token'),
      'import.meta.env.VITE_TOKEN_KEY': JSON.stringify('X-Access-Token'),
      'import.meta.env.VITE_TOKEN_KEY_URL': JSON.stringify(':X_Access_Token'),
    },
    plugins: [{
      name: 'device-manager-workspace-aliases',
      setup(buildApi) {
        buildApi.onResolve({
          filter: /^@jetlinks-web-core\/router$/,
        }, () => ({
          path: 'device-manager-test-router',
          namespace: 'device-manager-tests',
        }))
        buildApi.onLoad({
          filter: /^device-manager-test-router$/,
          namespace: 'device-manager-tests',
        }, () => ({
          contents: 'export default { push: async () => undefined }',
          loader: 'js',
        }))
        // TypeScript path resolution expands this exact import before onResolve; keep the
        // test bundle out of the application router's lazy Vue route graph.
        buildApi.onLoad({
          filter: /[/\\]jetlinks-web-core[/\\]src[/\\]router[/\\]index\.ts$/,
        }, () => ({
          contents: 'export default { push: async () => undefined }',
          loader: 'js',
        }))
        buildApi.onResolve({
          filter: /^@jetlinks-web-core\/layout\/components\/AiChat\/clientToolApi$/,
        }, () => ({
          path: path.join(packageRoot, 'tests/clientToolApi.test-shim.ts'),
        }))
        buildApi.onResolve({
          filter: /^@jetlinks-web-core\/locales$/,
        }, () => ({
          path: path.join(packageRoot, 'tests/i18n.test-shim.ts'),
        }))
        // Node test transport boundary: api/comm imports only getBaseApi from the public
        // utils barrel. Keeping this as an exact virtual module avoids loading browser-only
        // barrel side effects while preserving the runner's canonical /api base.
        buildApi.onResolve({ filter: /^@jetlinks-web-core\/utils$/ }, () => ({
          path: 'device-manager-test-transport-boundary',
          namespace: 'device-manager-tests',
        }))
        buildApi.onLoad({
          filter: /^device-manager-test-transport-boundary$/,
          namespace: 'device-manager-tests',
        }, () => ({
          contents: "export const getBaseApi = () => '/api'",
          loader: 'js',
        }))
        // TypeScript/package resolution reaches these physical entries before onResolve.
        // They are the only two proven browser-only transport barrels in this declaration bundle.
        buildApi.onLoad({
          filter: exactPathFilter(coreUtilsRequestContextEntry),
        }, () => ({
          contents: "export const getBaseApi = () => '/api'; export const isFromCloud = () => false",
          loader: 'js',
        }))
        buildApi.onLoad({
          filter: exactPathFilter(coreTransportEntry),
        }, () => ({
          contents: `
            const unavailable = () => { throw new Error('Node declaration test transport is unavailable') }
            export const request = new Proxy({}, { get: () => unavailable })
            export const wsClient = new Proxy({}, { get: () => unavailable })
          `,
          loader: 'js',
        }))
        buildApi.onLoad({
          filter: exactPathFilter(webUtilsEntry),
        }, () => ({
          contents: "export const randomString = () => 'node-declaration-test'; export const getToken = () => undefined",
          loader: 'js',
        }))
        buildApi.onResolve({ filter: /^@jetlinks-web-core\// }, args => {
          const target = path.join(coreSourceRoot, args.path.slice('@jetlinks-web-core/'.length))
          const resolved = [`${target}.ts`, `${target}.tsx`, path.join(target, 'index.ts')]
            .find(candidate => existsSync(candidate))
          return resolved ? { path: resolved } : undefined
        })
      },
    }],
  })
  const result = spawnSync(process.execPath, ['--test', outputFile], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  await rm(outputDirectory, { recursive: true, force: true })
}
