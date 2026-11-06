import assert from 'node:assert/strict'
import test from 'node:test'
import { runtimeModules } from './helpers/runtimeModules.mjs'

const { nodeOverviewDashboard, nodeOverviewLayoutKey, nodeOverviewLayout, nodeOverviewSummaryMetric, nodeResourceChartCapacity } = runtimeModules().load('views/link/diagnostics/overview/nodeOverviewDashboard.ts')

test('personal layouts are isolated across scope, node and narrow viewport', () => {
  assert.equal(nodeOverviewLayoutKey(undefined, 'node', 'regular'), undefined)
  const keys = [nodeOverviewLayoutKey('account:one:project', 'iot:8200', 'regular'), nodeOverviewLayoutKey('account:two:project', 'iot:8200', 'regular'), nodeOverviewLayoutKey('account:one:project', 'ai:7100', 'regular'), nodeOverviewLayoutKey('account:one:project', 'iot:8200', 'narrow'), nodeOverviewLayoutKey('account:one:project', 'iot:8200', 'wide'), nodeOverviewLayoutKey('account:one:project', 'iot:8200', 'compact')]
  assert.equal(new Set(keys).size, keys.length)
  assert.ok(keys.every(key => key.includes(':overview-layout:v2:')))
})

test('capability filtering retains widget identities and never persists runtime samples', () => {
  const full = nodeOverviewDashboard('regular', ['device', 'buffer', 'resources']), limited = nodeOverviewDashboard('regular', ['resources'])
  assert.deepEqual(full.components.map(item => item.id), limited.components.map(item => item.id))
  assert.deepEqual(limited.components.filter(item => item.visible).map(item => item.id), ['summary-cpu', 'summary-heap', 'resources'])
  assert.equal(limited.components.find(item => item.type === 'resources').componentProps.gridItem.y, 9)
  assert.deepEqual(Object.keys(full.components[0].componentProps), ['gridItem'])
})

test('default widgets do not overlap; narrow trends reserve full width and more height', () => {
  for (const mode of ['regular', 'compact', 'narrow', 'wide']) {
    const components = nodeOverviewDashboard(mode, ['device', 'buffer', 'resources']).components.filter(item => item.visible)
    for (let index = 0; index < components.length; index++) {
      const item = components[index].componentProps.gridItem
      assert.ok(item.x >= 0 && item.x + item.w <= 12)
      for (const other of components.slice(index + 1)) {
        const next = other.componentProps.gridItem
        assert.ok(item.x + item.w <= next.x || next.x + next.w <= item.x || item.y + item.h <= next.y || next.y + next.h <= item.y, `${mode}: ${components[index].id} overlaps ${other.id}`)
      }
    }
    for (const { type, componentProps: { gridItem } } of components) {
      assert.ok(gridItem.h >= gridItem.minH)
      assert.ok(gridItem.w >= gridItem.minW)
      if (type !== 'summary' && mode !== 'wide') assert.equal(gridItem.w, 12)
      if (type !== 'summary' && mode === 'narrow') { assert.equal(gridItem.minW, 12); assert.ok(gridItem.h >= 28) }
    }
  }
})

test('content-width breakpoints pair groups only when both groups fit and resource expansion reserves height', () => {
  assert.deepEqual([375,559,560,767,768,1199,1200].map(nodeOverviewLayout), ['narrow','narrow','compact','compact','regular','regular','wide'])
  const full = nodeOverviewDashboard('wide', ['device','buffer','resources']).components.filter(item => item.type !== 'summary')
  assert.equal(full[0].componentProps.gridItem.y, full[1].componentProps.gridItem.y)
  assert.equal(full[1].componentProps.gridItem.x, 6)
  assert.equal(full[2].componentProps.gridItem.y, full[0].componentProps.gridItem.y + full[0].componentProps.gridItem.h)
  const expanded = nodeOverviewDashboard('regular', ['resources'], true).components.at(-1)
  assert.equal(expanded.componentProps.gridItem.h, expanded.componentProps.gridItem.minH)
  assert.ok(expanded.componentProps.gridItem.h > full[2].componentProps.gridItem.h)
})

test('summary widgets share the canvas and evenly fill available rows without unavailable capabilities', () => {
  const cards = (mode, groups) => nodeOverviewDashboard(mode, groups).components.filter(item => item.type === 'summary' && item.visible)
  assert.deepEqual(cards('regular', ['device','buffer','resources']).map(item => nodeOverviewSummaryMetric(item.id)), ['messages','backlog','cpu','heap'])
  assert.deepEqual(cards('regular', ['buffer','resources']).map(item => item.componentProps.gridItem.w), [4,4,4])
  assert.deepEqual(cards('compact', ['buffer','resources']).map(item => item.componentProps.gridItem.w), [6,6,12])
  assert.deepEqual(cards('narrow', ['device','buffer','resources']).map(item => item.componentProps.gridItem.y), [0,0,10,10])
  assert.equal(cards('regular', []).length, 0)
  assert.equal(nodeOverviewSummaryMetric('unrelated'), undefined)
})

test('resources progressively reveal charts when rows fit; narrow panels budget each chart as a row', () => {
  assert.equal(nodeResourceChartCapacity(720, 240), 2)
  assert.equal(nodeResourceChartCapacity(720, 460), 4)
  assert.equal(nodeResourceChartCapacity(720, 650), 6)
  assert.equal(nodeResourceChartCapacity(375, 506), 2)
  assert.equal(nodeResourceChartCapacity(375, 650), 3)
  assert.equal(nodeResourceChartCapacity(543, 460), 2)
  assert.equal(nodeResourceChartCapacity(544, 460), 4)
  assert.equal(nodeResourceChartCapacity(0, 0), 2)
  // Resizing back cannot latch the expanded state or alter the stored group coordinates.
  assert.equal(nodeResourceChartCapacity(720, 240), 2)
})
