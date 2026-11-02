import type { HomeAgentCapabilityContext } from '@jetlinks-web-core/layout/components/AiChat/homeAgentContracts'

/** Device-owned menu identities shared by home and general-agent declarations. */
export const DEVICE_AGENT_MENU_CODES = {
  instance: ['iot-user-device-list', 'iot-user/device/list', 'device/Instance'],
  product: ['device/Product'],
  dashboard: ['device/DashBoard'],
} as const

export const DEVICE_AGENT_MENU_PATHS = {
  instance: ['/resources/devices/list', '/iot-user/device/list', '/iot/device/Instance'],
  product: ['/resources/devices/products', '/iot/device/Product'],
  dashboard: ['/iot/device/DashBoard'],
} as const

type DeviceMenuKind = keyof typeof DEVICE_AGENT_MENU_CODES

/** Resolve an authorized entry; prefer the active entry when several layouts expose it. */
export const findDeviceAgentMenu = (context: HomeAgentCapabilityContext, kind: DeviceMenuKind) => {
  const menus = [...DEVICE_AGENT_MENU_CODES[kind], ...DEVICE_AGENT_MENU_PATHS[kind]].flatMap(anchor => {
    const menu = context.findMenu(anchor)
    return menu ? [menu] : []
  })
  return menus.filter(menu => (
    context.currentRoute.name === (menu.routeName || menu.code)
    || context.currentView === menu.code
    || (!!menu.path && (context.currentRoute.path === menu.path || context.currentRoute.path?.startsWith(`${menu.path}/`)))
  )).sort((left, right) => (right.path?.length || 0) - (left.path?.length || 0))[0] || menus[0]
}

export const isDeviceAgentMenuRoute = (context: HomeAgentCapabilityContext, kind: DeviceMenuKind) => {
  const menu = findDeviceAgentMenu(context, kind)
  return !!menu && (
    context.currentRoute.name === (menu.routeName || menu.code)
    || context.currentView === menu.code
    || (!!menu.path && context.currentRoute.path === menu.path)
  )
}
