import { computed, type Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { encodeConditionFilterQuery, type ConditionFilterField, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { UnifiedDevice } from '../../../../deviceListProvider'

interface UnifiedDeviceBatchNavigationOptions {
  activeType: Ref<string>
  selected: Ref<UnifiedDevice[]>
  searchTerms: Ref<ConditionFilterTerm[]>
  filterFields: Ref<ConditionFilterField[]>
  syncGatewayStatus: () => void
}

/** 算法配置使用独立菜单范围；插件批量页继续接收已选网关或当前列表查询。 */
export function useUnifiedDeviceBatchNavigation(options: UnifiedDeviceBatchNavigationOptions) {
  const route = useRoute()
  const menu = useMenuStore()
  const auth = useAuthStore()
  // 菜单访问不能代替快捷按钮授权；响应分类和授权变化，点击时复用同一检查。
  const canConfigureGatewayAlgorithms = computed(() => options.activeType.value === 'gateway'
    && menu.hasMenu('algorithm-center')
    && auth.hasPermission('iot-user-device-list:algorithms'))

  function openBatchPage({ key }: { key: string | number }) {
    if (key === 'algorithms') {
      if (!canConfigureGatewayAlgorithms.value) return
      menu.jumpPage('algorithm-center')
      return
    }
    if (key === 'syncStatus') {
      options.syncGatewayStatus()
      return
    }
    const gatewayIds = options.selected.value.filter(device => device.category === 'gateway').map(device => device.id)
    const currentQuery = encodeConditionFilterQuery(options.searchTerms.value, options.filterFields.value)
    menu.jumpPage('iot-user-device-list/Batch', { query: {
      ...route.query, q: currentQuery || route.query.q || undefined, gatewayIds: gatewayIds.length ? gatewayIds : undefined,
      gatewayScope: gatewayIds.length ? undefined : 'query',
      batchTab: String(key),
    } })
  }

  return { openBatchPage, canConfigureGatewayAlgorithms }
}
