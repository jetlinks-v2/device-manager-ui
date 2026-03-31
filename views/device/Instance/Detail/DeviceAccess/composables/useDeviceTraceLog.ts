import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'
import { ref, type Ref } from 'vue'
import {
  MAX_TRACE_GROUPS,
  trimGroupEventsToLimit,
  trimTraceGroupsToLimit,
} from '../traceListUtils'
import { resolveLogLevelFromTracePayload } from '../traceLogLevel'
import { compareTraceEvents } from '../traceOperationLabels'

export type TraceEventItem = {
  key: string
  traceId?: string
  type?: string
  /** 后端 TraceData.logLevel（如 INFO、WARN） */
  logLevel?: string
  operation?: string
  /** 链路步骤开始时间（毫秒，与纳秒二选一或同时存在） */
  startTime?: number
  endTime?: number
  /** 纳秒时间戳（优先参与排序与展示） */
  startTimeNano?: string | number | bigint
  endTimeNano?: string | number | bigint
  detail?: string
  error?: boolean
  upstream?: boolean
  downstream?: boolean
  [k: string]: any
}

export type TraceGroup = {
  key: string
  traceId: string
  upstream?: boolean
  downstream?: boolean
  events: TraceEventItem[]
}

/** 单帧内合并处理，减少排序次数与响应式触发频率 */
function buildEventItem(payload: TraceEventItem): TraceEventItem {
  const resolvedLevel = resolveLogLevelFromTracePayload(payload)
  return {
    ...payload,
    key: payload.key || randomString(),
    ...(resolvedLevel ? { logLevel: resolvedLevel } : {}),
  }
}

export function useDeviceTraceLog(deviceId: Ref<string | undefined>) {
  const traceGroups = ref<TraceGroup[]>([])
  let socketSub: { unsubscribe: () => void } | undefined

  let pendingPayloads: TraceEventItem[] = []
  let rafId: number | null = null

  const flushPending = () => {
    if (!pendingPayloads.length) return
    const batch = pendingPayloads
    pendingPayloads = []
    const modifiedGroupIdx = new Set<number>()

    for (const raw of batch) {
      const ev = buildEventItem(raw)
      const tid = String(ev.traceId ?? '_no_trace_')
      let idx = traceGroups.value.findIndex((g) => g.traceId === tid)
      if (idx >= 0) {
        traceGroups.value[idx].events.push(ev)
        modifiedGroupIdx.add(idx)
      } else {
        traceGroups.value.push({
          key: randomString(),
          traceId: tid,
          upstream: ev.upstream,
          downstream: ev.downstream,
          events: [ev],
        })
        modifiedGroupIdx.add(traceGroups.value.length - 1)
      }
    }

    for (const idx of modifiedGroupIdx) {
      const g = traceGroups.value[idx]
      g.events.sort(compareTraceEvents)
      trimGroupEventsToLimit(g)
    }

    if (traceGroups.value.length > MAX_TRACE_GROUPS) {
      traceGroups.value = trimTraceGroupsToLimit(traceGroups.value)
    }
  }

  const scheduleFlush = () => {
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      flushPending()
    })
  }

  const enqueue = (payload: TraceEventItem) => {
    pendingPayloads.push(payload)
    scheduleFlush()
  }

  const pushOrMergeGroup = (payload: TraceEventItem) => {
    enqueue(payload)
  }

  const subscribe = () => {
    unsubscribe()
    const id = deviceId.value
    if (!id) return
    const wsId = `device-debug-${id}`
    const topic = `/debug/device/${id}/trace`
    socketSub = wsClient
      .getWebSocket(wsId, topic, {})
      ?.pipe(map((res: any) => (res != null && res.payload !== undefined ? res.payload : res)))
      .subscribe((payload: any) => {
        const typeStr = payload?.type != null ? String(payload.type).toLowerCase() : ''
        if (typeStr === 'log') {
          pushOrMergeGroup({
            key: randomString(),
            ...payload,
            type: 'log',
          })
          return
        }
        pushOrMergeGroup({ key: randomString(), ...payload })
      })
  }

  const unsubscribe = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    flushPending()
    socketSub?.unsubscribe()
    socketSub = undefined
  }

  const clear = () => {
    pendingPayloads = []
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    traceGroups.value = []
  }

  return {
    traceGroups,
    subscribe,
    unsubscribe,
    clear,
  }
}
