import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, reactive } from 'vue'
import { canReadStatistics, inputRate, statisticsStatus, type RuleStatisticsSnapshot, type StatisticsTarget } from '../views/device/components/PropertyRules/statistics/model'
import { queryRuleStatistics } from '../views/device/components/PropertyRules/statistics/api'
import { useRuleStatistics } from '../views/device/components/PropertyRules/statistics/useRuleStatistics'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'

const snapshot = (property = 'temperature', changes: Partial<RuleStatisticsSnapshot> = {}): RuleStatisticsSnapshot => ({
  ruleId: `r-${property}`, property, nodeId: 'n1', generation: 'g1', loaded: true, startedAt: 100, sampledAt: 1000,
  input: 20, output: 10, cleaned: 5, sampled: 5, bypassed: 0, errors: 0, ...changes,
})
const target = (property = 'temperature', changes: Partial<StatisticsTarget> = {}): StatisticsTarget => ({ property, source: 'product', permitted: true, ...changes })
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }

function mount(targets = [target()]) {
  const document = new EventTarget()
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true })
  const props = reactive({ scope: { productId: 'p1', deviceId: undefined as string | undefined }, targets })
  let state!: ReturnType<typeof useRuleStatistics>
  const renderer = createRenderer({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}),
    createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
  const app = renderer.createApp(defineComponent({ setup() { state = useRuleStatistics(props); return () => null } }))
  app.mount({})
  return { props, state, document, unmount() { app.unmount(); Reflect.deleteProperty(globalThis, 'document') } }
}

test('statistics reuse authorized scope reads without granting inherited product-wide access', () => {
  const product = { productId: 'p1' }
  const device = { ...product, deviceId: 'd1' }
  assert.equal(canReadStatistics('product', product, false), true)
  assert.equal(canReadStatistics('device', device, false), true)
  assert.equal(canReadStatistics('product', device, false), false)
  assert.equal(canReadStatistics('product', device, true), true)
  assert.equal(canReadStatistics('disabled', device, true), false)
  assert.equal(canReadStatistics('none', product, true), false)
  assert.equal(canReadStatistics('device', product, true), false)
})

test('rates only compare valid snapshots of one rule, node and generation', () => {
  const first = snapshot()
  assert.equal(inputRate(first, snapshot('temperature', { input: 30, sampledAt: 6000 })), 2)
  for (const changes of [{ nodeId: 'n2' }, { ruleId: 'r2' }, { generation: 'g2' }, { input: 1 }, { sampledAt: 999 }, { loaded: false }]) {
    assert.equal(inputRate(first, snapshot('temperature', changes)), undefined)
  }
  assert.equal(inputRate(undefined, first), undefined)
  assert.equal(inputRate(first, snapshot('temperature', { input: 20, sampledAt: 6000 })), 0)
})

test('cumulative exceptions take precedence; cleaned and suppressed values are not failures', () => {
  assert.equal(statisticsStatus(target(), {}), 'unread')
  assert.equal(statisticsStatus(target(), { loading: true }), 'loading')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot() }), 'executed')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot('temperature', { input: 0 }) }), 'empty')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot('temperature', { loaded: false }) }), 'unloaded')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot('temperature', { bypassed: 2 }) }), 'bypassed')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot('temperature', { bypassed: 2, errors: 1 }) }), 'errors')
  assert.equal(statisticsStatus(target(), { snapshot: snapshot(), failure: 'failed' }), 'failed')
  assert.equal(statisticsStatus(target('t', { permitted: false }), {}), 'forbidden')
  assert.equal(statisticsStatus(target('t', { source: 'disabled' }), {}), 'disabled')
})

test('API sends property array and routes product/device independently; unloaded null fields may be omitted', async () => {
  const requests: string[] = []
  setAlarmRequestHandler(async (url, body) => { requests.push(url); assert.deepEqual(body, ['temperature']); return { result: [snapshot()] } })
  await queryRuleStatistics({ productId: 'p/a', deviceId: 'd/b' }, 'product', ['temperature'])
  await queryRuleStatistics({ productId: 'p/a', deviceId: 'd/b' }, 'device', ['temperature'])
  assert.match(requests[0], /product\/p%2Fa\/property\/_statistics$/)
  assert.match(requests[1], /device\/p%2Fa\/d%2Fb\/property\/_statistics$/)
  setAlarmRequestHandler(async () => ({ result: [{ ruleId: 'r1', property: 'temperature', nodeId: 'n1', loaded: false, startedAt: 0, sampledAt: 1000 }] }))
  assert.equal((await queryRuleStatistics({ productId: 'p1' }, 'product', ['temperature']))[0].loaded, false)
})

test('API rejects missing, duplicate, malformed or wrong-node snapshots and preserves errors', async () => {
  for (const rows of [[], [snapshot('other')], [snapshot('temperature', { input: -1 })], [snapshot(), snapshot()], [snapshot('temperature', { nodeId: 'n2' })]]) {
    setAlarmRequestHandler(async () => ({ result: rows }))
    await assert.rejects(queryRuleStatistics({ productId: 'p1' }, 'product', ['temperature'], 'n1'))
  }
  for (const [status, kind] of [[404, 'unavailable'], [403, 'forbidden'], [500, 'failed']] as const) {
    setAlarmRequestHandler(async () => { throw { response: { status } } })
    await assert.rejects(queryRuleStatistics({ productId: 'p1' }, 'product', ['temperature']), { kind })
  }
  await assert.rejects(queryRuleStatistics({ productId: 'p1' }, 'product', Array(101).fill('t')))
  setAlarmRequestHandler(async () => { throw { response: { status: 406, data: { code: 'method_not_allowed' } } } })
  await assert.rejects(queryRuleStatistics({ productId: 'p1' }, 'product', ['temperature']), { kind: 'unavailable' })
})

test('prefetch batches at 100, skips unauthorized/inactive scopes, and caches show-more rows', async () => {
  const sizes: number[] = []
  setAlarmRequestHandler(async (_url, body) => { const ids = body as unknown as string[]; sizes.push(ids.length); return { result: ids.map(id => snapshot(id)) } })
  const panel = mount([...Array.from({ length: 205 }, (_, i) => target(`p${i}`)), target('no-access', { permitted: false }), target('off', { source: 'disabled' })])
  try {
    await settle()
    assert.deepEqual(sizes, [100, 100, 5])
    assert.equal(panel.state.entries['no-access'], undefined)
    panel.props.targets.push(target('new'))
    await settle()
    assert.deepEqual(sizes, [100, 100, 5, 1])
  } finally { panel.unmount() }
})

test('one poller refreshes only the open rule and stops on close, failure, hidden page and unmount', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let requests = 0
  setAlarmRequestHandler(async () => { requests++; return { result: [snapshot('temperature', { input: requests * 20, sampledAt: requests * 5000 })] } })
  const panel = mount()
  try {
    await settle()
    context.mock.timers.tick(10000); await settle()
    assert.equal(requests, 1, 'no background polling while closed')
    panel.state.toggle('temperature', true); await settle()
    assert.equal(requests, 2)
    assert.equal(panel.state.entries.temperature.rate, 4)
    context.mock.timers.tick(5000); await settle()
    assert.equal(requests, 3)
    panel.state.close(); context.mock.timers.tick(15000); await settle()
    assert.equal(requests, 3)
    panel.state.toggle('temperature', true); await settle()
    Object.defineProperty(panel.document, 'visibilityState', { value: 'hidden', configurable: true })
    panel.document.dispatchEvent(new Event('visibilitychange'))
    context.mock.timers.tick(15000); await settle()
    assert.equal(requests, 4)
    Object.defineProperty(panel.document, 'visibilityState', { value: 'visible', configurable: true })
    panel.document.dispatchEvent(new Event('visibilitychange')); await settle()
    assert.equal(requests, 5)
    setAlarmRequestHandler(async () => { requests++; throw new Error('offline') })
    context.mock.timers.tick(5000); await settle()
    assert.equal(panel.state.entries.temperature.failure, 'failed')
    context.mock.timers.tick(15000); await settle()
    assert.equal(requests, 6, 'failure stops automatic retries')
  } finally { panel.unmount() }
  context.mock.timers.tick(15000); await settle()
  assert.equal(requests, 6)
})

test('manual refresh rechecks a rejected authorization while automatic retries stay stopped', async () => {
  let requests = 0
  setAlarmRequestHandler(async () => {
    if (++requests === 1) throw { response: { status: 403 } }
    return { result: [snapshot()] }
  })
  const panel = mount()
  try {
    await settle()
    assert.equal(panel.state.entries.temperature.failure, 'forbidden')
    panel.state.toggle('temperature', true); await settle()
    assert.equal(requests, 1)
    await panel.state.refresh(); await settle()
    assert.equal(requests, 2)
    assert.equal(panel.state.entries.temperature.failure, undefined)
    assert.equal(panel.state.entries.temperature.snapshot?.loaded, true)
  } finally { panel.unmount() }
})

test('late responses cannot cross categories, scopes or permission changes', async () => {
  let release!: (value: unknown) => void
  setAlarmRequestHandler(() => new Promise(resolve => { release = resolve }))
  const panel = mount()
  try {
    await settle()
    panel.props.targets = [target('new')]
    await nextTick()
    release({ result: [snapshot()] }); await settle()
    assert.equal(panel.state.entries.temperature, undefined)
    panel.props.targets[0].permitted = false
    await nextTick()
    release({ result: [snapshot('new')] }); await settle()
    assert.equal(panel.state.entries.new, undefined)
    panel.props.scope.productId = 'p2'; await settle()
    assert.equal(Object.keys(panel.state.entries).length, 0)
  } finally { panel.unmount() }
})

test('observation stays on its actual node and resets on version changes, not on cumulative errors', async () => {
  const options: (Record<string, unknown> | undefined)[] = []
  let calls = 0
  setAlarmRequestHandler(async (_url, _body, config) => {
    options.push(config); calls++
    return { result: [snapshot('temperature', { generation: calls > 2 ? 'g2' : 'g1', sampledAt: calls * 1000, input: calls * 20 })] }
  })
  const panel = mount()
  try {
    await settle()
    panel.state.toggle('temperature', true); await settle()
    assert.equal(options[0]?.params, undefined)
    assert.deepEqual(options[1]?.params, { nodeId: 'n1' })
    assert.equal(panel.state.entries.temperature.rate, 20)
    panel.state.refresh(); await settle()
    assert.equal(panel.state.entries.temperature.rate, undefined)
    assert.equal(panel.state.entries.temperature.restarted, true)
    assert.equal(options[0]?.hiddenError, true)
  } finally { panel.unmount() }
})

test('requests never overlap, even when opening while prefetch is in flight', async () => {
  let release!: (value: unknown) => void
  let requests = 0
  setAlarmRequestHandler(() => { requests++; return new Promise(resolve => { release = resolve }) })
  const panel = mount()
  try {
    await settle()
    panel.state.toggle('temperature', true)
    panel.state.refresh(); panel.state.refresh()
    await settle()
    assert.equal(requests, 1)
    release({ result: [snapshot()] }); await settle()
    assert.equal(panel.state.entries.temperature.loading, undefined)
    assert.equal(requests, 1)
  } finally { panel.unmount() }
})

test('unavailable service is detected once and explicitly retryable; save resets rate baseline', async () => {
  let calls = 0
  setAlarmRequestHandler(async () => { calls++; throw { response: { status: 404 } } })
  const panel = mount()
  try {
    await settle()
    panel.props.targets.push(target('extra')); await settle()
    assert.equal(calls, 1)
    setAlarmRequestHandler(async (_url, body) => ({ result: (body as unknown as string[]).map(id => snapshot(id)) }))
    panel.state.toggle('temperature', true); await settle()
    panel.state.refresh(); await settle()
    assert.equal(panel.state.entries.temperature.snapshot?.nodeId, 'n1')
    panel.state.reset(); await settle()
    assert.equal(panel.state.entries.temperature.rate, undefined)
    assert.equal(panel.state.entries.temperature.failure, undefined)
  } finally { panel.unmount() }
})
