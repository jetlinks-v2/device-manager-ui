import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { nextTick, ref, watch } from 'vue'

const cases = [
  ['../views/device/list/components/device-detail/IotDevicePropertyHistoryChart.vue', 'queryCharts'],
  ['../views/device/list/components/device-detail/IotDevicePropertyMiniChart.vue', 'queryMiniChart'],
  ['../views/device/list/components/device-detail/useIotDevicePropertySparklineData.ts', 'scheduleLoad'],
  ['../views/device/list/components/device-detail/useIotDevicePropertyTrajectory.ts', 'queryTrajectory'],
  ['../views/device/list/components/device-detail/IotDevicePropertyDetailModal.vue', 'loadRows'],
]

function scriptContent(path, source) {
  if (!path.endsWith('.vue')) return source
  return source.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/)?.[1] ?? ''
}

function findRequestWatcher(source, callbackName) {
  let result
  const visit = node => {
    if (result || !ts.isCallExpression(node) || node.expression.getText(source) !== 'watch') {
      ts.forEachChild(node, visit)
      return
    }
    const callback = node.arguments[1]?.getText(source) ?? ''
    if (callback.includes(callbackName)) result = node
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

test('realtime property updates do not retrigger history queries through array identity', async t => {
  for (const [path, callbackName] of cases) {
    await t.test(path, async () => {
      const raw = await readFile(new URL(path, import.meta.url), 'utf8')
      const source = ts.createSourceFile(path, scriptContent(path, raw), ts.ScriptTarget.Latest, true)
      const watcher = findRequestWatcher(source, callbackName)
      assert.ok(watcher, `watcher for ${callbackName} exists`)
      assert.ok(ts.isArrayLiteralExpression(watcher.arguments[0]), `${callbackName} compares each query input independently`)
    })
  }
})

test('multi-source query watcher ignores a realtime value-only property replacement', async () => {
  const property = ref({ identifier: 'cpu', valueType: { type: 'float' }, value: 20, updatedAt: '10:00:00' })
  let queryCount = 0
  const stop = watch(
    [
      () => property.value.identifier,
      () => property.value.valueType.type,
    ],
    () => { queryCount += 1 },
  )

  property.value = { ...property.value, value: 21, updatedAt: '10:00:01' }
  await nextTick()
  assert.equal(queryCount, 0)

  property.value = { ...property.value, identifier: 'memory' }
  await nextTick()
  assert.equal(queryCount, 1)
  stop()
})
