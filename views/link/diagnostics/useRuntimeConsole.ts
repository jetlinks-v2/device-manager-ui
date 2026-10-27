import { onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import type { Subscription } from 'rxjs'
import type { LogEntry } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeLogStream, type RuntimeLogRecord } from '../../../api/link/runtimeLogStream'
import { diagnosticErrorState } from './status'

export type ConsoleStatus = 'idle' | 'waiting' | 'receiving' | 'paused' | 'error'
/** 控制台保存本节点有界证据，接收与自动滚底分开；恢复工具时不自动重订阅。 */
export function useRuntimeConsole(node: Ref<string>, enabled: Ref<boolean>, authorized: Ref<boolean>) {
  const entries = shallowRef<LogEntry[]>([]), status = ref<ConsoleStatus>('idle'), message = ref(''), following = ref(true), clipped = ref(false)
  let subscription: Subscription | undefined, generation = 0, counter = 0, characters = 0, pendingCharacters = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Map<string, LogEntry>()
  const weight = (entry: LogEntry) => entry.text.length + (entry.raw?.length ?? 0)
  function clearTimer() { clearTimeout(timer); timer = undefined }
  /** 100ms 批量落地，接收状态仍在首条事件立即更新；停止时提交已收到证据，身份变化则丢弃。 */
  function flush() {
    clearTimer()
    if (!pending.size) return
    const next = [...entries.value, ...pending.values()]
    characters += pendingCharacters; pending.clear(); pendingCharacters = 0
    let start = 0
    while (start < next.length - 1 && (next.length - start > 2000 || characters > 4 * 1024 * 1024)) { characters -= weight(next[start++]); clipped.value = true }
    entries.value = start ? next.slice(start) : next
  }
  function stop(preserve = true) { generation++; subscription?.unsubscribe(); subscription = undefined; clearTimer(); if (preserve) flush(); else { pending.clear(); pendingCharacters = 0 } if (status.value === 'waiting' || status.value === 'receiving') status.value = 'paused' }
  function clear() { clearTimer(); pending.clear(); pendingCharacters = 0; entries.value = []; characters = 0; clipped.value = false }
  function receive(value: RuntimeLogRecord) {
    const bounded = (text?: string) => { if (text && text.length > 256 * 1024) { clipped.value = true; return text.slice(0, 256 * 1024) } return text }
    const attributes = value.attributes ?? {}, timestamp = typeof value.timestamp === 'number' ? new Date(value.timestamp) : undefined
    const time = timestamp && Number.isFinite(timestamp.getTime()) ? `${timestamp.toLocaleTimeString([], { hour12: false })}.${String(timestamp.getMilliseconds()).padStart(3, '0')}` : undefined
    const body = bounded(value.message), stack = bounded(value.exceptionStack)
    const record: LogEntry = { id: `console:${++counter}`, text: [body, stack].filter(Boolean).join('\n'), message: body, stack: stack || undefined,
      level: value.level?.toUpperCase(), time, thread: typeof attributes.threadName === 'string' ? attributes.threadName : undefined,
      traceId: typeof attributes.traceId === 'string' && /^(?:[a-f\d]{16}|[a-f\d]{32})$/i.test(attributes.traceId) ? attributes.traceId : undefined, raw: bounded(JSON.stringify(value, null, 2)) }
    pending.set(record.id, record); pendingCharacters += weight(record)
    // Map 保持顺序且 O(1) 淘汰，在UI批次之间同样有界，不在每条事件复制整份历史数组。
    while (pending.size > 1 && (pending.size > 2000 || pendingCharacters > 4 * 1024 * 1024)) {
      const oldest = pending.keys().next().value!
      pendingCharacters -= weight(pending.get(oldest)!); pending.delete(oldest); clipped.value = true
    }
    timer ??= setTimeout(flush, 100)
  }
  function start() {
    if (!enabled.value || !authorized.value || !node.value || subscription) return
    const current = ++generation
    status.value = 'waiting'; message.value = ''; following.value = true
    const next = runtimeLogStream(node.value).subscribe({
      next(value) { if (current === generation && enabled.value && authorized.value) { receive(value); status.value = 'receiving' } },
      error(error) { if (current !== generation) return; stop(); status.value = 'error'; message.value = diagnosticErrorState(error).message ?? '' },
      complete() { if (current === generation) { stop(); status.value = 'paused' } },
    })
    if (current === generation && !next.closed) subscription = next
  }
  watch(enabled, value => { if (!value) { stop(); following.value = false } }, { flush: 'sync' })
  watch([node, authorized], () => { stop(false); clear(); status.value = 'idle'; message.value = ''; following.value = true }, { flush: 'sync' })
  onDeactivated(() => { stop(); following.value = false })
  onScopeDispose(() => { stop(false); clear() })
  return { entries, status, message, following, clipped, start, stop, clear }
}
