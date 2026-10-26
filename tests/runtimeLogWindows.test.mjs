import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
const require = createRequire(import.meta.url), cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => id === '@jetlinks-web-core/components/RuntimeDiagnostics/utils' ? load(resolve(import.meta.dirname, '../../../jetlinks-web-core/src/components/RuntimeDiagnostics/utils.ts')) : id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { mergeLogWindows, joinedLogWindow, entriesForLogWindows } = load(resolve(import.meta.dirname, '../views/link/diagnostics/logWindows.ts'))
const window = (start, end, lines) => ({ startPosition: start, endPosition: end, previousPosition: start || undefined, nextPosition: end, lines, truncated: false })

test('cursor-adjacent repeated lines remain distinct and prepending keeps old row identity', () => {
  const a = window(0, 10, ['same', 'same']), b = window(10, 20, ['same', 'same'])
  const before = entriesForLogWindows([b]), merged = mergeLogWindows([b], a, 'backward')
  assert.equal(joinedLogWindow(merged.chunks).lines.length, 4)
  const records = entriesForLogWindows(merged.chunks)
  assert.deepEqual(records.slice(2).map(entry => entry.id), before.map(entry => entry.id))
  assert.equal(new Set(records.map(entry => entry.id)).size, 4)
  const overlap = mergeLogWindows([a], window(5, 15, ['overlap']), 'forward')
  assert.equal(overlap.chunks.length, 1, 'overlap is replaced, never guessed from text length')
})

test('EOF keeps prior text; bounded rolling chunks restore the matching direction cursors', () => {
  const a = window(0, 10, ['old']), b = window(10, 10, [])
  b.nextPosition = undefined
  assert.deepEqual(joinedLogWindow(mergeLogWindows([a], b, 'forward').chunks).lines, ['old'])
  assert.equal(joinedLogWindow(mergeLogWindows([a], b, 'forward').chunks).nextPosition, undefined)
  let chunks = []
  for (let n = 0; n < 7; n++) chunks = mergeLogWindows(chunks, window(n * 10, (n + 1) * 10, Array(500).fill(`line${n}`)), 'forward').chunks
  assert.equal(joinedLogWindow(chunks).lines.length, 2500)
  assert.equal(joinedLogWindow(chunks).startPosition, 20)
  assert.equal(joinedLogWindow(chunks).previousPosition, 20)
  const prepend = mergeLogWindows(chunks, window(10, 20, Array(500).fill('earlier')), 'backward')
  assert.equal(prepend.clipped, true); assert.equal(joinedLogWindow(prepend.chunks).endPosition, 60)
})

test('multiline stack crossing windows stays attached to its actual structured header', () => {
  const a = window(0, 80, ['2026-10-22 12:34:56.789 ERROR 1 --- [main] app.Logger : failed'])
  const b = window(80, 130, ['java.lang.IllegalStateException: failed', '\tat app.Worker.run(Worker.java:1)'])
  const entries = entriesForLogWindows([a, b])
  assert.equal(entries.length, 1); assert.equal(entries[0].id, '0:0'); assert.match(entries[0].stack, /Worker/)
})

test('ordinary message fields and payload across adjacent windows stay lossless under the original header identity', () => {
  const a = window(40, 80, ['2026-10-22 12:34:56.789 INFO 1 --- [main] app.Logger : request dump', 'method: POST'])
  const b = window(80, 130, ['path: /api', '', 'plain body', '  nested detail'])
  const before = entriesForLogWindows([a]), entries = entriesForLogWindows([a, b])
  assert.equal(entries.length, 1); assert.equal(entries[0].id, before[0].id)
  assert.equal(entries[0].message, 'request dump\nmethod: POST\npath: /api\n\nplain body\n  nested detail')
  assert.equal(entries[0].stack, undefined); assert.equal(entries[0].raw, [...a.lines, ...b.lines].join('\n'))
})
