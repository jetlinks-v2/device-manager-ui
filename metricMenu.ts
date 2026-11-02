import i18n from '@jetlinks-web-core/locales'
import type { MenuItem } from '@jetlinks-web-core/types/module'

/** code、id 与原规则组一致；core 只为已授权叶子合并父壳，不由前端授予菜单。 */
export const metricMenuCatalog = (menus: MenuItem[]): MenuItem[] => {
  const walk = (items: MenuItem[]): MenuItem[] => items.map(item => ({
    ...item,
    ...(item.children ? { children: walk(item.children) } : {}),
    ...(['device/Metric', 'device/MetricTemplate'].includes(item.code) ? { options: { ...item.options, routeTarget: 'rule-engine' } } : {}),
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
  const result = walk(menus)
  const hasCode = (items: MenuItem[], code: string): boolean => items.some(item => item.code === code || hasCode(item.children || [], code))
  const children: MenuItem[] = []
  if (!hasCode(result, 'device/Metric')) children.push({
    code: 'device/Metric', id: 'device-metric', name: i18n.global.t('DeviceMetrics.businessMetrics'),
    i18nMessages: { name: { zh_CN: '业务指标', en_US: 'Business metrics', en: 'Business metrics' } },
    url: '/rule-engine/metrics', icon: 'LineChartOutlined', sortIndex: 30, showPage: ['metric-config'], options: { routeTarget: 'rule-engine' },
    buttons: [
      { id: 'view', name: i18n.global.t('DeviceMetrics.title'), permissions: [{ permission: 'metric-config', actions: ['query'] }, { permission: 'metric-template', actions: ['query'] }] },
      { id: 'save', name: i18n.global.t('DeviceMetrics.save'), permissions: [{ permission: 'metric-config', actions: ['query', 'save', 'delete'] }, { permission: 'metric-template', actions: ['query'] }] },
    ],
  } as MenuItem)
  if (!hasCode(result, 'device/MetricTemplate')) children.push({
    code: 'device/MetricTemplate', id: 'device-metric-template', name: i18n.global.t('DeviceMetrics.templates'),
    i18nMessages: { name: { zh_CN: '指标模板', en_US: 'Metric templates', en: 'Metric templates' } },
    url: '/resources/devices/metric-templates', icon: 'LineChartOutlined', sortIndex: 40, showPage: ['metric-template'], options: { routeTarget: 'rule-engine' },
    buttons: [
      { id: 'view', name: i18n.global.t('DeviceMetrics.templates'), permissions: [{ permission: 'metric-template', actions: ['query'] }] },
      { id: 'save', name: i18n.global.t('DeviceMetrics.save'), permissions: [{ permission: 'metric-template', actions: ['query', 'save', 'delete'] }] },
    ],
  } as MenuItem)
  if (children.length) result.push({
    code: 'rule-engine', id: '91aa7c753b1c030dfad612aa0a45d453', name: i18n.global.t('DeviceMetrics.ruleAndCalculation'),
    i18nMessages: { name: { zh_CN: '规则与计算', en_US: 'Rules and calculations', en: 'Rules and calculations' } },
    owner: 'iot', sortIndex: 5, url: '/rule-engine', icon: 'icon-guizeyinqing', permissions: [], buttons: [], children,
    options: { previousNames: ['规则引擎', 'Rule Engine'] },
  } as MenuItem)
  return result
}
