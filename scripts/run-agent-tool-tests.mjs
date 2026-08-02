import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = path.resolve(packageRoot, '../..')
const coreSourceRoot = path.join(runtimeRoot, 'jetlinks-web-core/src')
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'device-manager-agent-tool-tests-'))
const outputFile = path.join(outputDirectory, 'agentTools.test.mjs')

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
    plugins: [{
      name: 'device-manager-workspace-aliases',
      setup(buildApi) {
        buildApi.onResolve({
          filter: /^@jetlinks-web-core\/layout\/components\/AiChat\/clientToolApi$/,
        }, () => ({
          path: path.join(packageRoot, 'tests/clientToolApi.test-shim.ts'),
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
