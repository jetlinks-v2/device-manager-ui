import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
let observeResize
const code = ts.transpileModule(readFileSync(new URL('../views/device/list/unified/useDeviceListColumnLayout.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const exports = {}
const widthExports = {}
new Function('require', 'exports', 'requestAnimationFrame', 'cancelAnimationFrame', ts.transpileModule(
  readFileSync(new URL('../views/device/components/useTableBodyWidth.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(
  id => id === '@vueuse/core' ? { useResizeObserver: (_, callback) => { observeResize = callback } } : require(id),
  widthExports, callback => { callback(); return 1 }, () => {},
)
new Function('require', 'exports', 'requestAnimationFrame', 'cancelAnimationFrame', code)(
  id => id.endsWith('/useTableBodyWidth') ? widthExports : require(id),
  exports, callback => { callback(); return 1 }, () => {},
)
const { getDeviceListColumnLayout, useDeviceListColumnLayout } = exports

function sumColumns(layout, type, channel) {
  return layout.selection + layout.name + layout.product + layout.brand + layout.area + layout.status + layout.action
    + (type === 'all' ? layout.time * 2 : 0)
    + (type === 'gateway' ? layout.monitor : 0)
    + (['gateway', 'video'].includes(type) && channel ? layout.channel : 0)
}

test('desktop widths fill the table for each category while names and brands stay bounded', () => {
  for (const width of [1280, 1340, 1600, 1920, 2560, 3200]) {
    for (const type of ['all', 'gateway', 'video', 'device']) {
      for (const space of [true, false]) {
        for (const channel of [true, false]) {
          const layout = getDeviceListColumnLayout(width, type, space, channel)
          assert.equal(layout.tableWidth, width)
          assert.equal(sumColumns(layout, type, channel), width)
          assert(layout.name >= 220 && layout.name <= 320)
          assert(layout.brand >= 120 && layout.brand <= 200)
          assert(layout.product >= 150)
          assert(layout.area >= (space ? 160 : 140))
        }
      }
    }
  }
})

test('time, status, actions and monitoring never shrink or stretch with the window', () => {
  for (const width of [600, 960, 1340, 1920, 3200]) {
    const layout = getDeviceListColumnLayout(width, 'gateway', true, true)
    assert.deepEqual([layout.time, layout.status, layout.action, layout.monitor, layout.channel], [180, 90, 90, 220, 100])
  }
})

test('narrow windows preserve readable minimum widths and request horizontal scrolling', () => {
  for (const type of ['all', 'gateway', 'video', 'device']) {
    const layout = getDeviceListColumnLayout(600, type, true, true)
    assert(layout.tableWidth > 600)
    assert.equal(sumColumns(layout, type, true), layout.tableWidth)
    assert.deepEqual([layout.name, layout.product, layout.brand, layout.area], [220, 150, 120, 160])
  }
})

test('container and sidebar resizing use the body width after its real scrollbar; category changes recompute the budget', () => {
  let measuredWidth = 1342
  const panel = vue.shallowRef({ clientWidth: 1352, querySelector: () => ({ clientWidth: measuredWidth }) })
  const type = vue.ref('all'), space = vue.ref(true), channel = vue.ref(true)
  const scope = vue.effectScope()
  const layout = scope.run(() => useDeviceListColumnLayout(panel, type, space, channel))
  observeResize()
  assert.equal(layout.value.tableWidth, 1342)
  const originalName = layout.value.name
  measuredWidth = 1590
  observeResize()
  assert.equal(layout.value.tableWidth, 1590)
  assert(layout.value.name >= originalName)
  measuredWidth = 800
  observeResize()
  assert.equal(layout.value.tableWidth, 1222)
  type.value = 'gateway'
  assert.equal(layout.value.tableWidth, 1182)
  channel.value = false
  assert.equal(layout.value.tableWidth, 1082)
  space.value = false
  assert.equal(layout.value.tableWidth, 1062)
  scope.stop()
})
