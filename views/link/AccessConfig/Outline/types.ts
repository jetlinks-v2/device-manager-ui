export interface NamedResource extends Record<string, unknown> {
  id?: string
  name?: string
  description?: string
}

export interface NetworkResource extends NamedResource {
  addresses?: { address?: string; health?: number }[]
}

export interface GatewayRecord extends NamedResource {
  provider?: string
  channel?: string
  channelId?: string
  protocol?: string
  transport?: string
  bizKey?: string
  createTime?: number | string
  state?: { value?: string; text?: string }
  configuration?: Record<string, unknown>
  channelInfo?: NetworkResource
  protocolDetail?: NamedResource
  transportDetail?: ProtocolDocument
}

export interface ProtocolRoute extends Record<string, unknown> {
  group?: string
  topic?: string
  address?: string
  example?: unknown
  description?: string
  upstream?: boolean
  downstream?: boolean
}

export interface ProtocolDocument {
  id?: string
  name?: string
  document?: string
  routes?: ProtocolRoute[]
}

export interface PluginProperty {
  property: string
  name?: string
}

export interface PluginMetadata {
  others?: { configMetadata?: { properties?: PluginProperty[] } }
}

export type OutlineIssue = 'gateway' | 'providers' | 'network' | 'protocol' | 'document' | 'plugin' | 'children'

export interface GatewayOutlineModel {
  gateway: GatewayRecord
  provider?: NamedResource
  network?: NetworkResource
  protocol?: NamedResource
  plugin?: NamedResource
  properties: PluginProperty[]
  documents: ProtocolDocument[]
  builtin: boolean
  children: GatewayOutlineModel[]
  issues: OutlineIssue[]
}

export interface OutlineRow {
  label: string
  value: string | number
}

export interface OutlineSection {
  key: string
  title: string
  tag?: string
  builtin?: boolean
  rows: OutlineRow[]
  documents?: ProtocolDocument[]
  showDocument?: boolean
  emptyChildren?: boolean
}

export type OutlineTranslate = (key: string) => string

export const agentProviders = ['agent-device-gateway', 'agent-media-device-gateway']
export const pluginProviders = ['plugin_gateway', 'media-plugin']
export const cloudProviders = ['OneNet', 'OneNet-platform', 'Ctwing']
export const builtinProviders = ['fixed-media', 'onvif', 'gb28181-2016', 'collector-gateway', 'modbus-tcp', 'opc-ua', 'edge-child-device']
