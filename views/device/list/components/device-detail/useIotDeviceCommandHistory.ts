import { computed, ref, watch } from 'vue'
import { extractRows, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDeviceCommandDefinition, IotDeviceLog } from '../../types'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { buildCommandHistoryRows, buildFallbackCommandHistoryRows, type CommandHistoryRow } from './iotDeviceCommandHistory'

export function useIotDeviceCommandHistory(
  deviceId: () => string,
  fallbackLogs: () => IotDeviceLog[],
  properties: () => RealtimePropertyRow[],
  commands: () => IotDeviceCommandDefinition[],
) {
  const apiRows = ref<CommandHistoryRow[]>([])

  const historyRows = computed(() => {
    const rows = apiRows.value.length
      ? apiRows.value
      : buildFallbackCommandHistoryRows(fallbackLogs(), properties(), commands())
    return rows.slice(0, 12)
  })

  watch(
    deviceId,
    () => {
      apiRows.value = []
      void loadHistory()
    },
    { immediate: true },
  )

  async function loadHistory() {
    if (!deviceId()) return
    const resp: { result?: unknown } = await iotDeviceDetailRealApi.queryLog(deviceId(), {
      pageIndex: 0,
      pageSize: 200,
      sorts: [{ name: 'timestamp', order: 'desc' }],
    })
    // 功能调用的下行请求和设备回复分别落日志，后端以 messageId 关联，这里统一聚合成一条调用历史。
    apiRows.value = buildCommandHistoryRows(extractRows(resp?.result), properties(), commands())
  }

  return {
    historyRows,
    loadHistory,
  }
}
