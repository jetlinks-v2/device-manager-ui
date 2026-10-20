import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInfrastructureLayout, resizeDefaultInfrastructureLayout } from '../views/link/DashBoard/infrastructureDashboardLayout.ts'

test('default layout grows with node count and keeps trends directly below live resources', () => {
  for (const [count, height] of [[0, 8], [1, 8], [2, 11], [3, 13], [4, 13], [5, 13], [30, 13]]) {
    const [live, cpu, memory, network] = buildInfrastructureLayout(count)
    assert.equal(live.h, height)
    assert.equal(cpu.y, live.y + live.h)
    assert.equal(memory.y, cpu.y)
    assert.equal(network.y, cpu.y + cpu.h)
    assert.equal(cpu.w + memory.w, live.w)
  }
})

test('old default cache compacts, grows and shrinks without mutating its input', () => {
  const old = buildInfrastructureLayout(5)
  const snapshot = structuredClone(old)
  const single = resizeDefaultInfrastructureLayout(old, 1)!
  assert.deepEqual(single, buildInfrastructureLayout(1))
  const cluster = resizeDefaultInfrastructureLayout(single, 3)!
  assert.deepEqual(cluster, buildInfrastructureLayout(3))
  assert.deepEqual(resizeDefaultInfrastructureLayout(cluster, 1), single)
  assert.deepEqual(old, snapshot)
  assert.equal(resizeDefaultInfrastructureLayout(single, 1), undefined)
  for (const height of [7, 9]) {
    const previous = old.map(item => item.i === old[0].i ? { ...item, h: height } : { ...item, y: item.y - 13 + height })
    assert.deepEqual(resizeDefaultInfrastructureLayout(previous, 1), single)
  }
})

test('manual moves or sizes on any card and incomplete or duplicate caches are preserved', () => {
  const old = buildInfrastructureLayout(5)
  for (const index of [0, 1, 2, 3]) for (const field of ['x', 'y', 'w', 'h'] as const) {
    const personal = structuredClone(old)
    personal[index][field] += 1
    assert.equal(resizeDefaultInfrastructureLayout(personal, 1), undefined)
  }
  assert.equal(resizeDefaultInfrastructureLayout(old.slice(1), 1), undefined)
  assert.equal(resizeDefaultInfrastructureLayout([old[0], old[0], old[2], old[3]], 1), undefined)
})
