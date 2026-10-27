import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url), module = { exports: {} }
const filename = resolve(import.meta.dirname, '../views/link/diagnostics/useJvmDiagnostics.ts')
new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? require(id) : {}, module, module.exports)
const { normalizeJfrSnapshot } = module.exports

test('JFR normalization retains reliable source lines and complete generated class/method identity', () => {
  const className = 'org.jetlinks.Service$$Lambda.0x0000000800b45000', method = 'apply'
  const snapshot = normalizeJfrSnapshot({ flameGraph: [{ className, method, line: 321, samples: 17, children: [{ className: 'reactor.core.Flux', method: 'subscribe', line: 42, samples: 17 }] }] }, 1000)
  assert.equal(snapshot.startedAt, 1000); assert.equal(snapshot.flameGraph[0].line, 321)
  assert.equal(snapshot.flameGraph[0].className, className); assert.equal(snapshot.flameGraph[0].method, method)
  assert.equal(snapshot.flameGraph[0].children[0].line, 42)
})

test('unknown, malformed and unsafe source lines cannot appear as source locations', () => {
  for (const line of [undefined, -1, 0, NaN, Infinity, '42', 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = normalizeJfrSnapshot({ flameGraph: [{ className: 'java.lang.Thread', method: 'run', line, samples: 1 }] }, 1)
    assert.equal(result.flameGraph[0].line, undefined)
  }
})
