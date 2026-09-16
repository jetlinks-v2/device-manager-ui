import type { MenuFilterDefinition, MenuItem } from '@jetlinks-web-core/types/module'

const retiredIotDeviceMenus = new Set([
  'iot-user/device/groups',
  'iot-user/device/health',
])

/**
 * Existing project snapshots may carry an obsolete overview component alias.
 * The menu code is the stable route key exposed by every module version.
 */
const normalizeOverviewRoute = (item: MenuItem): MenuItem => {
  if (item.code !== 'iot-user/device/overview') return item

  const { meta: optionMeta, ...options } = item.options ?? {}
  const { componentCode: _optionComponentCode, ...normalizedOptionMeta } = (optionMeta ?? {}) as Record<string, unknown>
  const { componentCode: _menuComponentCode, ...normalizedMenuMeta } = (item.meta ?? {}) as Record<string, unknown>

  return {
    ...item,
    options: item.options
      ? { ...options, meta: normalizedOptionMeta }
      : undefined,
    meta: normalizedMenuMeta,
  }
}

/** 过滤历史设备分组和健康入口；概览与设备列表保留为物联的一级工作入口。 */
export const getUnifiedDeviceMenuFilters = (): MenuFilterDefinition[] => [{
  code: 'unified-device-list', order: 100,
  filter(menus) {
    const walk = (items: MenuItem[]): MenuItem[] => items
      // 历史分组、健康和边缘网关入口不能再生成与统一设备列表冲突的路由。
      .filter(item => !retiredIotDeviceMenus.has(item.code) && item.code !== 'iot-user/edge-gateway')
      .map(item => {
        const normalizedItem = normalizeOverviewRoute(item)
        return {
          ...normalizedItem,
          options: ['iot-user/device/list', 'media/Device'].includes(normalizedItem.code)
            ? { ...normalizedItem.options, show: false } : normalizedItem.options,
          children: normalizedItem.children ? walk(normalizedItem.children) : undefined,
        }
      })
    return walk(menus)
  },
}]
