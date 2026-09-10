import type { MenuFilterDefinition, MenuItem } from '@jetlinks-web-core/types/module'

/** 只收拢列表导航，保留原菜单代码、权限和详情子路由供各类型继续调用。 */
export const getUnifiedDeviceMenuFilters = (): MenuFilterDefinition[] => [{
  code: 'unified-device-list', order: 100,
  filter(menus) {
    const walk = (items: MenuItem[]): MenuItem[] => items.map(item => ({
      ...item,
      options: ['iot-user/device/list', 'iot-user/edge-gateway', 'media/Device'].includes(item.code)
        ? { ...item.options, show: false } : item.options,
      children: item.children ? walk(item.children) : undefined,
    }))
    return walk(menus)
  },
}]
