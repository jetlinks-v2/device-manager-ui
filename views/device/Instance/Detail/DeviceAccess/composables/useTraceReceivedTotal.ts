import { ref, watch, type Ref } from 'vue'
import type { TraceGroup } from '../traceListUtils'

/**
 * 本会话内累计收到的不同链路条数（按 traceGroup.key 去重；列表裁剪后计数不减少）。
 */
export function useTraceReceivedTotal(
  traceGroups: Ref<TraceGroup[]>,
  deviceId: Ref<string | undefined>,
) {
  const traceReceivedTotal = ref(0)
  const seenTraceKeys = new Set<string>()

  function ingestNewTraceKeys(groups: TraceGroup[]) {
    for (const g of groups) {
      if (!seenTraceKeys.has(g.key)) {
        seenTraceKeys.add(g.key)
        traceReceivedTotal.value += 1
      }
    }
  }

  watch(
    () => traceGroups.value,
    (groups) => ingestNewTraceKeys(groups),
    { deep: true, immediate: true },
  )

  watch(
    () => deviceId.value,
    () => {
      seenTraceKeys.clear()
      traceReceivedTotal.value = 0
      ingestNewTraceKeys(traceGroups.value)
    },
  )

  /** 用户点击「重置」清空链路列表时，同步将累加计数归零 */
  function resetTraceReceivedTotal() {
    seenTraceKeys.clear()
    traceReceivedTotal.value = 0
  }

  return { traceReceivedTotal, resetTraceReceivedTotal }
}
