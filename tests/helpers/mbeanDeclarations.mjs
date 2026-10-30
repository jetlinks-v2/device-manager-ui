import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'

/** A controlled collection boundary: business tests deliver samples, never emulate frontend polling. */
export function declarations(vue) {
  const entries = [], refreshes = []
  return {
    entries, refreshes,
    useMBeanCollection(demand, receive) {
      const entry = { demand: demand(), receive, live: true }
      entries.push(entry)
      vue.watch(demand, value => entry.demand = value, { deep: true, flush: 'sync' })
      vue.onScopeDispose(() => entry.live = false)
      return { refresh() { refreshes.push(Date.now()) } }
    },
    push(nodeId, name, value, collectedAt = Date.now()) {
      for (const entry of entries) if (entry.live && entry.demand.enabled && entry.demand.name === name && entry.demand.nodeIds.includes(nodeId)) {
        entry.receive({ nodeId, collectedAt, status: 'fulfilled', value })
      }
    },
    fail(nodeId, name, reason, collectedAt = Date.now()) {
      for (const entry of entries) if (entry.live && entry.demand.enabled && entry.demand.name === name && entry.demand.nodeIds.includes(nodeId)) {
        entry.receive({ nodeId, collectedAt, status: 'rejected', reason })
      }
    },
  }
}

export function loadManager() {
  const module = { exports: {} }
  const code = transformSync(readFileSync(new URL('../../views/link/diagnostics/collection/manager.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('module', 'exports', code)(module, module.exports)
  return module.exports.createMBeanCollectionManager
}
