import { defineComponent, h } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import type { MetricDimensionProvider } from '@jetlinks-web-core/components'
import MetricObjectNavigator from './views/device/metrics/navigation/MetricObjectNavigator.vue'
import { queryMetricGroupTree, queryMetricOwnerPage, resolveMetricObjects } from './api/metricNavigation'
import { useMetricSourceAdapter } from './views/device/metrics/useMetricSourceAdapter'

const deviceCodes = ['iot-user-device-list', 'iot-user/device/list', 'device/Instance']
const has = (codes: string[], action: string) => useAuthStore().hasPermission(codes.map(code => `${code}:${action}`))
// 菜单与查看权限必须属于同一编码，旧菜单别名不能相互拼接授权。
const deviceMenu = () => deviceCodes.find(code => useMenuStore().hasMenu(code) && has([code], 'view'))
const navigator = (type: 'device' | 'product' | 'deviceGroup') => defineComponent({
  name: `Metric${type}Navigator`, props: { selectedId: String }, emits: ['select'],
  setup: (props, { emit }) => () => h(MetricObjectNavigator, { selectedId: props.selectedId, tree: type === 'deviceGroup',
    query: type === 'deviceGroup' ? queryMetricGroupTree : (keyword, page, exactId) => queryMetricOwnerPage(type, keyword, page, exactId),
    onSelect: (selection, origin) => emit('select', selection, origin),
  }),
})

export default {
  deviceGroup: { ownerType: 'deviceGroup', label: () => i18n.global.t('DeviceMetrics.groups'), icon: 'FolderOutlined', order: 20,
    resolveObjects: ids => resolveMetricObjects('deviceGroup', ids),
    readScopes: () => [{ memberType:'deviceGroup', label:i18n.global.t('DeviceMetrics.descendantMetrics'), icon:'FolderOutlined', tree:true },
      ...(deviceMenu() ? [{ memberType:'device', label:i18n.global.t('DeviceMetrics.memberMetrics'), icon:'DesktopOutlined', tree:true }] : [])],
    available: () => Boolean(deviceMenu()), canEdit: () => has(deviceCodes, 'update'), navigator: navigator('deviceGroup'), useSourcePicker: useMetricSourceAdapter,
    toBusiness: selection => {
      const code = deviceMenu()
      if (!code) return
      return { name: useMenuStore().getMenu(code)?.routeName || code, query: { scopeType: 'group', scopeId: selection.ownerId, metricView: 'metrics' } }
    },
  },
  product: { ownerType: 'product', label: () => i18n.global.t('DeviceMetrics.products'), icon: 'AppstoreOutlined', order: 30,
    resolveObjects: ids => resolveMetricObjects('product', ids),
    readScopes: () => deviceMenu() ? [{ memberType:'device', label:i18n.global.t('DeviceMetrics.memberMetrics'), icon:'DesktopOutlined' }] : [],
    inheritance: () => ({ targetType: 'device', label: i18n.global.t('DeviceMetrics.deviceInheritance') }),
    available: () => useMenuStore().hasMenu('device/Product') && has(['device/Product'], 'view'), canEdit: () => has(['device/Product'], 'update'), navigator: navigator('product'), useSourcePicker: useMetricSourceAdapter,
    toBusiness: selection => {
      const menu = useMenuStore()
      if (!menu.hasMenu('device/Product/Detail')) return
      return { name: menu.getMenu('device/Product/Detail')?.routeName || 'device/Product/Detail', params: { id: selection.ownerId }, query: { tab: 'Metrics' } }
    },
  },
  device: { ownerType: 'device', label: () => i18n.global.t('DeviceMetrics.devices'), icon: 'DesktopOutlined', order: 40,
    resolveObjects: ids => resolveMetricObjects('device', ids),
    available: () => Boolean(deviceMenu()), canEdit: () => has(deviceCodes, 'update'), navigator: navigator('device'), useSourcePicker: useMetricSourceAdapter,
    toBusiness: selection => {
      const menu = useMenuStore()
      const code = deviceMenu()
      if (!code || !menu.hasMenu(`${code}/Detail`)) return
      return { name: menu.getMenu(`${code}/Detail`)?.routeName || `${code}/Detail`, params: { id: selection.ownerId }, query: { tab: 'metrics' } }
    },
  },
} satisfies Record<string, MetricDimensionProvider>
