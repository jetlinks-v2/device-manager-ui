import i18n from '@jetlinks-web-core/locales'
import type {
  HomeAgentCapability,
  HomeAgentCapabilityContext,
  HomeAgentCapabilityProvider,
} from '@jetlinks-web-core/layout/components/AiChat/homeAgentContracts'

export const DEVICE_GUIDANCE_PROVIDER_ID = 'device:function-guidance'
export const DEVICE_ONBOARDING_CAPABILITY_ID = 'device-entry:onboarding'

// These are device-owned menu identities, not deployment-specific URLs or external module routes.
export const DEVICE_GUIDANCE_MENU_CODES = {
  onboarding: ['iot-user-device-list', 'iot-user/device/list', 'device/Instance'],
  product: ['device/Product'],
  gateway: ['link/AccessConfig'],
  network: ['link/Type'],
  plugin: ['link/plugin'],
} as const

const keywords: Record<keyof typeof DEVICE_GUIDANCE_MENU_CODES, string[]> = {
  onboarding: ['设备接入', '添加设备', '新增设备', '设备注册', '设备库', '设备类型', '品牌型号', 'device onboarding', 'device library'],
  product: ['产品配置', '已有产品', '物模型', '设备接入', 'product configuration', 'thing model'],
  gateway: ['设备接入网关', '接入方式', '协议接入', 'device gateway', 'access configuration'],
  network: ['网络组件', '连接配置', '监听端口', 'network component', 'connection configuration'],
  plugin: ['协议插件', '协议支持', '接入插件', 'protocol plugin', 'protocol support'],
}

/** Describe only entries visible to this account; the destination owns onboarding and support checks. */
export const createDeviceGuidanceCapabilities = (
  context: HomeAgentCapabilityContext,
): HomeAgentCapability[] => Object.entries(DEVICE_GUIDANCE_MENU_CODES).flatMap(([key, codes]) => {
  const menu = codes.map(code => context.findMenu(code)).find(Boolean)
  if (!menu) return []
  const directOnboarding = key === 'onboarding' && menu.code !== 'device/Instance'
  return [{
    id: `device-entry:${key}`,
    kind: 'feature',
    category: 'device',
    name: directOnboarding ? String(i18n.global.t('IotDeviceList.action.create')) : menu.title,
    description: String(i18n.global.t(`DeviceFunctionGuidance.description.${key}`)),
    keywords: keywords[key as keyof typeof DEVICE_GUIDANCE_MENU_CODES],
    menuCode: menu.code,
    ...(directOnboarding ? { entry: { activate: true, query: { type: 'all' } } } : {}),
  }]
})

export const deviceGuidanceHomeAgentProvider: HomeAgentCapabilityProvider = {
  id: DEVICE_GUIDANCE_PROVIDER_ID,
  order: 20,
  getCapabilities: createDeviceGuidanceCapabilities,
  getSystemPromptLines: context => createDeviceGuidanceCapabilities(context).length
    ? String(i18n.global.t('DeviceFunctionGuidance.prompt'))
    : [],
}

export default deviceGuidanceHomeAgentProvider
