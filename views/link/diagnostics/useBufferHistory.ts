import { computed, ref, watch } from 'vue'
import { createBufferHistoryProjection, readBufferObservationRecording, type BufferHistorySample, type BufferObservationRecording, type MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import { queryMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from './normalize'
import { diagnosticErrorState } from './status'

export interface BufferHistoryContext {
  nodeId: string; scopeKey: string; active: boolean; permitted: boolean; beans: MBeanDescriptor[]; history?: BufferHistorySample[]
}

/** 目录复用已有快照；只有所选队列 / 时间 / 代次变化及手动刷新才读取完整历史。 */
export function useBufferHistory(props: BufferHistoryContext) {
  const open = ref(false), objectName = ref<string>(), range = ref<'recent' | 'hour'>('recent')
  const filter = ref<'all' | 'pending' | 'failed'>('all'), order = ref<string[]>([])
  const query = useDiagnosticQuery<BufferObservationRecording | undefined>()
  let opened = false
  const projection = computed(() => createBufferHistoryProjection(props.history ?? []))
  const queues = computed(() => runtimeBeanOverview(props.beans).buffers.map(queue => {
    const observation = queue.observation
    const pending = observation ? observation.values.Pending : queue.pending, dead = observation ? observation.values.Dead : queue.dead
    const rates = observation ? undefined : projection.value.latest(queue.objectName)
    const rate = observation ? observation.fresh ? observation.values.WrittenRate : undefined : rates?.writtenRate
    return { ...queue, pending, dead, rate, attemptedRate: rates?.attemptedRate,
      wip: observation ? observation.values.Wip : queue.wip, writerPending: observation ? observation.values.WriterPending : queue.writerPending,
      peak: observation?.todayPeaks.WrittenRate,
      failed: (dead ?? 0) > 0 || !!observation?.fresh && (observation.values.ErrorRate ?? 0) > 0,
      active: (rate ?? 0) > 0 || !!observation?.fresh && (['AttemptedRate', 'InRowsRate', 'OutRowsRate', 'Wip', 'WriterPending'] as const).some(key => (observation.values[key] ?? 0) > 0),
    }
  }))
  type Queue = typeof queues.value[number]
  // 只在进入窗口时排序；累计错误和旧错误文本不代表当前仍然失败，积压也不等于故障。
  const priority = (left: Queue, right: Queue) => Number(right.failed) - Number(left.failed)
    || (right.pending ?? -1) - (left.pending ?? -1) || Number(right.active) - Number(left.active)
    || (right.rate ?? -1) - (left.rate ?? -1) || (right.peak?.value ?? -1) - (left.peak?.value ?? -1)
    || left.name.localeCompare(right.name)
  const orderedQueues = computed(() => {
    const current = new Map(queues.value.map(queue => [queue.objectName, queue]))
    return order.value.flatMap(name => { const queue = current.get(name); return queue ? [queue] : [] })
  })
  const visibleQueues = computed(() => orderedQueues.value.filter(queue => filter.value === 'all'
    || (filter.value === 'failed' ? queue.failed : (queue.pending ?? 0) > 0)))
  const selected = computed(() => queues.value.find(queue => queue.objectName === objectName.value))
  const generation = computed(() => selected.value?.observation?.generation)

  // 采样只更新摘要；保留已有行的位置，新队列追加，筛选不修改当前历史对象。
  watch(queues, values => {
    const names = new Set(values.map(queue => queue.objectName)), previous = new Set(order.value)
    const next = [...order.value.filter(name => names.has(name)), ...values.filter(queue => !previous.has(queue.objectName)).map(queue => queue.objectName)]
    if (next.length !== order.value.length || next.some((name, index) => name !== order.value[index])) order.value = next
    if (!values.some(queue => queue.objectName === objectName.value)) objectName.value = [...values].sort(priority)[0]?.objectName
  }, { immediate: true, flush: 'sync' })

  function show() {
    order.value = [...queues.value].sort(priority).map(queue => queue.objectName)
    if (!opened || !selected.value) objectName.value = order.value[0]
    opened = true
    filter.value = 'all'
    open.value = true
  }
  function load() {
    const target = objectName.value, hour = range.value === 'hour', expectedGeneration = generation.value
    if (!open.value || !props.active || !props.permitted || !target || !expectedGeneration) { query.clear(); return }
    void query.run(async signal => {
      const raw = await queryMBeans(props.nodeId, signal, target, [hour ? 'HourHistory' : 'RecentHistory'])
      const bean = normalizeMBeans(raw).find(bean => bean.domain === 'org.jetlinks' && bean.type === 'PersistenceBuffer' && bean.objectName === target)
      const recording = bean ? readBufferObservationRecording(bean, hour) : undefined
      return recording?.snapshot.generation === expectedGeneration ? recording : undefined
    }, true, { errorState: diagnosticErrorState, isEmpty: value => value === undefined })
  }
  watch([() => props.nodeId, () => props.scopeKey, () => props.active, () => props.permitted], () => {
    open.value = false; query.clear(); objectName.value = undefined; order.value = []; opened = false
  }, { flush: 'sync' })
  watch([open, objectName, range, generation], load, { flush: 'sync' })
  return { open, objectName, range, filter, queues, orderedQueues, visibleQueues, selected, query, show, load }
}
