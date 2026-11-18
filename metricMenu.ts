import type { MenuItem } from '@jetlinks-web-core/types/module'

/** code、id 与原规则组一致；core 只为已授权叶子合并父壳，不由前端授予菜单。 */
export const metricMenuCatalog = (menus: MenuItem[]): MenuItem[] => {
  const walk = (items: MenuItem[]): MenuItem[] => items.map(item => ({
    ...item,
    ...(item.children ? { children: walk(item.children) } : {}),
    buttons: ['device/Product', 'device/Instance', 'iot-user/device/list', 'iot-user-device-list'].includes(item.code)
      ? item.buttons?.map(button => {
        const actions = button.id === 'view' ? ['query'] : button.id === 'update' ? ['save', 'delete'] : []
        if (!actions.length) return button
        const permissions = [...((button.permissions || []) as { permission: string; actions: string[] }[])]
        for (const permission of [{ permission: 'metric-config', actions }, { permission: 'metric-template', actions: ['query'] }]) {
          if (!permissions.some(existing => existing.permission === permission.permission && JSON.stringify(existing.actions) === JSON.stringify(permission.actions))) permissions.push(permission)
        }
        return { ...button, permissions }
      }) : item.buttons,
  }))
  return walk(menus)
}
