import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { ColumnsType } from 'ant-design-vue/es/table'
import type { ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { buildQueryFilter } from '@jetlinks-web-core/components/ConditionFilter'
import {
  deviceAlarmApi,
  queryAlarmTargets,
  queryAlarmTargetPage,
  queryDefaultAlarmLevels,
  queryDeviceAlarmPage,
  queryDeviceAlarmNotifyUsers,
  queryDeviceAlarmNotifyProviders,
  queryProductMetadata,
  toNotifyMethods,
} from '../api'
import type {
  AlarmLevelOption,
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
  DeviceAlarmRow,
  DeviceAlarmSource,
  DeviceAlarmTargetOption,
  ThingModelProperty,
} from '../types'
import {
  buildPreprocessPayload,
  createEmptyNotification,
  DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
  formatTriggerText,
  formatPropertyUnit,
  isDeviceAlarmPreprocess,
  isNumberProperty,
  normalizeNotification,
  parseMetadata,
  propertyIdOf,
  propertyNameOf,
  toDeviceAlarmPageRow,
  validateNotificationMessage,
} from '../utils'
import type { IotAlarmTargetSelectOption, IotAlarmTargetSelectQuery } from '../components/IotAlarmTargetSelect.vue'
import { mergeNotifyUsersById } from '../../../../utils/notifyUser'

export function useDeviceAlarmPage(t: (key: string, params?: Record<string, unknown>) => string) {
  const loading = ref(false)
  const rows = ref<DeviceAlarmRow[]>([])
  const total = ref(0)
  const pageIndex = ref(0)
  const pageSize = ref(10)
  const refreshKey = ref(0)
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const submittedTerms = ref<ConditionFilterTerm[]>([])
  const targetOptions = ref<DeviceAlarmTargetOption[]>([])
  const propertyOptions = ref<ThingModelProperty[]>([])
  const levelOptions = ref<AlarmLevelOption[]>(createDefaultLevelOptions(t))
  const notifyMethods = ref<DeviceAlarmNotifyMethod[]>([])
  const notifyUsers = ref<DeviceAlarmNotifyUser[]>([])
  const levelLoaded = ref(false)
  const notifyLoading = ref(false)
  const notifyUserPageIndex = ref(-1)
  const notifyUserTotal = ref(0)
  const editorOpen = ref(false)
  const editingRow = ref<DeviceAlarmRow | null>(null)
  const selectedProductOption = ref<DeviceAlarmTargetOption>()
  const selectedDeviceOption = ref<DeviceAlarmTargetOption>()

  const form = ref<DeviceAlarmFormModel>(createEmptyForm())

  const triggerOptions = computed(() => [
    { label: t('DeviceAlarm.trigger.outside'), value: 'outside' },
    { label: t('DeviceAlarm.trigger.inside'), value: 'inside' },
  ])

  const filterFields = computed<ConditionFilterField[]>(() => [
    {
      dataIndex: 'productName',
      title: t('DeviceAlarm.form.product'),
      search: {
        type: 'string',
        defaultTermType: 'like',
      },
    },
    {
      dataIndex: 'deviceName',
      title: t('DeviceAlarm.form.deviceRange'),
      search: {
        type: 'string',
        defaultTermType: 'like',
      },
    },
    {
      dataIndex: 'property',
      title: t('DeviceAlarm.column.property'),
      search: {
        type: 'string',
        defaultTermType: 'like',
      },
    },
  ])

  const columns = computed<ColumnsType<DeviceAlarmRow>>(() => [
    { title: t('DeviceAlarm.column.name'), dataIndex: 'name', key: 'name', scopedSlots: true, width: 220 },
    { title: t('DeviceAlarm.form.product'), dataIndex: 'productName', key: 'productName', scopedSlots: true, width: 180 },
    { title: t('DeviceAlarm.form.deviceRange'), dataIndex: 'deviceName', key: 'deviceName', scopedSlots: true, width: 180 },
    { title: t('DeviceAlarm.column.property'), dataIndex: 'propertyName', key: 'propertyName', width: 150 },
    { title: t('DeviceAlarm.column.trigger'), dataIndex: 'trigger', key: 'trigger', scopedSlots: true, width: 190 },
    { title: t('DeviceAlarm.column.level'), dataIndex: 'level', key: 'level', scopedSlots: true, width: 120 },
    { title: t('DeviceAlarm.column.notification'), dataIndex: 'notificationConfigured', key: 'notificationConfigured', scopedSlots: true, width: 130 },
    { title: t('DeviceAlarm.column.action'), dataIndex: 'action', key: 'action', scopedSlots: true, fixed: 'right', width: 130 },
  ])

  const tablePagination = computed(() => ({
    current: pageIndex.value + 1,
    pageSize: pageSize.value,
    pageSizeOptions: ['10', '20', '50'],
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (value: number) => t('DeviceAlarm.table.total', { total: value }),
  }))

  const tableParams = computed(() => ({
    refreshKey: refreshKey.value,
    filterKey: JSON.stringify(submittedTerms.value),
  }))

  async function loadTargets(source?: DeviceAlarmSource) {
    const sources: DeviceAlarmSource[] = source ? [source] : ['product', 'device']
    const result = await Promise.all(sources.map((item) => queryAlarmTargets(item).catch(() => [])))
    targetOptions.value = result.flat()
  }

  async function loadProperties(target?: DeviceAlarmTargetOption, excludeConfigured = false) {
    const metadata = parseMetadata(target?.metadata).properties.length
      ? target?.metadata
      : await queryProductMetadata(target?.productId)
    const properties = parseMetadata(metadata).properties.filter(isNumberProperty)
    if (!excludeConfigured || !target) {
      propertyOptions.value = properties
      return
    }
    const configuredPropertyIds = await queryConfiguredPropertyIds(target)
    propertyOptions.value = properties.map((property) => ({
      ...property,
      alarmConfigured: configuredPropertyIds.has(propertyIdOf(property)),
    }))
  }

  async function loadAlarmLevels() {
    if (levelLoaded.value) return
    const levels = await queryDefaultAlarmLevels().catch(() => [])
    if (levels.length) levelOptions.value = levels
    levelLoaded.value = true
  }

  async function refresh() {
    refreshKey.value += 1
  }

  async function tableRequest(params: { pageIndex?: number; pageSize?: number }) {
    const nextPageIndex = Number(params.pageIndex ?? pageIndex.value)
    const nextPageSize = Number(params.pageSize ?? pageSize.value)
    pageIndex.value = nextPageIndex
    pageSize.value = nextPageSize
    loading.value = true
    try {
      await loadAlarmLevels()
      const page = await queryDeviceAlarmPage(buildPageQuery(nextPageIndex, nextPageSize))
      const data = page.data
        .map(toDeviceAlarmPageRow)
        .filter((item): item is DeviceAlarmRow => Boolean(item))
      rows.value = data
      total.value = page.total
      return {
        success: true,
        result: { data, total: page.total, pageIndex: nextPageIndex, pageSize: nextPageSize },
      }
    } finally {
      loading.value = false
    }
  }

  function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
    filterTerms.value = terms
  }

  function handleSearch(payload?: { terms?: ConditionFilterTerm[] }) {
    submittedTerms.value = payload?.terms ?? filterTerms.value
    pageIndex.value = 0
    refreshKey.value += 1
  }

  async function openCreate() {
    editingRow.value = null
    form.value = createEmptyForm()
    await Promise.all([loadAlarmLevels(), loadNotifyResources()])
    selectedProductOption.value = undefined
    selectedDeviceOption.value = undefined
    propertyOptions.value = []
    editorOpen.value = true
  }

  async function openEdit(row: DeviceAlarmRow) {
    editingRow.value = row
    form.value = {
      ...row,
      limit: { ...row.limit },
      notification: normalizeNotification(row.notification),
    }
    selectedProductOption.value = {
      label: row.source === 'product' ? row.targetName || row.productId || '' : row.productName || row.productId || '',
      value: row.productId || '', source: 'product', productId: row.productId,
    }
    selectedDeviceOption.value = row.source === 'device'
      ? { label: row.targetName || row.deviceId || '', value: row.deviceId || '', source: 'device', productId: row.productId, deviceId: row.deviceId }
      : undefined
    await loadNotifyResources()
    const target = row.source === 'device' ? selectedDeviceOption.value : selectedProductOption.value
    await loadProperties(target)
    editorOpen.value = true
  }

  async function onSourceChange(source: DeviceAlarmSource) {
    form.value.source = source
    form.value.targetId = ''
    form.value.productId = ''
    form.value.deviceId = ''
    form.value.property = ''
    form.value.propertyName = ''
    form.value.propertyUnit = ''
    await loadTargets(source)
    propertyOptions.value = []
  }

  async function onTargetChange(targetId: string) {
    const target = targetOptions.value.find((item) => item.value === targetId)
    form.value.targetId = targetId
    form.value.targetName = target?.label
    form.value.productId = target?.productId
    form.value.deviceId = target?.deviceId
    form.value.property = ''
    form.value.propertyName = ''
    form.value.propertyUnit = ''
    await loadProperties(target, true)
  }

  function onPropertyChange(propertyId: string) {
    const property = propertyOptions.value.find((item) => propertyIdOf(item) === propertyId)
    form.value.property = propertyId
    form.value.propertyName = property ? propertyNameOf(property) : propertyId
    form.value.propertyUnit = formatPropertyUnit(property?.valueType?.unit)
  }

  async function save() {
    const current = form.value
    const error = validateForm(current)
    if (error) {
      message.warning(error)
      return
    }
    if (await isDuplicateCreate(current)) {
      message.warning(t('DeviceAlarm.validation.duplicate'))
      return
    }
    const payload = buildPreprocessPayload(current)
    if (current.source === 'product') {
      await deviceAlarmApi.saveProductAlarm(String(current.productId || current.targetId), current.property, payload)
    } else {
      await deviceAlarmApi.saveDeviceAlarm(String(current.productId), String(current.deviceId || current.targetId), current.property, payload)
    }
    message.success(t('DeviceAlarm.message.saveSuccess', { name: current.name }))
    editorOpen.value = false
    await refresh()
  }

  async function queryConfiguredPropertyIds(target: DeviceAlarmTargetOption) {
    const rows = target.source === 'product'
      ? await deviceAlarmApi.queryProductAlarmList(String(target.productId || target.value), { paging: false })
      : await deviceAlarmApi.queryDeviceAlarmList(String(target.productId), String(target.deviceId || target.value), { paging: false })
    return new Set(
      rows
        .filter(isDeviceAlarmPreprocess)
        .map((item) => String(item.property ?? ''))
        .filter(Boolean),
    )
  }

  async function isDuplicateCreate(current: DeviceAlarmFormModel) {
    if (editingRow.value) return false
    const target: DeviceAlarmTargetOption = {
      label: current.targetName || current.targetId,
      value: current.targetId,
      source: current.source,
      productId: current.productId || (current.source === 'product' ? current.targetId : undefined),
      deviceId: current.deviceId || (current.source === 'device' ? current.targetId : undefined),
    }
    // 后端唯一性是同一作用域下的属性预处理配置，前端新增时保持同一把尺子。
    const configuredPropertyIds = await queryConfiguredPropertyIds(target)
    return configuredPropertyIds.has(current.property)
  }

  async function loadNotifyResources() {
    notifyLoading.value = true
    try {
      const selectedUserIds = [...new Set(form.value.notification.userIds.map(String).filter(Boolean))]
      // Saved recipients may be outside the first dropdown page, so resolve them separately.
      const [channels, users, selectedUsers] = await Promise.all([
        queryDeviceAlarmNotifyProviders().catch(() => []),
        queryDeviceAlarmNotifyUsers({ pageIndex: 0 }).catch(() => ({ data: [], total: 0 })),
        selectedUserIds.length
          ? queryDeviceAlarmNotifyUsers({ paging: false, userIds: selectedUserIds }).catch(() => ({ data: [], total: 0 }))
          : Promise.resolve({ data: [], total: 0 }),
      ])
      notifyMethods.value = toNotifyMethods(channels)
      const retainedUsers = notifyUsers.value.filter((user) => selectedUserIds.includes(user.id))
      notifyUsers.value = mergeNotifyUsersById(
        retainedUsers,
        mergeNotifyUsersById(selectedUsers.data, users.data),
      )
      notifyUserPageIndex.value = 0
      notifyUserTotal.value = users.total
    } finally {
      notifyLoading.value = false
    }
  }

  async function loadMoreNotifyUsers() {
    if (notifyLoading.value || notifyUsers.value.length >= notifyUserTotal.value) return
    notifyLoading.value = true
    try {
      const page = await queryDeviceAlarmNotifyUsers({ pageIndex: notifyUserPageIndex.value + 1 })
      notifyUsers.value = mergeNotifyUsersById(notifyUsers.value, page.data)
      notifyUserPageIndex.value += 1
      notifyUserTotal.value = page.total
    } finally {
      notifyLoading.value = false
    }
  }

  async function remove(row: DeviceAlarmRow) {
    if (row.source === 'product') {
      await deviceAlarmApi.deleteProductAlarm(String(row.productId), row.property)
    } else {
      await deviceAlarmApi.deleteDeviceAlarm(String(row.productId), String(row.deviceId), row.property)
    }
    message.success(t('DeviceAlarm.message.deleteSuccess', { name: row.name }))
    await refresh()
  }

  function getFilterTerms() {
    const filter = buildQueryFilter(submittedTerms.value, filterFields.value)
    return Array.isArray(filter.terms) ? filter.terms : []
  }

  function buildPageQuery(currentPageIndex = pageIndex.value, currentPageSize = pageSize.value) {
    return {
      pageSize: currentPageSize,
      pageIndex: currentPageIndex,
      terms: getFilterTerms(),
      sorts: [{ name: 'id', order: 'desc' }],
    }
  }

  function validateForm(current: DeviceAlarmFormModel) {
    if (!current.name.trim()) return t('DeviceAlarm.validation.name')
    if (!current.targetId) return t('DeviceAlarm.validation.target')
    if (!current.property) return t('DeviceAlarm.validation.property')
    if (current.limit.lower === undefined || current.limit.upper === undefined) {
      return t('DeviceAlarm.validation.limit')
    }
    if (Number(current.limit.lower) > Number(current.limit.upper)) {
      return t('DeviceAlarm.validation.limitOrder')
    }
    const hasChannel = Boolean(current.notification.channelProviders.length || current.notification.notifyChannelIds?.length)
    const hasRecipient = Boolean(current.notification.userIds.length || current.notification.dimensions?.length)
    if (current.notification.enabled && !hasChannel) {
      return t('DeviceAlarm.validation.notifyChannel')
    }
    if (current.notification.enabled && !hasRecipient) return t('DeviceAlarm.validation.notifyUser')
    if (current.source === 'device' && current.notification.enabled) {
      const messageError = validateNotificationMessage(current.notification)
      if (messageError === 'required') return t('DeviceAlarm.validation.notifyMessage')
      if (messageError === 'maxLength') {
        return t('DeviceAlarm.validation.notifyMessageMaxLength', {
          max: DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
        })
      }
    }
    return ''
  }

  async function requestProducts(query: IotAlarmTargetSelectQuery) {
    const page = await queryAlarmTargetPage('product', query)
    return toPagedSelectPage(page)
  }

  async function requestDevices(query: IotAlarmTargetSelectQuery) {
    if (!form.value.productId) return { data: [], total: 0 }
    const page = await queryAlarmTargetPage('device', { ...query, productId: form.value.productId })
    return toPagedSelectPage(page)
  }

  async function onProductChange(option?: IotAlarmTargetSelectOption) {
    const target = option?.data as DeviceAlarmTargetOption | undefined
    if (!target) {
      selectedProductOption.value = undefined
      selectedDeviceOption.value = undefined
      form.value.targetId = ''
      form.value.targetName = ''
      form.value.productId = undefined
      form.value.deviceId = undefined
      form.value.source = 'product'
      form.value.property = ''
      form.value.propertyName = ''
      form.value.propertyUnit = ''
      propertyOptions.value = []
      return
    }
    selectedProductOption.value = target
    selectedDeviceOption.value = undefined
    form.value.source = 'product'
    form.value.targetId = target.value
    form.value.targetName = target.label
    form.value.productId = target.productId
    form.value.productName = target.label
    form.value.deviceId = undefined
    form.value.property = ''
    form.value.propertyName = ''
    form.value.propertyUnit = ''
    await loadProperties(target, true)
  }

  async function onDeviceChange(value?: string, option?: IotAlarmTargetSelectOption) {
    if (!value || value === '__all__') {
      const target = selectedProductOption.value
      if (!target) return
      selectedDeviceOption.value = undefined
      form.value.source = 'product'
      form.value.targetId = target.value
      form.value.targetName = target.label
      form.value.deviceId = undefined
      await loadProperties(target, true)
      return
    }
    const target = option?.data as DeviceAlarmTargetOption | undefined
    if (!target) return
    selectedDeviceOption.value = target
    form.value.source = 'device'
    form.value.targetId = target.value
    form.value.targetName = target.label
    form.value.deviceId = target.deviceId
    // 设备规则可覆盖产品规则，但同一设备已配置的属性不能重复新增。
    await loadProperties(target, true)
  }

  return {
    total,
    tablePagination,
    tableParams,
    filterTerms,
    filterFields,
    columns,
    levelOptions,
    triggerOptions,
    targetOptions,
    propertyOptions,
    selectedProductOption,
    selectedDeviceOption,
    notifyMethods,
    notifyUsers,
    notifyLoading,
    editorOpen,
    editingRow,
    form,
    refresh,
    tableRequest,
    formatTriggerText,
    handleFilterTermsUpdate,
    handleSearch,
    openCreate,
    openEdit,
    onSourceChange,
    onTargetChange,
    requestProducts,
    requestDevices,
    onProductChange,
    onDeviceChange,
    onPropertyChange,
    loadMoreNotifyUsers,
    save,
    remove,
  }
}

function toPagedSelectPage(page: { data: DeviceAlarmTargetOption[]; total: number }) {
  return {
    data: page.data.map((item) => ({ label: item.label, value: item.value, data: item })),
    total: page.total,
  }
}

function createEmptyForm(): DeviceAlarmFormModel {
  return {
    name: '',
    source: 'product',
    targetId: '',
    property: '',
    level: 4,
    trigger: 'outside',
    limit: {},
    notification: createEmptyNotification(),
  }
}

function createDefaultLevelOptions(t: (key: string, params?: Record<string, unknown>) => string): AlarmLevelOption[] {
  return [
    { label: t('DeviceAlarm.level.emergency'), value: 1 },
    { label: t('DeviceAlarm.level.urgent'), value: 2 },
    { label: t('DeviceAlarm.level.severity'), value: 3 },
    { label: t('DeviceAlarm.level.ordinary'), value: 4 },
    { label: t('DeviceAlarm.level.warn'), value: 5 },
  ]
}
