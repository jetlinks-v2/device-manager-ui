import assert from 'node:assert/strict'
import test from 'node:test'
import dayjs from 'dayjs'
import { createRenderer, defineComponent, effectScope, h, KeepAlive, nextTick, ref } from 'vue'
import { useMonitorHistory } from '../visDashboard/SystemMonitor/hooks/useMonitorHistory'
import { createSystemMonitorRuntime, provideSystemMonitorRuntime, useSystemMonitorRuntime } from '../visDashboard/SystemMonitor/hooks/useSystemMonitorRuntime'
import { FOCUSED_NODES_STORAGE_KEY, readFocusedNodes } from '../visDashboard/SystemMonitor/utils/focusedNodes'
import type { MonitorObserver } from '../visDashboard/SystemMonitor/services/realtime'
import type { MonitorTimeRange } from '../visDashboard/SystemMonitor/types'

// A host-free Vue renderer exercises real mounted/activated/disposed hooks without a browser transport.
interface HostNode { children: HostNode[]; parent?: HostNode }
const node = (): HostNode => ({ children: [] })
const renderer = createRenderer<HostNode, HostNode>({
  createElement: node, createText: node, createComment: node,
  setText() {}, setElementText() {}, patchProp() {},
  parentNode: child => child.parent ?? null,
  nextSibling: () => null,
  insert(child, parent) {
    if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child)
    child.parent = parent
    parent.children.push(child)
  },
  remove(child) { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child) },
})
function mount<T>(setup: () => T) {
  let value!: T
  const app = renderer.createApp(defineComponent({ setup() { value = setup(); return () => h('div') } }))
  app.mount(node())
  return { value, unmount: () => app.unmount() }
}
const samples = (...ids: string[]) => ids.map(clusterNodeId => ({ clusterNodeId, value: { cpu: { systemUsage: 20 } } }))
function transport() {
  const observers: MonitorObserver[] = []
  let released = 0
  return { observers, get released() { return released }, subscribe(observer: MonitorObserver) {
    observers.push(observer)
    return { unsubscribe() { released++ } }
  } }
}
function memoryStorage(values: Record<string, string> = {}): Storage {
  return { get length() { return Object.keys(values).length }, clear() { Object.keys(values).forEach(key => delete values[key]) },
    key: index => Object.keys(values)[index] ?? null, getItem: key => values[key] ?? null,
    setItem: (key, value) => { values[key] = value }, removeItem: key => { delete values[key] } }
}
const flush = async () => { await Promise.resolve(); await nextTick() }

test('dashboard widgets share one live owner and independently persist focus', async () => {
  const source = transport()
  const storage = memoryStorage()
  const children: ReturnType<typeof useSystemMonitorRuntime>[] = []
  const Child = defineComponent({ setup() { children.push(useSystemMonitorRuntime(ref(false))); return () => h('span') } })
  const app = renderer.createApp(defineComponent({ setup() {
    provideSystemMonitorRuntime({ subscribe: source.subscribe, storage })
    return () => h('div', Array.from({ length: 4 }, () => h(Child)))
  } }))
  app.mount(node())
  try {
    assert.equal(source.observers.length, 1)
    assert.ok(children.every(child => child === children[0]))
    source.observers[0].next(samples('a', 'b'))
    children[0].selectNodes('cpu', [])
    children[0].selectNodes('memory', ['b'])
    const memoryFocus = children[0].selectedNodes.memory
    const cpuFocus = children[0].selectedNodes.cpu
    source.observers[0].next(samples('a', 'b'))
    assert.equal(children[0].selectedNodes.memory, memoryFocus, 'sampling must not reset chart zoom through a new selection')
    assert.equal(children[0].selectedNodes.cpu, cpuFocus)
    assert.deepEqual(children[0].selectedNodes.cpu, [])
    assert.deepEqual(children[0].selectedNodes.memory, ['b'])
    assert.equal(children[0].topologyVersion.value, 0)
    source.observers[0].next(samples('a', 'c'))
    assert.equal(children[0].topologyVersion.value, 1)
    assert.deepEqual(children[0].selectedNodes.cpu, [])
    assert.ok(!children[0].selectedNodes.memory.includes('b'))
    const { networkMode, ...saved } = JSON.parse(storage.getItem(FOCUSED_NODES_STORAGE_KEY)!)
    assert.equal(networkMode, 'auto')
    assert.deepEqual(readFocusedNodes(storage), saved)
  } finally { app.unmount() }
  assert.equal(source.released, 1)
  source.observers[0].next(samples('stale'))
  assert.deepEqual(children[0].nodeIds.value, ['a', 'c'])
})

test('focus cache accepts legacy preferences and tolerates malformed or unavailable storage', () => {
  assert.deepEqual(readFocusedNodes(memoryStorage({ 'jetlinks.runtime.monitor.focused-nodes.v1': '["a"]' })),
    { cpu: ['a'], memory: ['a'], network: ['a'] })
  assert.deepEqual(readFocusedNodes(memoryStorage({ [FOCUSED_NODES_STORAGE_KEY]: '{broken' })), {})
  assert.deepEqual(readFocusedNodes({ getItem() { throw new Error('disabled') } }), {})
})

test('preview never subscribes; retry releases the previous subscription and ignores its callbacks', async () => {
  const source = transport()
  const preview = ref(true)
  const mounted = mount(() => createSystemMonitorRuntime(preview, { subscribe: source.subscribe }))
  try {
    assert.equal(source.observers.length, 0)
    preview.value = false
    await nextTick()
    source.observers[0].error()
    assert.equal(mounted.value.error.value, true)
    mounted.value.refresh()
    assert.equal(source.released, 1)
    assert.equal(source.observers.length, 2)
    source.observers[0].next(samples('stale'))
    assert.deepEqual(mounted.value.nodes.value, [])
    source.observers[1].next([])
    assert.equal(mounted.value.error.value, false)
    assert.equal(mounted.value.loading.value, false)
    preview.value = true
    await nextTick()
    assert.equal(source.released, 2)
  } finally { mounted.unmount() }
})

test('missing realtime frames time out and a later frame recovers the state', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const source = transport()
  const mounted = mount(() => createSystemMonitorRuntime(ref(false), { subscribe: source.subscribe, staleAfterMs: 100 }))
  try {
    t.mock.timers.tick(101)
    assert.equal(mounted.value.error.value, true)
    source.observers[0].next(samples('a'))
    assert.equal(mounted.value.error.value, false)
    t.mock.timers.tick(101)
    assert.equal(mounted.value.error.value, true)
  } finally { mounted.unmount(); t.mock.timers.reset() }
})

test('cached route deactivation releases realtime and activation opens exactly one new subscription', async () => {
  const source = transport()
  const shown = ref(true)
  const Probe = defineComponent({ setup() { createSystemMonitorRuntime(ref(false), { subscribe: source.subscribe }); return () => h('div') } })
  const app = renderer.createApp({ setup: () => () => h(KeepAlive, () => shown.value ? h(Probe) : null) })
  app.mount(node())
  try {
    assert.equal(source.observers.length, 1)
    shown.value = false
    await nextTick()
    assert.equal(source.released, 1)
    shown.value = true
    await nextTick()
    assert.equal(source.observers.length, 2)
  } finally { app.unmount() }
  assert.equal(source.released, 2)
})

function historyHarness(preview = false) {
  const pending: Array<{ metric: string; range: MonitorTimeRange; resolve: (data: string[]) => void; reject: (error: Error) => void }> = []
  const metric = ref('cpuJvm')
  const isEdit = ref(preview)
  const topologyVersion = ref(0)
  const scope = effectScope()
  const history = scope.run(() => useMonitorHistory({ metric, isEdit, topologyVersion, empty: (): string[] => [],
    load: (metric, range) => new Promise<string[]>((resolve, reject) => pending.push({ metric, range, resolve, reject })) }))!
  return { history, metric, isEdit, topologyVersion, pending, stop: () => scope.stop() }
}

test('history rejects stale successes and errors after metric switches and disposal', async () => {
  const run = historyHarness()
  run.metric.value = 'cpuSystem'
  await nextTick()
  run.pending[1].resolve(['new'])
  await flush()
  run.pending[0].reject(new Error('old request'))
  await flush()
  assert.deepEqual(run.history.data.value, ['new'])
  assert.equal(run.history.error.value, false)
  run.metric.value = 'cpuJvm'
  await nextTick()
  run.stop()
  run.pending[2].resolve(['unmounted'])
  await flush()
  assert.deepEqual(run.history.data.value, ['new'])
})

test('history distinguishes failure from empty results and retries the unchanged custom range', async () => {
  const run = historyHarness()
  try {
    run.pending[0].reject(new Error('backend unavailable'))
    await flush()
    assert.equal(run.history.error.value, true)
    const range: MonitorTimeRange = [dayjs('2026-10-01'), dayjs('2026-10-02')]
    run.history.selectRange(range)
    await nextTick()
    run.pending[1].resolve([])
    await flush()
    assert.equal(run.history.error.value, false)
    assert.equal(run.history.loading.value, false)
    run.history.refresh()
    assert.deepEqual(run.pending[2].range.map(value => value.valueOf()), range.map(value => value.valueOf()))
    run.pending[2].resolve(['retried'])
    await flush()
    assert.deepEqual(run.history.data.value, ['retried'])
  } finally { run.stop() }
})

test('history preview makes no request and topology changes refresh once', async () => {
  const run = historyHarness(true)
  try {
    assert.equal(run.pending.length, 0)
    run.isEdit.value = false
    await nextTick()
    assert.equal(run.pending.length, 1)
    run.topologyVersion.value++
    await nextTick()
    assert.equal(run.pending.length, 2)
    run.isEdit.value = true
    await nextTick()
    run.pending[1].resolve(['stale preview'])
    await flush()
    assert.deepEqual(run.history.data.value, [])
    assert.equal(run.history.loading.value, false)
  } finally { run.stop() }
})
