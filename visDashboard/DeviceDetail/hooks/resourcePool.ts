export interface ResourceState<T> { data?: T; loading: boolean; error: boolean }
type Listener = (state: ResourceState<unknown>) => void
interface Entry {
  load: () => Promise<unknown>
  state: ResourceState<unknown>
  listeners: Map<Listener, number>
  pending?: Promise<void>
  timer?: ReturnType<typeof setTimeout>
}

/** 每个详情/画布宿主持有独立资源池，相同设备的五个统计消费者共享请求和结果。 */
export function createResourcePool() {
  const entries = new Map<string, Entry>()
  const notify = (entry: Entry) => entry.listeners.forEach((_, listener) => listener(entry.state))
  function schedule(key: string, entry: Entry) {
    clearTimeout(entry.timer)
    const interval = Math.min(...entry.listeners.values())
    if (entries.get(key) === entry && Number.isFinite(interval) && !entry.pending) {
      entry.timer = setTimeout(() => { void run(key, entry) }, interval * 1000)
    }
  }
  function run(key: string, entry: Entry): Promise<void> {
    if (entry.pending) return entry.pending
    clearTimeout(entry.timer)
    entry.state = { ...entry.state, loading: true, error: false }; notify(entry)
    entry.pending = Promise.resolve().then(entry.load).then(data => {
      if (entries.get(key) === entry) entry.state = { data, loading: false, error: false }
    }, () => {
      if (entries.get(key) === entry) entry.state = { loading: false, error: true }
    }).then(() => {
      if (entries.get(key) !== entry) return
      entry.pending = undefined; notify(entry); schedule(key, entry)
    })
    return entry.pending
  }
  return {
    subscribe<T>(key: string, seconds: number, load: () => Promise<T>, listener: (state: ResourceState<T>) => void) {
      let entry = entries.get(key)
      if (!entry) { entry = { load, state: { loading: true, error: false }, listeners: new Map() }; entries.set(key, entry) }
      const current = entry, receive = listener as Listener
      current.listeners.set(receive, seconds > 0 ? seconds : Infinity)
      listener(current.state as ResourceState<T>)
      if (current.state.loading) void run(key, current)
      else schedule(key, current)
      return () => {
        current.listeners.delete(receive)
        if (current.listeners.size) schedule(key, current)
        else { clearTimeout(current.timer); if (entries.get(key) === current) entries.delete(key) }
      }
    },
    refresh(key: string) { const entry = entries.get(key); return entry ? run(key, entry) : Promise.resolve() },
    dispose() { entries.forEach(entry => clearTimeout(entry.timer)); entries.clear() },
  }
}
