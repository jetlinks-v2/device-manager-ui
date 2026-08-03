import type { IotTelemetryPoint } from '../../types'

export type RealtimeAccessMode = 'read' | 'readwrite' | 'write' | 'none'
export type RealtimeEventLevel = 'info' | 'major' | 'critical'

export interface RealtimePropertyRow {
  id: string
  name: string
  identifier: string
  value: string
  unit?: string
  dataType: string
  valueType?: Record<string, any>
  accessMode: RealtimeAccessMode
  writable: boolean
  updatedAt: string
  groupId: string
  groupName: string
  description: string
  tone: IotTelemetryPoint['status']
  expands?: Record<string, any>
  metricEnabled?: boolean
  focused?: boolean
}

export interface RealtimeEventRow {
  id: string
  name: string
  level: RealtimeEventLevel
  time: string
  description?: string
  valueType?: Record<string, any>
  outputs?: Array<Record<string, any>>
  expands?: Record<string, any>
}

export interface RealtimeServiceRow {
  id: string
  name: string
  identifier: string
  callMode: 'sync' | 'async'
  inputCount: number
  outputCount: number
  status: 'enabled' | 'disabled'
}

export type SimulatorActionMode = 'property-report' | 'event-report' | 'read-property' | 'write-property' | 'service-call'
export type SimulatorDirection = 'uplink' | 'downlink'
export type SimulatorStatus = 'success' | 'running' | 'failed' | 'waiting'
export type SimulatorLogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug'

export interface SimulatorOption {
  key: string
  label: string
}

export interface SimulatorPreset {
  mode: SimulatorActionMode
  label: string
  description: string
  payload: string
  targetOptions: SimulatorOption[]
  defaultTarget: string
}

export interface SimulatorConnectionSummary {
  online: boolean
  connectionCount: number
  connectionAddress: string
  accessMode: string
  protocol: string
  connectedAt: string
  lastCommunicatedAt: string
  pendingMessages: number
}

export interface SimulatorTraceStep {
  id: string
  title: string
  content: string
  status: SimulatorStatus
  node: string
  happenedAt: string
}

export interface SimulatorTrace {
  id: string
  traceId: string
  title: string
  direction: SimulatorDirection
  status: SimulatorStatus
  summary: string
  stepCount: number
  logCount: number
  duration: string
  requestPayload: string
  responsePayload: string
  steps: SimulatorTraceStep[]
}

export interface SimulatorLog {
  id: string
  time: string
  level: SimulatorLogLevel
  message: string
  traceId?: string
  node?: string
}

export interface SimulatorSession {
  subjectId: string
  subjectName: string
  connection: SimulatorConnectionSummary
  presets: SimulatorPreset[]
  traces: SimulatorTrace[]
  logs: SimulatorLog[]
  selectedTraceId: string
}
