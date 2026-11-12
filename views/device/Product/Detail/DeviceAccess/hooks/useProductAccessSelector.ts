import { onScopeDispose, ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import { onlyMessage } from '@jetlinks-web/utils'
import { useI18n } from 'vue-i18n'
import { useTabSaveSuccess } from '@jetlinks-web-core/hooks'
import { queryList, getAccessConfig } from '../../../../../../api/product'
import { getProductByPluginId } from '../../../../../../api/link/plugin'
import { getProviders } from '../../../../../../api/link/accessConfig'
import type { AccessGateway, AccessSelection } from '../accessState'

interface SelectorProps {
  productId?: string
  accessId?: string
  deviceType?: string
  providersList: { id: string; description?: string }[]
}

/** 选择期间固定请求目标；改选、取消和卸载都会使旧响应失效。 */
export function useProductAccessSelector(props: SelectorProps, emit: {
  (event: 'submit', data: AccessSelection): void
  (event: 'cancel'): void
}) {
  const { t: $t } = useI18n()
  const checkData = ref<AccessGateway>()
  const tableRef = ref<{ reload: () => void }>()
  const loading = ref(false)
  const params = ref({ pageSize: 4, terms: [] as unknown[] })
  const selectedRowKeys = ref<string[]>(props.accessId ? [props.accessId] : [])
  let selectionVersion = 0
  let disposed = false
  const { onOpen } = useTabSaveSuccess('link/AccessConfig/Detail', {
    onSuccess(value) {
      if (disposed) return
      tableRef.value?.reload()
      handleClick(value.result)
    },
  })
  const temp = {
    ...params.value,
    terms: props.deviceType === 'childrenDevice'
      ? [{ terms: [{ column: 'provider', termType: 'in', value: 'child-device,edge-child-device' }] }]
      : [],
  }

  /** 列表只补全查询开始时的默认选中项，避免覆盖用户后续选择。 */
  async function handleQuery(query: unknown) {
    const version = selectionVersion
    const response = await queryList(query)
    if (!disposed && version === selectionVersion) {
      const rows = (response.result as { data?: AccessGateway[] })?.data || []
      const selected = rows.find(item => item.id === selectedRowKeys.value[0])
      if (selected) checkData.value = selected
    }
    return response
  }

  /** 同一响应同时提供网关、配置定义和插件产品类型，不读取 await 之后的选中状态。 */
  async function submitData() {
    if (loading.value) return
    if (!checkData.value?.id || checkData.value.id !== selectedRowKeys.value[0]) {
      onlyMessage($t('DeviceAccess.accessModal.132524-11'), 'error')
      return
    }
    const access = cloneDeep(checkData.value)
    const productId = props.productId
    if (!productId) return
    const version = ++selectionVersion
    loading.value = true
    try {
      const [metadata, products] = await Promise.all([
        getAccessConfig(productId, access.id),
        access.channel === 'plugin' ? getProductByPluginId(access.channelId!) : Promise.resolve(undefined),
      ])
      if (disposed || version !== selectionVersion || productId !== props.productId) return
      if (!metadata.success || (products && !products.success)) return
      emit('submit', {
        access,
        metadata: metadata.result || [],
        productTypes: products?.result || [],
      } as AccessSelection)
    } finally {
      if (!disposed && version === selectionVersion) loading.value = false
    }
  }

  /** 改选后立即允许确认新选项，上一轮请求不能关闭或覆盖当前弹窗。 */
  function handleClick(data: AccessGateway) {
    selectionVersion += 1
    loading.value = false
    selectedRowKeys.value = [data.id]
    checkData.value = cloneDeep(data)
  }

  /** 取消后即使请求完成也不能提交选择。 */
  function cancel() {
    selectionVersion += 1
    loading.value = false
    emit('cancel')
  }

  function handleSearch(value: { terms: unknown[] }) { params.value.terms = value.terms }
  function add() { onOpen({ view: false, save: true }) }
  const getDescription = (item: { description?: string; provider?: string }) =>
    item.description || props.providersList.find(provider => provider.id === item.provider)?.description

  const columns = [
    {
      title: $t('DeviceAccess.accessModal.132524-5'),
      dataIndex: 'name',
      key: 'name',
      search: {
        type: 'string',
      },
    },
    {
      title: $t('DeviceAccess.accessModal.132524-6'),
      dataIndex: 'provider',
      key: 'provider',
      search: {
        type: 'select',
        options: () => {
          return new Promise(resolve => {
            getProviders().then((res: { result?: { id: string; name: string }[] }) => {
              resolve(res.result?.map((item: any) => ({...item, label: item.name, value: item.id})) || [])
            })
          })
        },
      },
    },
    {
      title: $t('DeviceAccess.accessModal.132524-7'),
      dataIndex: 'state',
      key: 'state',
      search: {
        type: 'select',
        options: [
          {
            label: $t('DeviceAccess.accessModal.132524-8'),
            value: 'enabled',
          },
          {
            label: $t('DeviceAccess.accessModal.132524-9'),
            value: 'disabled',
          },
        ],
      },
    },
    {
      title: $t('DeviceAccess.accessModal.132524-10'),
      key: 'description',
      dataIndex: 'description',
      search: {
        type: 'string',
      },
    },
  ]

  onScopeDispose(() => { disposed = true; selectionVersion += 1 })
  return { tableRef, loading, params, selectedRowKeys, temp, columns, getDescription, handleQuery, submitData, handleClick, cancel, handleSearch, add }
}
