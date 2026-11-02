import type { Observable, Subscription } from 'rxjs'
import type { MBeanCollectionPlan, MBeanCollectionRecord, MBeanCollectionSample } from '../../../../api/link/mbeanCollection'

export type MBeanResult = { nodeId: string; collectedAt: number } & (
  { status: 'fulfilled'; value: Record<string, unknown> } | { status: 'rejected'; reason: unknown }
)
export interface MBeanDemand { nodeIds: string[]; name: string; attributes: string[]; enabled: boolean }
interface Consumer { demand: MBeanDemand; receive: (result: MBeanResult) => void }
type Stream = (plan: MBeanCollectionPlan) => Observable<MBeanCollectionRecord>

/** 页面独占的声明注册表；计划签名稳定时不重连，所有传输结果受 revision 与身份约束。 */
export function createMBeanCollectionManager(stream: Stream) {
  const consumers = new Map<symbol, Consumer>()
  const metadata = new Map<string, { operations: Array<Record<string, unknown>>; characters: number }>()
  let metadataCharacters = 0
  const pending = new Map<string, { sample: MBeanCollectionSample; name: string; revision: number }>()
  let frame: number | undefined
  let subscription: Subscription | undefined, retry: ReturnType<typeof setTimeout> | undefined
  let scope = '', interval = 2, enabled = false, disposed = false, queued = false, signature = '', revision = 0, failures = 0

  function stop() {
    revision++; subscription?.unsubscribe(); subscription = undefined; clearTimeout(retry); retry = undefined
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined; pending.clear()
  }
  function notify(error: unknown) {
    for (const { demand, receive } of [...consumers.values()]) if (demand.enabled) {
      for (const nodeId of demand.nodeIds) deliver(receive, { nodeId, collectedAt: Date.now(), status: 'rejected', reason: error })
    }
  }
  function deliver(receive: Consumer['receive'], result: MBeanResult) {
    try { receive(result) } catch (error) { console.error('MBean collection consumer failed', error) }
  }
  function remember(sample: MBeanCollectionSample) {
    for (const bean of sample.beans) if (bean.operations) {
      const key = JSON.stringify([sample.nodeId, bean.objectName]), characters = JSON.stringify(bean.operations).length
      metadataCharacters -= metadata.get(key)?.characters ?? 0
      metadata.set(key, { operations: bean.operations, characters }); metadataCharacters += characters
      while (metadata.size > 4096 || metadataCharacters > 2_000_000) {
        const oldest = metadata.keys().next().value!
        metadataCharacters -= metadata.get(oldest)!.characters; metadata.delete(oldest)
      }
    }
  }
  function valid(sample: MBeanCollectionSample) {
    return Number.isFinite(sample.collectedAt) && ['ready', 'unsupported', 'error', 'forbidden'].includes(sample.status)
      && Array.isArray(sample.beans) && sample.beans.every(bean => bean && typeof bean.objectName === 'string'
        && typeof bean.domain === 'string' && typeof bean.beanType === 'string' && typeof bean.name === 'string'
        && bean.values && typeof bean.values === 'object' && !Array.isArray(bean.values)
        && Array.isArray(bean.unavailableAttributes) && bean.unavailableAttributes.every(name => typeof name === 'string')
        && (!bean.operations || Array.isArray(bean.operations)))
  }
  function makePlan(): MBeanCollectionPlan {
    const nodes = new Map<string, { nodeId: string; name: string; attributes: Set<string> }>()
    for (const { demand } of consumers.values()) if (demand.enabled) for (const nodeId of demand.nodeIds) {
      if (!nodeId) continue
      const key = JSON.stringify([nodeId, demand.name]), projection = nodes.get(key) ?? { nodeId, name: demand.name, attributes: new Set<string>() }
      demand.attributes.forEach(attribute => projection.attributes.add(attribute)); nodes.set(key, projection)
    }
    // 只合并属性集合完全相同的节点，避免把当前节点的大历史投影扩大到全群。
    const groups = new Map<string, { nodeIds: string[]; name: string; attributes: string[] }>()
    for (const node of nodes.values()) {
      const attributes = [...node.attributes].sort(), key = JSON.stringify([node.name, attributes])
      const group = groups.get(key) ?? { name: node.name, attributes, nodeIds: [] }
      group.nodeIds.push(node.nodeId); groups.set(key, group)
    }
    return { interval: `${interval}s`, queries: [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([, group], index) => ({ id: `q${index}`, ...group, nodeIds: group.nodeIds.sort() })) }
  }
  function raw(sample: MBeanCollectionSample, attributes: string[]): Record<string, unknown> {
    const result: Record<string, Record<string, Record<string, unknown>>> = Object.create(null)
    for (const bean of sample.beans) {
      const key = JSON.stringify([sample.nodeId, bean.objectName])
      const values = Object.fromEntries(attributes.filter(name => Object.hasOwn(bean.values, name) && !bean.unavailableAttributes.includes(name)).map(name => [name, bean.values[name]]))
      const domain = result[bean.domain] ??= Object.create(null), type = domain[bean.beanType] ??= Object.create(null)
      type[bean.objectName] = { ...values, '@objectName': bean.objectName, '@name': bean.name, '@operations': metadata.get(key)?.operations ?? [],
        '@attributes': attributes.map(name => ({ name, type: '', readable: true, available: Object.hasOwn(values, name) })) }
    }
    return result
  }
  function connect(plan: MBeanCollectionPlan) {
    if (disposed || !enabled || !plan.queries.length) return
    const current = revision, sequences = new Map<string, number>()
    const candidate = stream(plan).subscribe({
      next(sample) {
        if (current !== revision || !enabled) return
        if (sample?.type === 'heartbeat') return
        if (sample?.type !== 'sample') { disconnected(new Error('Invalid MBean collection record'), current, plan); return }
        const query = plan.queries.find(value => value.id === sample.queryId)
        if (!query || !query.nodeIds.includes(sample.nodeId) || !Number.isSafeInteger(sample.sequence)) return
        const key = JSON.stringify([sample.nodeId, sample.queryId])
        if (sample.sequence <= (sequences.get(key) ?? 0)) return
        if (!valid(sample)) { disconnected(new Error('Invalid MBean collection sample'), current, plan); return }
        sequences.set(key, sample.sequence); failures = 0
        // 首轮元数据不能被同一帧内随后省略元数据的快照覆盖。
        remember(sample)
        pending.set(key, { sample, name: query.name, revision: current })
        // SDK 逐行 await 会让每行都触发一次 Vue flush；浏览器统一在一帧内提交各 key 的最新结果。
        if (typeof requestAnimationFrame !== 'undefined') { if (frame === undefined) frame = requestAnimationFrame(flush) }
        else flush()
      },
      error: error => disconnected(error, current, plan),
      complete: () => disconnected(new Error('MBean collection stream ended'), current, plan),
    })
    if (current === revision) subscription = candidate
    else candidate.unsubscribe()
  }
  function flush() {
    frame = undefined
    const ready = [...pending.values()]; pending.clear()
    for (const entry of ready) {
      if (entry.revision !== revision) continue
      const { sample, name } = entry
      for (const { demand, receive } of [...consumers.values()]) {
        if (!demand.enabled || demand.name !== name || !demand.nodeIds.includes(sample.nodeId)) continue
        const status = sample.status
        deliver(receive, status === 'ready' || status === 'unsupported'
          ? { nodeId: sample.nodeId, collectedAt: sample.collectedAt, status: 'fulfilled', value: raw(sample, demand.attributes) }
          : { nodeId: sample.nodeId, collectedAt: sample.collectedAt, status: 'rejected', reason: Object.assign(new Error('MBean collection failed'), { status: status === 'forbidden' ? 403 : 503 }) })
      }
    }
  }
  function disconnected(error: unknown, current: number, plan: MBeanCollectionPlan) {
    if (current !== revision || disposed || !enabled) return
    stop()
    notify(error)
    const failure = error as { status?: number; response?: { status?: number } }
    if ([400, 401, 403, 404, 405, 415, 422].includes(failure?.status ?? failure?.response?.status ?? 0)) return
    retry = setTimeout(() => { stop(); connect(plan) }, Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)))
  }
  function rebuild(force = false) {
    if (disposed) return
    const plan = makePlan(), next = JSON.stringify([scope, enabled, plan])
    if (!force && next === signature) return
    signature = next; stop(); connect(plan)
  }
  function changed() {
    // 先使旧流失效，随后合并本轮挂载 / 撤销；不让迟到样本跨过 reset 或撤权屏障。
    if (!queued && JSON.stringify([scope, enabled, makePlan()]) === signature) return
    schedule()
  }
  function schedule() {
    stop()
    if (queued || disposed) return
    queued = true
    queueMicrotask(() => { queued = false; rebuild(true) })
  }
  return {
    configure(next: { scope: string; interval: number; enabled: boolean }) {
      const paused = enabled && !next.enabled && scope === next.scope
      if (scope !== next.scope) { metadata.clear(); metadataCharacters = 0; failures = 0 }
      scope = next.scope; interval = next.interval; enabled = next.enabled
      changed()
      if (paused) notify(new Error('MBean collection paused'))
    },
    register(receive: Consumer['receive']) {
      const id = Symbol(), consumer: Consumer = { demand: { nodeIds: [], name: '', attributes: [], enabled: false }, receive }
      consumers.set(id, consumer)
      return {
        update(demand: MBeanDemand) {
          if (JSON.stringify(demand) === JSON.stringify(consumer.demand)) return
          consumer.demand = demand; changed()
        },
        dispose() { consumers.delete(id); changed() },
      }
    },
    refresh: schedule,
    dispose() { disposed = true; stop(); consumers.clear(); metadata.clear(); metadataCharacters = 0 },
  }
}
