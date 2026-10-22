import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '@jetlinks-web-core/store'
import { encodeConditionFilterQuery, type ConditionFilterField, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { UnifiedDevice } from '../../../../deviceListProvider'

interface UnifiedDeviceBatchNavigationOptions {
  selected: Ref<UnifiedDevice[]>
  searchTerms: Ref<ConditionFilterTerm[]>
  filterFields: Ref<ConditionFilterField[]>
  syncGatewayStatus: () => void
}

/** 算法配置使用独立菜单范围；插件批量页继续接收已选网关或当前列表查询。 */
export function useUnifiedDeviceBatchNavigation(options: UnifiedDeviceBatchNavigationOptions) {
  const route = useRoute()
  const menu = useMenuStore()

  function openBatchPage({ key }: { key: string | number }) {
    if (key === 'algorithms') {
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

  return { openBatchPage }
}
