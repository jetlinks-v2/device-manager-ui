import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import type { DeviceSessionInfo, ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { queryDeviceSessions } from '../../../api/link/diagnostics'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { diagnosticErrorState } from './status'

const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const text = (value: unknown) => typeof value === 'string' ? value : undefined
const scalar = (value: unknown) => typeof value === 'number' || typeof value === 'string' ? value : undefined

function connection(value: unknown) {
  const source = record(value)
  if (!source) throw new Error('Device session connection invalid')
  const metrics = record(source.metrics)
  return {
    id: text(source.id), address: text(source.address), pendingMessages: scalar(source.pendingMessages),
    metrics: metrics ? {
      readBytes: scalar(metrics.readBytes), writeBytes: scalar(metrics.writeBytes), connectTime: scalar(metrics.connectTime),
      lastCommTime: scalar(metrics.lastCommTime), totalMessages: scalar(metrics.totalMessages),
      pendingMessages: scalar(metrics.pendingMessages), droppedMessages: scalar(metrics.droppedMessages),
    } : undefined,
  }
}

/** 后端结果允许包含远端会话；展示层负责稳定地优先当前节点，这里不丢弃或重排证据。 */
export function normalizeDeviceSessions(raw: unknown): DeviceSessionInfo[] {
  if (!Array.isArray(raw)) throw new Error('Device session response invalid')
  return raw.map(value => {
    const source = record(value)
    if (!source) throw new Error('Device session response invalid')
    return {
      deviceId: text(source.deviceId), serverId: text(source.serverId), address: text(source.address), transport: text(source.transport),
      parentDeviceId: text(source.parentDeviceId), connectTime: scalar(source.connectTime), lastCommTime: scalar(source.lastCommTime),
      pendingMessages: scalar(source.pendingMessages), connections: Array.isArray(source.connections) ? source.connections.map(connection) : undefined,
    } satisfies DeviceSessionInfo
  })
}

/**
 * 输入值、已提交请求和已完成结果各自独立：新的慢查询不会把旧结果误标成新设备。
 * Tab 失活只取消在途请求并保留已完成只读证据；撤权则立即清除。
 */
export function useDeviceSessions(nodeId: Ref<string>, active: Ref<boolean>, supported: Ref<boolean | undefined>, scopeKey?: Ref<string>, cancelOnNodeChange = true, allowUnknownSupport?: Ref<boolean>) {
  const access = useDiagnosticsAccess()
  const query = useDiagnosticQuery<DeviceSessionInfo[]>({ retainOnDeactivate: true })
  const deviceId = ref('')
  const queriedDeviceId = ref('')
  const resultDeviceId = ref('')
  let generation = 0
  // 无监控统计权限时，独立 sessions 授权允许向端点尝试未知能力；明确不支持仍拒绝。
  const capabilityAllowsQuery = computed(() => supported.value === true || supported.value === undefined && allowUnknownSupport?.value === true)
  const allowed = computed(() => active.value && access.value.sessions && capabilityAllowsQuery.value)
  const state = computed<ViewState>(() => {
    if (!access.value.sessions) return { status: 'forbidden' }
    if (supported.value === false) return { status: 'unsupported' }
    return query.state.value
  })

  async function run(id: string) {
    const submitted = id.trim()
    if (!submitted || !allowed.value) return
    const current = ++generation
    queriedDeviceId.value = submitted
    await query.run(async signal => normalizeDeviceSessions(await queryDeviceSessions(submitted, signal)), true, {
      isEmpty: sessions => sessions.length === 0,
      errorState: diagnosticErrorState,
      retainData: true,
    })
    if (current === generation && allowed.value && query.state.value.status !== 'loading' && ['ready', 'empty'].includes(query.state.value.status)) resultDeviceId.value = submitted
  }

  function refresh() { if (queriedDeviceId.value) void run(queriedDeviceId.value) }

  watch(() => access.value.sessions, granted => {
    generation++
    if (!granted) {
      query.clear({ status: 'forbidden' })
      queriedDeviceId.value = ''
      resultDeviceId.value = ''
    }
  }, { immediate: true, flush: 'sync' })
  watch([nodeId, active], ([nextNode, nextActive], previous) => {
    if (!nextActive || cancelOnNodeChange && previous?.[0] !== nextNode) {
      generation++
      query.cancel()
    }
  }, { flush: 'sync' })
  watch([supported, capabilityAllowsQuery], ([value, canQuery]) => {
    if (!canQuery) {
      generation++
      query.cancel()
      if (value === false) {
        query.clear({ status: 'unsupported' })
        queriedDeviceId.value = ''
        resultDeviceId.value = ''
      }
    }
  }, { flush: 'sync' })
  // Account/project changes invalidate retained session evidence even when the visible route is unchanged.
  if (scopeKey) watch(scopeKey, () => {
    generation++
    query.clear()
    deviceId.value = ''
    queriedDeviceId.value = ''
    resultDeviceId.value = ''
  }, { flush: 'sync' })
  onScopeDispose(() => { generation++; query.clear() })
  return { deviceId, queriedDeviceId, resultDeviceId, sessions: query.data, state, query: run, refresh }
}
