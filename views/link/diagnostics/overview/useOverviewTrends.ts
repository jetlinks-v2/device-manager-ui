import { computed, type Ref } from 'vue'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useClusterSessionContext } from '../../RuntimeMonitor/useClusterSessions'
import { useDiagnosticsAccess } from '../useDiagnosticsAccess'
import type { PropertyCacheSnapshot } from '../useNodeOperationalSignals'
import type { GaugeSample } from './gaugeHistory'

export interface OverviewTrend {
  key: 'sessions' | 'property-cache'
  title: string
  caption: string
  help: string
  history: GaugeSample[]
  state: ViewState
  retainedValue?: string
  /** 属性缓存的真实待刷盘修改项；缺字段保持未知，不由总缓存量推算。 */
  dirtyCount?: string
  details?: 'session' | string
  facts: Array<{ label: string; value: string }>
}

/** 会话是缓存辅助信息的前置门禁；独立通信能力由同一共享采集上下文提供。正常零值保持可见。 */
export function useOverviewTrends(nodeId: Ref<string>, cache: Ref<PropertyCacheSnapshot | undefined>) {
  const access = useDiagnosticsAccess(), sessions = useClusterSessionContext()
  return computed<OverviewTrend[]>(() => {
    const session = sessions?.snapshots.value.get(nodeId.value)
    if (!access.value.monitor || session?.supported !== true) return []
    const result: OverviewTrend[] = [{ key: 'sessions', title: 'RuntimeMonitor.overviewSessionRecords', caption: 'RuntimeMonitor.overviewSessionPurpose', help: 'RuntimeMonitor.overviewSessionHelp', history: session.history ?? [], state: session.state, retainedValue: session.sessions,
      details: access.value.sessions ? 'session' : undefined,
      facts: session.keepOnline === undefined ? [] : [{ label: 'RuntimeMonitor.sessionKeepOnline', value: session.keepOnline }] }]
    const properties = cache.value
    if (properties?.supported !== true) return result
    const facts: OverviewTrend['facts'] = []
    if (properties.dirtyCount !== undefined) facts.push({ label: 'RuntimeMonitor.overviewDirtyKeys', value: properties.dirtyCount })
    if (properties.queueDepth !== undefined) facts.push({ label: 'RuntimeMonitor.overviewDirtyQueue', value: properties.queueDepth })
    if (properties.lastCommitTime !== undefined && Number.isSafeInteger(Number(properties.lastCommitTime)) && Number(properties.lastCommitTime) > 0) {
      const date = new Date(Number(properties.lastCommitTime))
      if (Number.isFinite(date.valueOf())) facts.push({ label: 'RuntimeMonitor.overviewLastCommit', value: date.toLocaleString() })
    }
    if (properties.lastFlushDuration !== undefined) facts.push({ label: 'RuntimeMonitor.overviewLastFlush', value: `${properties.lastFlushDuration} ms` })
    result.push({ key: 'property-cache', title: 'RuntimeMonitor.overviewPropertyCache', caption: 'RuntimeMonitor.overviewCachePurpose', help: 'RuntimeMonitor.overviewCacheHelp', history: properties.history, state: properties.state, retainedValue: properties.inMemorySize, dirtyCount: properties.dirtyCount, details: properties.objectName, facts })
    return result
  })
}
