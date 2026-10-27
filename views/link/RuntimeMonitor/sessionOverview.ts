import type { DiagnosticNode } from '../../../api/link/diagnostics'
import type { NodeSessionSnapshot } from './useClusterSessions'

type SamplingStatus = NodeSessionSnapshot['state']['status'] | 'missing' | 'unknown'
export interface SessionOverviewRow {
  nodeId: string
  label: string
  sessions?: string
  keepOnline?: string
  sampledAt?: number
  status: SamplingStatus
}
export interface SessionCountTotal { value?: string; nodes: number }
export interface SessionOverview {
  rows: SessionOverviewRow[]
  sessions: SessionCountTotal
  keepOnline: SessionCountTotal
  collected: number
  total: number
}

const count = (value: string | undefined) => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value).toString() : undefined

/** 排除已确认不支持的节点；未知和采集失败仍可见，缺测永远不补成零。 */
export function sessionOverview(nodes: readonly DiagnosticNode[], snapshots: ReadonlyMap<string, NodeSessionSnapshot>): SessionOverview {
  const rows = [...new Map(nodes.map(node => [node.id, node])).values()].filter(node => {
    const snapshot = snapshots.get(node.id)
    return snapshot?.supported !== false && snapshot?.state.status !== 'unsupported'
  }).map(node => {
    const snapshot = snapshots.get(node.id), state = snapshot?.state.status
    const retained = snapshot?.supported === true && (state === 'ready' || state === 'stale')
    const sessions = retained ? count(snapshot.sessions) : undefined, keepOnline = retained ? count(snapshot.keepOnline) : undefined
    const status: SamplingStatus = !snapshot ? 'unknown'
      : state === 'loading' || state === 'error' || state === 'forbidden' || state === 'unsupported' || state === 'stale' ? state
        : snapshot.supported === false ? 'unsupported'
          : snapshot.supported === true && state === 'ready' ? sessions !== undefined && keepOnline !== undefined ? 'ready' : 'missing' : 'unknown'
    return { nodeId: node.id, label: node.alias || node.id, sessions, keepOnline, status, sampledAt: snapshot?.state.sampledAt }
  })
  /** 两种记录分别累加，用 BigInt 保留 Java long 精度，不跨指标相加。 */
  function sum(key: 'sessions' | 'keepOnline'): SessionCountTotal {
    const values = rows.filter(row => (row.status === 'ready' || row.status === 'missing') && row[key] !== undefined)
    return { value: values.length ? values.reduce((total, row) => total + BigInt(row[key]!), 0n).toString() : undefined, nodes: values.length }
  }
  return { rows, sessions: sum('sessions'), keepOnline: sum('keepOnline'), collected: rows.filter(row => row.status === 'ready').length, total: rows.length }
}
