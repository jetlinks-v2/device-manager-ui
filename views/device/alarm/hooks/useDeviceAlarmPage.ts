import { computed, onBeforeUnmount, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useDeviceAlarmRuleSearch } from './useDeviceAlarmRuleSearch'
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
  // 搜索必须回到第一页；编辑/删除只重取已加载页范围，两个信号分开避免丢失滚动上下文。
  const searchKey = ref(0)
  const reloadKey = ref(0)
  const ruleSearch = useDeviceAlarmRuleSearch(() => {
    pageIndex.value = 0
    searchKey.value += 1
  })
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
  // The editor stays mounted after close; use this key to refresh product options for every open.
  const productReloadKey = ref(0)
  const editingRow = ref<DeviceAlarmRow | null>(null)
  const selectedProductOption = ref<DeviceAlarmTargetOption>()
  const selectedDeviceOption = ref<DeviceAlarmTargetOption>()

  const form = ref<DeviceAlarmFormModel>(createEmptyForm())

  const triggerOptions = computed(() => [
    { label: t('DeviceAlarm.trigger.outside'), value: 'outside' },
    { label: t('DeviceAlarm.trigger.inside'), value: 'inside' },
  ])

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
    reloadKey.value += 1
  }

  let requestSequence = 0
  onBeforeUnmount(() => { requestSequence += 1 })

  /** 只读请求单页规则，是否替换或追加列表由调用方决定。 */
  async function fetchRulePage(index: number, size: number) {
    const query = buildPageQuery(index, size)
    const page = await queryDeviceAlarmPage({ ...query, terms: [{ terms: query.terms }] })
    const data = page.data
      .map(toDeviceAlarmPageRow)
      .filter((item): item is DeviceAlarmRow => Boolean(item))
    return { data, total: page.total }
  }

  function mergeRuleRows(pages: DeviceAlarmRow[][]) {
    const seen = new Set<string>()
    const merged: DeviceAlarmRow[] = []
    pages.forEach(rows => rows.forEach((row) => {
      // 偏移分页在增删期间可能重复返回同一条规则，按稳定 key 去重。
      if (seen.has(row.key)) return
      seen.add(row.key)
      merged.push(row)
    }))
    return merged
  }

  async function tableRequest(params: { pageIndex?: number; pageSize?: number }) {
    const sequence = ++requestSequence
    const nextPageIndex = Number(params.pageIndex ?? pageIndex.value)
    const nextPageSize = Number(params.pageSize ?? pageSize.value)
    pageIndex.value = nextPageIndex
    pageSize.value = nextPageSize
    loading.value = true
    try {
      await loadAlarmLevels()
      const page = await fetchRulePage(nextPageIndex, nextPageSize)
      // 搜索与分页可能交错返回，仅最新请求更新列表和总数。
      if (sequence === requestSequence) {
        rows.value = page.data
        total.value = page.total
      }
      return {
        success: true,
        result: { data: page.data, total: page.total, pageIndex: nextPageIndex, pageSize: nextPageSize },
      }
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  /** 滚动加载：追加下一页，返回本次真正新增的规则用于增量查询告警数量。 */
  async function appendRulePage() {
    const nextPageIndex = pageIndex.value + 1
    const sequence = ++requestSequence
    const page = await fetchRulePage(nextPageIndex, pageSize.value)
    if (sequence !== requestSequence) return { data: [] as DeviceAlarmRow[], received: 0, stale: true }
    const loaded = new Set(rows.value.map(row => row.key))
    const data = page.data.filter(row => !loaded.has(row.key))
    rows.value = [...rows.value, ...data]
    pageIndex.value = nextPageIndex
    total.value = page.total
    return { data, received: page.data.length, stale: false }
  }

  /** 编辑/删除后重取已加载页范围，避免列表回退到第一页丢失滚动上下文。 */
  async function reloadRuleRange() {
    const pages = pageIndex.value + 1
    const sequence = ++requestSequence
    loading.value = true
    try {
      await loadAlarmLevels()
      const results: Awaited<ReturnType<typeof fetchRulePage>>[] = []
      // 顺序请求，避免一次性打满服务端；页数等于用户已滚动加载的深度。
      for (let index = 0; index < pages; index += 1) {
        results.push(await fetchRulePage(index, pageSize.value))
      }
      if (sequence !== requestSequence) return { stale: true }
      rows.value = mergeRuleRows(results.map(result => result.data))
      total.value = results[results.length - 1]?.total ?? total.value
      return { stale: false }
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  async function openCreate() {
    editingRow.value = null
    form.value = createEmptyForm()
    await Promise.all([loadAlarmLevels(), loadNotifyResources()])
    selectedProductOption.value = undefined
    selectedDeviceOption.value = undefined
    propertyOptions.value = []
    editorOpen.value = true
    productReloadKey.value += 1
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
    productReloadKey.value += 1
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

  function buildPageQuery(currentPageIndex = pageIndex.value, currentPageSize = pageSize.value) {
    return {
      pageSize: currentPageSize,
      pageIndex: currentPageIndex,
      terms: ruleSearch.terms.value,
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
    invalidateList: () => { requestSequence += 1 },
    rows,
    loading,
    pageIndex,
    pageSize,
    buildPageQuery,
    total,
    searchKey,
    reloadKey,
    keyword: ruleSearch.keyword,
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
    productReloadKey,
    editingRow,
    form,
    refresh,
    tableRequest,
    appendRulePage,
    reloadRuleRange,
    formatTriggerText,
    updateKeyword: ruleSearch.updateKeyword,
    handleSearch: ruleSearch.submit,
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
