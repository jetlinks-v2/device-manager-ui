import { markRaw } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import {
  buildQueryFilter,
  decodeConditionFilterQuery,
  type ConditionFilterField,
  type ConditionFilterTerm,
  type ConditionOptionPanelConfig,
} from '@jetlinks-web-core/components/ConditionFilter'
import { queryDeviceProductById_api, type DeviceLibraryProductFilterOption, type DeviceQueryTerm } from './api/device'
import { queryTree } from './api/category'
import { queryGatewayList, queryNoPagingPost, queryOrgThree } from './api/product'
import type { DeviceGroup } from './api/deviceGroup'
import type { ProjectArea } from './modules/defaults/types'
import { getI18nText } from './utils/i18n'
import { deviceStateList } from './views/device/data'
import TagSearch from './views/device/Instance/components/TagSearch.vue'

type SearchOption = { label: string; value: string; children?: SearchOption[] }
type SearchOptionSource = { id: string; name: string; children?: SearchOptionSource[]; [key: string]: unknown }

/** 引用选项按名称展示，树节点保留层级；组织节点使用设备资产关联条件作为查询值。 */
function toSearchOptions(
  items: SearchOptionSource[] = [],
  getValue: (item: SearchOptionSource) => string = item => item.id,
): SearchOption[] {
  return items.map(item => ({
    label: getI18nText(item, 'name') || item.id,
    value: getValue(item),
    ...(item.children?.length ? { children: toSearchOptions(item.children, getValue) } : {}),
  }))
}

/** 远程选项按名称搜索、按 ID 反查，保证未在首批结果中的分享条件仍能回显。 */
function createRemoteOptionPanel(load: (terms: DeviceQueryTerm[]) => Promise<SearchOption[]>): ConditionOptionPanelConfig {
  return {
    multiple: true,
    showSearch: true,
    loadOptions: keyword => load(keyword ? [{ column: 'name', termType: 'like', value: `%${keyword}%` }] : []),
    loadSelectedOptions: (values = []) => values.length
      ? load([{ column: 'id', termType: 'in', value: values }])
      : Promise.resolve([]),
  }
}

/** 统一列表和批量页使用相同的字段定义解码搜索，避免批量操作丢失列表条件。 */
export function getDeviceListFilterFields(
  _areas: ProjectArea[] = [],
  _groups: DeviceGroup[] = [],
  products: DeviceLibraryProductFilterOption[] = [],
): ConditionFilterField[] {
  const deviceTypeField: ConditionFilterField = {
    dataIndex: 'deviceType',
    title: i18n.global.t('IotDeviceList.filter.type'),
    search: {
      type: 'select',
      defaultTermType: 'eq',
      options: [
        { label: i18n.global.t('Instance.index.133466-12'), value: 'device' },
        { label: i18n.global.t('Instance.index.133466-13'), value: 'childrenDevice' },
        { label: i18n.global.t('Instance.index.133466-14'), value: 'gateway' },
      ],
    },
  }

  // 私有化沿用设备实例页的完整字段与选项源；SaaS 继续限定为资产列表的五个字段。
  if (isPrivateDeployment()) {
    const fields: ConditionFilterField[] = [
      { dataIndex: 'id', title: i18n.global.t('IotDeviceList.filter.identifier'), search: { type: 'string', defaultTermType: 'eq' } },
      { dataIndex: 'name', title: i18n.global.t('IotDeviceList.filter.keyword'), search: { type: 'string', defaultTermType: 'like', first: true } },
      {
        dataIndex: 'productId',
        title: i18n.global.t('Instance.index.133466-2'),
        search: {
          type: 'select',
          defaultTermType: 'in',
          optionPanel: createRemoteOptionPanel(async (terms) => {
            const response = await queryNoPagingPost({ paging: false, terms })
            return toSearchOptions(response.result || [])
          }),
        },
      },
      { dataIndex: 'createTime', title: i18n.global.t('Instance.index.133466-5'), search: { type: 'date' } },
      { dataIndex: 'state', title: i18n.global.t('Instance.index.133466-6'), search: { type: 'select', options: deviceStateList } },
      {
        dataIndex: 'classifiedId',
        title: i18n.global.t('Instance.index.133466-10'),
        search: {
          type: 'treeSelect',
          options: async () => {
            const response = await queryTree({ paging: false })
            return toSearchOptions(Array.isArray(response.result) ? response.result : [])
          },
        },
      },
      {
        dataIndex: 'accessId',
        title: i18n.global.t('Instance.index.133466-11'),
        search: {
          type: 'select',
          defaultTermType: 'in',
          optionPanel: createRemoteOptionPanel(async (terms) => {
            const response = await queryGatewayList({ paging: false, terms, sorts: [{ name: 'createTime', order: 'desc' }] })
            return toSearchOptions(response.result || [])
          }),
        },
      },
      deviceTypeField,
      {
        dataIndex: 'id$dev-tag',
        title: i18n.global.t('Instance.index.133466-15'),
        search: {
          type: 'component',
          components: markRaw(TagSearch),
          defaultTermType: 'eq',
          termOptions: ['eq'],
          formatValuePreview: (value: ConditionFilterTerm[]) => value.map(term => {
            const tag = term.value?.[0]
            return `${tag?.key ?? ''}: ${tag?.value ?? ''}`
          }).join('、'),
        },
      },
      { dataIndex: 'description', title: i18n.global.t('Instance.index.133466-18'), search: { type: 'string', rename: 'describe', defaultTermType: 'like' } },
    ]

    // 与实例页一致，仅在非社区版且具备组织管理菜单时提供组织资产筛选。
    if (isNoCommunity && useMenuStore().hasMenu('system/Department')) {
      fields.splice(fields.length - 2, 0, {
        dataIndex: 'id$dim-assets',
        title: i18n.global.t('Instance.index.133466-16'),
        search: {
          type: 'treeSelect',
          defaultTermType: 'eq',
          termOptions: ['eq'],
          options: async () => {
            const response = await queryOrgThree({ paging: false })
            return toSearchOptions(Array.isArray(response.result) ? response.result : [], item => JSON.stringify({
              assetType: 'device',
              targets: [{ type: 'org', id: item.id }],
            }))
          },
        },
      })
    }
    return fields
  }

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
    deviceTypeField,
    {
      dataIndex: 'accessProvider',
      title: i18n.global.t('IotDeviceList.filter.accessMode'),
      search: {
        type: 'select',
        defaultTermType: 'eq',
        options: [...new Map(products.filter(product => product.accessProvider).map(product => [product.accessProvider, {
          label: product.accessName || product.accessProvider,
          value: product.accessProvider,
        }])).values()],
      },
    },
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

/** 组织通过设备资产关联查询，分类和接入属于产品字段；标签保留 AND / OR 条件组。 */
function normalizeDeviceListSearchTerm(term: DeviceQueryTerm): DeviceQueryTerm {
  if (Array.isArray(term.terms)) {
    return { ...term, terms: term.terms.map(normalizeDeviceListSearchTerm) }
  }
  if (term.column === 'id$dim-assets') {
    // 查询列已携带 dim-assets 操作符，沿用实例页的协议，不再提交编辑器的 eq。
    return { type: term.type, column: term.column, value: term.value }
  }
  if (['classifiedId', 'accessId', 'accessProvider'].includes(String(term.column))) {
    return {
      type: term.type,
      column: 'productId$product-info',
      value: [{ column: term.column, termType: term.termType, value: term.value }],
    }
  }
  if (term.column === 'id$dev-tag' && Array.isArray(term.value)) {
    return { type: term.type, terms: term.value.map((tag: DeviceQueryTerm) => ({ ...tag, termType: 'eq' })) }
  }
  return term
}

/** 将平台条件转为精确字段查询，保留条件组的 AND / OR 关系。 */
export function getDeviceListSearchTerms(query: unknown, _areas: ProjectArea[] = []): DeviceQueryTerm[] {
  const fields = getDeviceListFilterFields()
  const terms = buildQueryFilter(decodeConditionFilterQuery(query, fields), fields).terms as DeviceQueryTerm[]
  return terms.map(normalizeDeviceListSearchTerm)
}
