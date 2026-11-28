import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as vue from 'vue'
import ts from 'typescript'

test('a cached anchor waits for mounted virtual owner and measured height without emitting a zero anchor', async t => {
  const source = readFileSync(new URL('../views/device/list/unified/useDeviceListViewport.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}, width = vue.ref(520), height = vue.ref(0), readings = [], model = vue.ref({
    rows: Array.from({ length: 8 }, (_, i) => ({ id: String(i) })), revision: 0, readingIndex: 3, readingOffset: 0.8125,
    activeType: 'all', loading: false, loadingMore: false, hasMore: false, error: '', appendError: '',
  })
  new Function('require', 'exports', code)(id => id === 'vue' ? vue : { useElementSize: () => ({ width, height }) }, exports)
  const scope = vue.effectScope()
  const viewport = scope.run(() => exports.useDeviceListViewport(model, { visible() {}, more() {}, reading: (...args) => readings.push(args) }))
  t.after(() => scope.stop())
  const flush = async () => { for (let i = 0; i < 4; i++) await vue.nextTick() }
  await flush()
  let cardTop = 0, tableTop = 0
  viewport.cards.value = { scrollTo: top => { cardTop = top }, getScrollTop: () => cardTop }
  viewport.cardRange({ start: 0, end: 4 }); await flush()
  assert.deepEqual(readings, [])
  height.value = 480; await flush()
  assert.equal(cardTop, 640.5)
  viewport.cardRange({ start: 3, end: 8 })
  assert.deepEqual(readings.at(-1), [3, 0.8125])
  assert.equal(readings.some(([index]) => index === 0), false)
  width.value = 360; await flush()
  assert.equal(cardTop,701.5,'narrow cards reserve a status row and preserve the device anchor')
  width.value = 520; await flush()
  assert.equal(cardTop,640.5)
  viewport.table.value = { scrollTo: top => { tableTop = top } }
  width.value = 1400; await flush()
  assert.equal(tableTop, 274.5)
  model.value = { ...model.value, activeType: 'gateway', monitorCell: {} }
  width.value = 360; await flush()
  assert.equal(cardTop, 1037, 'the same device and fractional reading position survive the taller gateway card')
  width.value = 520; await flush()
  assert.equal(cardTop, 915, 'a wider card removes the extra status row without losing the reading position')
  width.value = 1400; await flush()
  assert.equal(tableTop, 335.5, 'returning to the gateway table keeps the same anchor')
})
