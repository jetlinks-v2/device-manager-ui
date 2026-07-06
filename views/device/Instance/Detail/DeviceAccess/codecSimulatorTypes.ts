export type SimulatorType = 'uplink' | 'downlink'

export type CodecEncoding = 'Hex' | 'JSON' | 'Text'

export type CommandType = 'read' | 'write' | 'invoke'

export interface SimulationItem {
  id: string
  type: SimulatorType
  topic?: string
  encoding?: CodecEncoding
  qos?: 0 | 1 | 2
  payload?: string
  commandType?: CommandType
  commandId?: string
  result?: string
  value?: any
  isExecuted?: boolean
}

export interface ExecutionLogItem {
  time: string
  text: string
  type: 'success' | 'warn' | 'process' | 'operation'
}

export interface MetadataValueType {
  type?: string
  elements?: Array<{ text?: string; value?: any }>
  trueText?: string
  trueValue?: any
  falseText?: string
  falseValue?: any
}

export interface MetadataPropertyItem {
  id: string
  name?: string
  expands?: { type?: string[] | string }
  valueType?: MetadataValueType
}

export interface MetadataInputItem {
  id?: string
  name?: string
  valueType?: MetadataValueType
}

export interface MetadataFunctionItem {
  id: string
  name?: string
  inputs?: MetadataInputItem[]
}

export interface MetadataModel {
  properties?: MetadataPropertyItem[]
  functions?: MetadataFunctionItem[]
}
