import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = await mkdtemp(path.join(tmpdir(), 'iot-alarm-tests-'))
try {
  const entry = path.join(output, 'test.mjs')
  await build({ entryPoints: [path.join(root, 'tests/alarmWorkspace.test.ts')], outfile: entry,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'warning',
    plugins: [{ name: 'mock-alarm-transport', setup(api) {
      api.onResolve({ filter: /^@jetlinks-web\/core$/ }, () => ({ path: path.join(root, 'tests/alarmRequest.test-shim.ts') }))
      api.onResolve({ filter: /^@jetlinks-web-core\/components\/ConditionFilter$/ }, () => ({ path: path.resolve(root, '../../jetlinks-web-core/src/components/ConditionFilter/utils.ts') }))
      api.onResolve({ filter: /^@jetlinks-web\/utils$/ }, () => ({ path: path.join(root, 'tests/alarmRequest.test-shim.ts') }))
      api.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({ path: path.join(root, 'tests/alarmRequest.test-shim.ts') }))
    } }],
  })
  process.exitCode = spawnSync(process.execPath, ['--test', entry], { stdio: 'inherit' }).status ?? 1
} finally {
  const resolved = path.resolve(output)
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('iot-alarm-tests-')) {
    throw new Error('Unexpected test output directory')
  }
  await rm(resolved, { recursive: true, force: true })
}
