export const IOT_DEVICE_DETAIL_AGENT_TABS = [
  'overview',
  'access',
  'commands',
  'data',
  'alarm',
  'logs',
] as const

export const IOT_GATEWAY_DETAIL_AGENT_ROUTE_NAME = 'iot-user/edge-gateway/Detail'

export const IOT_GATEWAY_DETAIL_AGENT_TABS = [
  'runtime',
  'access',
  'thing-model',
  'commands',
  'data',
  'messages',
  'remote',
  'firmwareTasks',
  'subDevices',
] as const

export type DeviceDetailAgentTabSurface = 'unified' | 'gateway'

export const resolveDeviceDetailAgentTabs = (surface: DeviceDetailAgentTabSurface = 'unified') => (
  surface === 'gateway' ? IOT_GATEWAY_DETAIL_AGENT_TABS : IOT_DEVICE_DETAIL_AGENT_TABS
)

export const resolveDeviceDetailAgentDefaultTab = (surface: DeviceDetailAgentTabSurface = 'unified') => (
  surface === 'gateway' ? 'runtime' : 'overview'
)
