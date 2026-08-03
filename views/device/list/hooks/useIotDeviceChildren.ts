import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, type TableColumnsType } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { onlyMessage } from '@jetlinks-web/utils'
import { deployDevice_api, normalizeDeviceTypeValue, undeployDevice_api } from '@device-manager-ui/api/device'

import { extractRows, iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'
import { useIotDeviceChildFilters } from './useIotDeviceChildFilters'
import { buildIotDeviceDetailPath, resolveIotProjectId } from './useIotDeviceRouting'

type ChildDeviceRow = {
  id: string
  name: string
  productId?: string
  productName: string
  stateValue: string
  stateText: string
  registryTime?: string
  describe?: string
}

export type IotDeviceChildrenProps = {
  device: IotDevice
}

export function useIotDeviceChildren(
  props: Readonly<IotDeviceChildrenProps>,
  emitCountChange: (count: number) => void,
) {
  const route = useRoute()
  const router = useRouter()
  const { t: $t } = useI18n()

  const loading = ref(false)
  const rows = ref<ChildDeviceRow[]>([])
  const projectId = computed(() => resolveIotProjectId(route))
  const selectedRowKeys = ref<string[]>([])
  const rowActionBusyId = ref('')
  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => $t('IotDeviceChildren.pagination.total', { total }),
  })

  const bindOpen = ref(false)
  const bindLoading = ref(false)
  const bindListLoading = ref(false)
  const bindRows = ref<ChildDeviceRow[]>([])
  const bindSelectedRowKeys = ref<string[]>([])
  const bindFilters = reactive({
    id: '',
    name: '',
    productId: undefined as string | undefined,
  })
  const bindPagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total: number) => $t('IotDeviceChildren.pagination.total', { total }),
  })

  const createOpen = ref(false)
  const childProducts = ref<Array<{ id: string; name: string }>>([])

  const canCreateChild = computed(() => {
    const deviceType = normalizeDeviceTypeValue(props.device.deviceTypeValue || props.device.deviceType)
    return deviceType === 'gateway'
  })
  const productOptions = computed(() => childProducts.value.map((item) => ({ label: item.name, value: item.id })))

  const {
    filterTerms,
    filterFields,
    commonFilterFields,
    buildFilterTerms,
    handleFilterSearch,
    handleFilterTermsUpdate,
  } = useIotDeviceChildFilters(search)

  const columns: TableColumnsType = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: $t('IotDeviceChildren.table.name'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: $t('IotDeviceChildren.table.product'), dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: $t('IotDeviceChildren.table.registryTime'), dataIndex: 'registryTime', key: 'registryTime', width: 180 },
    { title: $t('IotDeviceChildren.table.status'), dataIndex: 'state', key: 'state', width: 120 },
    { title: $t('IotDeviceChildren.table.description'), dataIndex: 'describe', key: 'describe', ellipsis: true },
    { title: $t('IotDeviceChildren.table.action'), key: 'action', width: 156, fixed: 'right' },
  ]

  const bindColumns: TableColumnsType = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
    { title: $t('IotDeviceChildren.table.name'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: $t('IotDeviceChildren.table.product'), dataIndex: 'productName', key: 'productName', ellipsis: true },
    { title: $t('IotDeviceChildren.table.registryTime'), dataIndex: 'registryTime', key: 'registryTime', width: 180 },
    { title: $t('IotDeviceChildren.table.status'), dataIndex: 'state', key: 'state', width: 120 },
  ]

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: (string | number)[]) => {
      selectedRowKeys.value = keys.map(String)
    },
  }))

  const bindRowSelection = computed(() => ({
    selectedRowKeys: bindSelectedRowKeys.value,
    onChange: (keys: (string | number)[]) => {
      bindSelectedRowKeys.value = keys.map(String)
    },
  }))

  function normalizeRow(item: any): ChildDeviceRow {
    return {
      id: item.id,
      name: item.name || item.id,
      productId: item.productId,
      productName: item.productName || '--',
      stateValue: item.state?.value || item.state || '',
      stateText: item.state?.text || item.state?.value || item.state || '--',
      registryTime: item.registryTime || item.createTime,
      describe: item.describe,
    }
  }

  function getTotal(result: any, fallback: number) {
    return Number(result?.total ?? result?.page?.total ?? result?.data?.total ?? fallback)
  }

  function buildSearchTerms() {
    const terms: any[] = [
      {
        column: 'parentId',
        value: props.device.id,
        termType: 'eq',
      },
    ]
    return [
      ...terms,
      ...buildFilterTerms(),
    ]
  }

  function buildBindableTerms() {
    const terms: any[] = [
      {
        terms: [
          {
            column: 'parentId$isnull',
            value: '',
            type: 'or',
          },
        ],
      },
      {
        terms: [
          {
            column: 'id$not',
            value: props.device.id,
            type: 'and',
          },
        ],
        type: 'and',
      },
      {
        terms: [
          {
            termType: 'eq',
            column: 'deviceType',
            value: 'childrenDevice',
          },
        ],
        type: 'and',
      },
    ]
    if (bindFilters.id.trim()) terms.push({ column: 'id', value: bindFilters.id.trim(), termType: 'like', type: 'and' })
    if (bindFilters.name.trim()) terms.push({ column: 'name', value: bindFilters.name.trim(), termType: 'like', type: 'and' })
    if (bindFilters.productId) terms.push({ column: 'productId', value: bindFilters.productId, termType: 'eq', type: 'and' })
    return terms
  }

  async function loadRows() {
    if (!props.device.id) return
    loading.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.queryChildDevices({
        pageIndex: pagination.current - 1,
        pageSize: pagination.pageSize,
        sorts: [{ name: 'createTime', order: 'desc' }],
        terms: buildSearchTerms(),
      })
      const data = extractRows(resp?.result).map(normalizeRow)
      rows.value = data
      pagination.total = getTotal(resp?.result, data.length)
      emitCountChange(pagination.total)
    } finally {
      loading.value = false
    }
  }

  async function loadBindableRows() {
    bindListLoading.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.queryChildDevices({
        pageIndex: bindPagination.current - 1,
        pageSize: bindPagination.pageSize,
        sorts: [{ name: 'createTime', order: 'desc' }],
        terms: buildBindableTerms(),
      })
      const data = extractRows(resp?.result).map(normalizeRow)
      bindRows.value = data
      bindPagination.total = getTotal(resp?.result, data.length)
    } finally {
      bindListLoading.value = false
    }
  }

  async function loadProducts() {
    const resp: any = await iotDeviceDetailRealApi.queryChildProductNoPaging({
      paging: false,
      terms: [
        {
          termType: 'eq',
          column: 'deviceType',
          value: 'childrenDevice',
        },
      ],
    })
    childProducts.value = extractRows(resp?.result).map((item: any) => ({ id: item.id, name: item.name || item.id }))
  }

  function formatTime(value?: string) {
    return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
  }

  function stateStatus(value: string) {
    if (value === 'online') return 'success'
    if (value === 'offline') return 'error'
    if (value === 'notActive' || value === 'disabled') return 'warning'
    return 'default'
  }

  function isChildDisabled(row: ChildDeviceRow) {
    return row.stateValue === 'notActive' || row.stateValue === 'disabled'
  }

  function search() {
    pagination.current = 1
    selectedRowKeys.value = []
    loadRows()
  }

  function refresh() {
    loadRows()
  }

  function onTableChange(nextPagination: any) {
    pagination.current = nextPagination.current
    pagination.pageSize = nextPagination.pageSize
    loadRows()
  }

  function openBind() {
    bindOpen.value = true
    bindSelectedRowKeys.value = []
    loadProducts()
    loadBindableRows()
  }

  function closeBind() {
    bindOpen.value = false
    bindSelectedRowKeys.value = []
  }

  function searchBindable() {
    bindPagination.current = 1
    bindSelectedRowKeys.value = []
    loadBindableRows()
  }

  function resetBindableSearch() {
    bindFilters.id = ''
    bindFilters.name = ''
    bindFilters.productId = undefined
    searchBindable()
  }

  function onBindTableChange(nextPagination: any) {
    bindPagination.current = nextPagination.current
    bindPagination.pageSize = nextPagination.pageSize
    loadBindableRows()
  }

  async function bindSelected() {
    if (!bindSelectedRowKeys.value.length) {
      message.warning($t('IotDeviceChildren.bind.selectFirst'))
      return
    }
    bindLoading.value = true
    try {
      const resp: any = await iotDeviceDetailRealApi.bindDevice(props.device.id, bindSelectedRowKeys.value as any)
      if (resp?.success !== false) {
        message.success($t('IotDeviceChildren.bind.success'))
        closeBind()
        await loadRows()
      }
    } finally {
      bindLoading.value = false
    }
  }

  function openCreate() {
    createOpen.value = true
  }

  async function onChildDeviceCreated() {
    message.success($t('IotDeviceChildren.create.success'))
    await loadRows()
  }

  async function unbindOne(row: ChildDeviceRow) {
    const resp: any = await iotDeviceDetailRealApi.unbindDevice(props.device.id, row.id, {})
    if (resp?.success !== false) {
      message.success($t('IotDeviceChildren.unbind.success'))
      selectedRowKeys.value = selectedRowKeys.value.filter((id) => id !== row.id)
      await loadRows()
    }
  }

  async function toggleChildEnabled(row: ChildDeviceRow) {
    rowActionBusyId.value = row.id
    try {
      if (isChildDisabled(row)) {
        await deployDevice_api(row.id)
        message.success($t('IotDeviceChildren.action.enableSuccess'))
      } else {
        await undeployDevice_api(row.id)
        message.success($t('IotDeviceChildren.action.disableSuccess'))
      }
      await loadRows()
    } catch (error) {
      onlyMessage(error instanceof Error ? error.message : $t('IotDeviceChildren.action.statusUpdateFailed'), 'error')
    } finally {
      rowActionBusyId.value = ''
    }
  }

  async function unbindSelected() {
    if (!selectedRowKeys.value.length) {
      message.warning($t('IotDeviceChildren.unbind.selectFirst'))
      return
    }
    const resp: any = await iotDeviceDetailRealApi.unbindBatchDevice(props.device.id, selectedRowKeys.value as any)
    if (resp?.success !== false) {
      message.success($t('IotDeviceChildren.unbind.success'))
      selectedRowKeys.value = []
      await loadRows()
    }
  }

  function viewChild(row: ChildDeviceRow) {
    const query = { ...route.query, tab: 'overview' } as Record<string, string | undefined>
    delete query.sub

    router.push(buildIotDeviceDetailPath(resolveIotProjectId(route), row.id, query, route))
  }

  watch(
    () => props.device.id,
    () => {
      pagination.current = 1
      selectedRowKeys.value = []
      loadRows()
    },
  )

  onMounted(() => {
    loadRows()
  })

  return {
    bindColumns,
    bindFilters,
    bindListLoading,
    bindLoading,
    bindOpen,
    bindPagination,
    bindRows,
    bindRowSelection,
    bindSelected,
    canCreateChild,
    closeBind,
    columns,
    commonFilterFields,
    createOpen,
    filterFields,
    filterTerms,
    formatTime,
    handleFilterSearch,
    handleFilterTermsUpdate,
    loading,
    isChildDisabled,
    onBindTableChange,
    onTableChange,
    openBind,
    openCreate,
    onChildDeviceCreated,
    pagination,
    productOptions,
    projectId,
    refresh,
    resetBindableSearch,
    rowSelection,
    rowActionBusyId,
    rows,
    search,
    searchBindable,
    selectedRowKeys,
    stateStatus,
    toggleChildEnabled,
    unbindOne,
    unbindSelected,
    viewChild,
  }
}
