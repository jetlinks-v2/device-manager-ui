import i18n from '@jetlinks-web-core/locales'
import {
  buildQueryFilter,
  decodeConditionFilterQuery,
  type ConditionFilterField,
} from '@jetlinks-web-core/components/ConditionFilter'
import { queryDeviceProductById_api, type DeviceLibraryProductFilterOption, type DeviceQueryTerm } from './api/device'
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
  const productOptions = [...new Map(
    products
      .filter(product => product.productId)
      .map(product => [product.productId, {
        label: product.productName || product.productId,
        value: product.productId,
      }]),
  ).values()]

  return [
    { dataIndex: 'name', title: i18n.global.t('IotDeviceList.filter.keyword'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'id', title: i18n.global.t('IotDeviceList.filter.identifier'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'deviceType', title: i18n.global.t('IotDeviceList.filter.type'), search: { type: 'string', defaultTermType: 'like' } },
    { dataIndex: 'accessProvider', title: i18n.global.t('IotDeviceList.filter.accessMode'), search: { type: 'string', defaultTermType: 'like' } },
    {
      dataIndex: 'productId',
      title: i18n.global.t('IotDeviceList.filter.deviceLibrary'),
      search: {
        type: 'select',
        defaultTermType: 'in',
        options: productOptions,
        optionPanel: {
          multiple: true,
          showSearch: true,
          // 已安装设备库以外的产品不在初始选项中；按路由已选 ID 补查，保证分享链接回显产品名称。
          loadSelectedOptions: async (values = []) => {
            const selectedIds = [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))]
            const existing = productOptions.filter(option => selectedIds.includes(String(option.value)))
            const existingIds = new Set(existing.map(option => String(option.value)))
            const missing = selectedIds.filter(id => !existingIds.has(id))
            const fetchedProducts = await Promise.all(missing.map(id => queryDeviceProductById_api(id).catch(() => null)))

            return [
              ...existing,
              ...fetchedProducts
                .filter((product): product is NonNullable<typeof product> => Boolean(product?.id))
                .map(product => ({ label: product.name || product.id, value: product.id })),
            ]
          },
        },
      },
    },
  ]
}

/** 将平台条件转为精确字段查询，保留条件组的 AND / OR 关系。 */
export function getDeviceListSearchTerms(query: unknown, areas: ProjectArea[] = []): DeviceQueryTerm[] {
  const fields = getDeviceListFilterFields()
  const terms = buildQueryFilter(decodeConditionFilterQuery(query, fields), fields).terms as DeviceQueryTerm[]
  const areaScopeIds = buildAreaScopeIds(areas)
  return terms
}
