import i18n from '@jetlinks-web-core/locales'
import {
  buildQueryFilter,
  decodeConditionFilterQuery,
  type ConditionFilterField,
} from '@jetlinks-web-core/components/ConditionFilter'
import type { DeviceLibraryProductFilterOption, DeviceQueryTerm } from './api/device'
import type { DeviceGroup } from './api/deviceGroup'
import type { ProjectArea } from './modules/defaults/types'
import { getIotDeviceAssetFilterFields, normalizeIotDeviceQueryTerms } from './views/device/list/hooks/useIotDeviceAssetFilters'
import { buildAreaScopeIds } from './views/device/list/hooks/useIotDeviceScopeCounts'

/** 统一列表和批量页使用相同的字段定义解码搜索，避免批量操作丢失列表条件。 */
export function getDeviceListFilterFields(
  areas: ProjectArea[] = [],
  groups: DeviceGroup[] = [],
  products: DeviceLibraryProductFilterOption[] = [],
): ConditionFilterField[] {
  return [
    { dataIndex: 'name', title: i18n.global.t('IotDeviceList.filter.keyword'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'id', title: i18n.global.t('IotDeviceList.filter.identifier'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'deviceType', title: i18n.global.t('IotDeviceList.filter.type'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'accessProvider', title: i18n.global.t('IotDeviceList.filter.accessMode'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'productId', title: i18n.global.t('IotDeviceList.filter.deviceLibrary'), search: { type: 'string', defaultTermType: 'like' } },  ]
}

/** 将平台条件转为精确字段查询，保留条件组的 AND / OR 关系。 */
export function getDeviceListSearchTerms(query: unknown, areas: ProjectArea[] = []): DeviceQueryTerm[] {
  const fields = getDeviceListFilterFields()
  const terms = buildQueryFilter(decodeConditionFilterQuery(query, fields), fields).terms as DeviceQueryTerm[]
  const areaScopeIds = buildAreaScopeIds(areas)
  return terms
}
