import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const filename = resolve(import.meta.dirname, '../views/link/RuntimeMonitor/useClusterSidebarLayout.ts')
const width = vue.ref(1100), height = vue.ref(900), top = vue.ref(200), module = { exports: {} }
new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : {
  useElementSize: () => ({ width }), useElementBounding: () => ({ top }), useWindowSize: () => ({ height }),
}, module, module.exports)

test('node navigation uses the heading on narrow screens or collapse, keeps collapse through resize, and omits single-node controls', () => {
  const scope = vue.effectScope(), multiple = vue.ref(true), enabled = vue.ref(true)
  const layout = scope.run(() => module.exports.useClusterSidebarLayout(vue.ref(), multiple, enabled))
  try {
    assert.equal(layout.showList.value, true); assert.equal(layout.expanded.value, true); assert.equal(layout.compact.value, false)
    assert.equal(layout.canToggle.value, true); assert.equal(layout.gridStyle.value.gridTemplateColumns, '280px minmax(0, 1fr)')
    layout.setCollapsed(true)
    assert.equal(layout.expanded.value, false); assert.equal(layout.compact.value, true)
    assert.equal(layout.gridStyle.value.gridTemplateColumns, 'minmax(0, 1fr)')
    width.value = 720; assert.equal(layout.showList.value, false); assert.equal(layout.compact.value, true)
    assert.equal(layout.canToggle.value, false, 'narrow screens use the heading selector instead of a sidebar toggle')
    width.value = 1100; assert.equal(layout.showList.value, true); assert.equal(layout.expanded.value, false, 'resize retains the explicit collapse')
    layout.toggle(); assert.equal(layout.expanded.value, true)
    multiple.value = false; assert.equal(layout.showList.value, false); assert.equal(layout.compact.value, false)
    multiple.value = true; layout.setCollapsed(true); enabled.value = false; enabled.value = true
    assert.equal(layout.expanded.value, true, 'remounted columns and host state both return to expanded')
    width.value = 0; assert.equal(layout.showList.value, true, 'initial unmeasured width does not select a second layout tree')
  } finally { scope.stop() }
})

test('tree viewport stays bounded through scrolling, resize and a temporarily unavailable container', () => {
  const scope = vue.effectScope(), layout = scope.run(() => module.exports.useClusterSidebarLayout(vue.ref(), vue.ref(true), vue.ref(true)))
  try {
    height.value = 900; top.value = 200; assert.equal(layout.listHeight.value, 684)
    top.value = -500; assert.equal(layout.listHeight.value, 884)
    height.value = 600; top.value = 700; assert.equal(layout.listHeight.value, 1)
    top.value = 100; assert.equal(layout.listHeight.value, 484)
  } finally { scope.stop() }
})
