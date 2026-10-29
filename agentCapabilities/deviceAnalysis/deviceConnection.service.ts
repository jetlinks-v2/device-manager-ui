import {
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentMessage,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { iotDeviceDetailRealApi } from '../../views/device/list/services/iotDeviceDetailReal.service'
import { asRecord, inputError, normalizeText, runDeviceTool, unwrapResult } from './deviceAnalysis.shared'

const MAX_SESSION_ITEMS = 20
const MAX_CONNECTION_ITEMS = 20

const timestamp = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const result = Number(value)
  return Number.isFinite(result) && result > 0 ? result : undefined
}

const latestTimestamp = (values: unknown[]): number | undefined => {
  const times = values.map(timestamp).filter((value): value is number => value !== undefined)
  return times.length ? Math.max(...times) : undefined
}

/** Read current platform state independently of sessions; backend asset/query permissions remain authoritative. */
export async function readDeviceState(deviceId: string) {
  const response = unwrapResult<unknown>(await iotDeviceDetailRealApi.getDeviceState(deviceId))
  const state = asRecord(response)
  const value = normalizeText(typeof response === 'string' ? response : state.value)
  if (!value) throw new Error(resolveDomainAgentMessage('DeviceConnectionAgent.stateUnavailable'))
  return {
    value,
    text: normalizeText(state.text) || value,
    checkedAt: Date.now(),
  }
}

/** Keep concrete connection facts separate from online state; no session never establishes that a device is offline. */
export const queryDeviceConnectionSessions = (deviceId: string) => runDeviceTool<Array<Record<string, unknown>>>([], async () => {
  const response = unwrapResult<unknown>(await iotDeviceDetailRealApi.getDeviceSessions(deviceId))
  if (!Array.isArray(response)) throw new Error(resolveDomainAgentMessage('DeviceConnectionAgent.sessionsUnavailable'))
  const sessions = response.map(asRecord)
  const connectionsOf = (session: Record<string, unknown>) => Array.isArray(session.connections)
    ? session.connections.map(asRecord) : undefined
  const connectionCount = sessions.every(session => Array.isArray(session.connections))
    ? sessions.reduce((count, session) => count + connectionsOf(session)!.length, 0) : undefined
  const lastCommunicationAt = latestTimestamp(sessions.flatMap(session => [
    session.lastCommTime,
    ...(connectionsOf(session) ?? []).map(connection => asRecord(connection.metrics).lastCommTime),
  ]))
  // Session/node identifiers and arbitrary metrics stay out of the agent result.
  const data = sessions.slice(0, MAX_SESSION_ITEMS).map(session => {
    const connections = connectionsOf(session)
    return {
      transport: normalizeText(session.transport) || undefined,
      address: normalizeText(session.address).slice(0, 500) || undefined,
      connectedAt: timestamp(session.connectTime),
      lastCommunicationAt: timestamp(session.lastCommTime),
      connectionCount: connections?.length,
      connections: connections?.slice(0, MAX_CONNECTION_ITEMS).map(connection => ({
        address: normalizeText(connection.address).slice(0, 500) || undefined,
        connectedAt: timestamp(asRecord(connection.metrics).connectTime),
        lastCommunicationAt: timestamp(asRecord(connection.metrics).lastCommTime),
      })),
      truncated: Boolean(connections && connections.length > MAX_CONNECTION_ITEMS),
    }
  })
  return createDomainAgentToolResult({
    domain: 'device',
    status: sessions.length ? undefined : 'empty',
    summary: { deviceId, queriedAt: Date.now(), sessionCount: sessions.length, connectionCount, lastCommunicationAt },
    data,
    cardinality: createDomainAgentRecordSetCardinality({ returnedCount: data.length, totalCount: sessions.length }),
    truncated: data.length < sessions.length || data.some(session => session.truncated),
    supportsAbsenceClaim: false,
    warnings: [resolveDomainAgentMessage('DeviceConnectionAgent.sessionSemantics')],
  })
})

export const deviceConnectionService = {
  stateGet: (args: Record<string, unknown>) => runDeviceTool<Record<string, unknown>>({}, async () => {
    const deviceId = normalizeText(args.deviceId)
    if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
    const status = await readDeviceState(deviceId)
    return createDomainAgentToolResult({ domain: 'device', summary: { deviceId, status: status.value }, data: { deviceId, status } })
  }),
  connectionSessions: async (args: Record<string, unknown>) => {
    const deviceId = normalizeText(args.deviceId)
    if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
    return queryDeviceConnectionSessions(deviceId)
  },
}
