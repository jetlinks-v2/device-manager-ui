import type { MenuFilterDefinition, MenuItem } from '@jetlinks-web-core/types/module'

/** 收拢设备与视频列表导航；边缘节点复用设备菜单授权和统一列表子路由。 */
export const getUnifiedDeviceMenuFilters = (): MenuFilterDefinition[] => [{
  code: 'unified-device-list', order: 100,
  filter(menus) {
    // 已废弃菜单不能再生成侧栏、父级重定向或与统一列表冲突的路由。
    const walk = (items: MenuItem[]): MenuItem[] => items.filter(item => item.code !== 'iot-user/edge-gateway').map(item => ({
      ...item,
      options: ['iot-user/device/list', 'media/Device'].includes(item.code)
        ? { ...item.options, show: false } : item.options,
      children: item.children ? walk(item.children) : undefined,
    }))
    return walk(menus)
  },
}]
