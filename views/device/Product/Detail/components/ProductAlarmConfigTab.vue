<template>
  <section class="product-alarm-config">
    <div class="product-alarm-config__bar">
      <a-input-search
        v-model:value="propertySearchText"
        class="product-alarm-config__search"
        allow-clear
        enter-button
        :placeholder="$t('DeviceAlarm.detail.configSearchPlaceholder')"
        @search="searchProperties"
      >
        <template #enterButton>
          <a-button>
            <template #icon><AIcon type="SearchOutlined" aria-hidden="true" /></template>
          </a-button>
        </template>
      </a-input-search>
    </div>

    <a-table
      row-key="key"
      size="small"
      :loading="loading"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'propertyName'">
          <div class="product-alarm-config__property">
            <span>{{ record.propertyName }}</span>
            <span>{{ record.property }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'trigger'">
          <span>{{ record.configured ? rowTriggerText(record) : $t('DeviceAlarm.notification.none') }}</span>
        </template>
        <template v-else-if="column.key === 'level'">
          <a-badge v-if="record.configured" :status="levelTone(record.level)" :text="levelLabel(record.level)" />
          <span v-else>{{ $t('DeviceAlarm.notification.none') }}</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space v-if="canUpdate">
            <a-button type="link" @click="openEdit(record)">
              {{ $t('DeviceAlarm.action.edit') }}
            </a-button>
            <a-popconfirm
              v-if="record.configured"
              :title="$t('DeviceAlarm.confirm.delete', { name: record.name })"
              @confirm="remove(record)"
            >
              <a-button type="link" danger>
                {{ $t('DeviceAlarm.action.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
      <template #emptyText><CloudEmpty :description="$t('Product.detail.alarmConfigEmpty')" /></template>
    </a-table>

    <a-pagination
      v-if="paginationTotal"
      v-model:current="pageCurrent"
      class="product-alarm-config__pagination"
      size="small"
      :page-size="pageSize"
      :total="paginationTotal"
      :show-size-changer="false"
      @change="load"
    />

    <DeviceAlarmEditorModal
      v-model:open="editorOpen"
      :model="form"
      fixed-product-scope
      readonly-scope
      :level-options="levelOptions"
      :trigger-options="triggerOptions"
      :property-options="propertyOptions"
      :notify-methods="notifyMethods"
      :notify-users="notifyUsers"
      :notify-loading="notifyLoading"
      @product-change="() => undefined"
      @device-change="() => undefined"
      @property-change="() => undefined"
      @load-more-users="loadMoreNotifyUsers"
      @save="save"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useProductStore } from '@device-manager-ui/store/product'
import DeviceAlarmEditorModal from '@device-manager-ui/views/device/alarm/components/DeviceAlarmEditorModal.vue'
import {
  deviceAlarmApi,
  queryDefaultAlarmLevels,
  queryDeviceAlarmNotifyMethods,
  queryDeviceAlarmNotifyUsers,
} from '@device-manager-ui/views/device/alarm/api'
import type {
  AlarmLevelOption,
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
  DeviceAlarmRow,
  ThingModelProperty,
} from '@device-manager-ui/views/device/alarm/types'
import {
  buildPreprocessPayload,
  createEmptyNotification,
  DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
  formatTriggerText,
  formatPropertyUnit,
  isNumberProperty,
  levelTone,
  normalizeNotification,
  parseMetadata,
  propertyIdOf,
  propertyNameOf,
  toDeviceAlarmRow,
  validateNotificationMessage,
} from '@device-manager-ui/views/device/alarm/utils'

type ProductAlarmRow = DeviceAlarmRow & { configured: boolean }

const { t: $t } = useI18n()
const productStore = useProductStore()
const permissionStore = useAuthStore()
const loading = ref(false)
const rows = ref<ProductAlarmRow[]>([])
const propertyKeyword = ref('')
const propertySearchText = ref('')
const pageCurrent = ref(1)
const pageSize = ref(10)
const editorOpen = ref(false)
const productId = computed(() => String(productStore.current?.id ?? ''))
const productName = computed(() => String(productStore.current?.name ?? productId.value))
const canUpdate = computed(() => permissionStore.hasPermission('device/Product:update'))
const form = ref<DeviceAlarmFormModel>(createEmptyForm())
const propertyOptions = ref<ThingModelProperty[]>([])
const levelOptions = ref<AlarmLevelOption[]>(createDefaultLevelOptions())
const notifyMethods = ref<DeviceAlarmNotifyMethod[]>([])
const notifyUsers = ref<DeviceAlarmNotifyUser[]>([])
const notifyLoading = ref(false)
const notifyUserPageIndex = ref(-1)
const notifyUserTotal = ref(0)

const properties = computed(() => parseMetadata(productStore.current?.metadata).properties.filter(isNumberProperty))
const filteredProperties = computed(() => {
  const keyword = propertyKeyword.value.trim().toLowerCase()
  if (!keyword) return properties.value
  return properties.value.filter((item) => [propertyIdOf(item), propertyNameOf(item)].join(' ').toLowerCase().includes(keyword))
})
const paginationTotal = computed(() => filteredProperties.value.length)
const columns = computed(() => [
  { title: $t('DeviceAlarm.column.property'), dataIndex: 'propertyName', key: 'propertyName' },
  { title: $t('DeviceAlarm.column.name'), dataIndex: 'name', key: 'name' },
  { title: $t('DeviceAlarm.column.trigger'), dataIndex: 'trigger', key: 'trigger' },
  { title: $t('DeviceAlarm.column.level'), dataIndex: 'level', key: 'level', width: 110 },
  { title: $t('DeviceAlarm.column.action'), key: 'action', width: 130 },
])
const triggerOptions = computed(() => [
  { label: $t('DeviceAlarm.trigger.outside'), value: 'outside' },
  { label: $t('DeviceAlarm.trigger.inside'), value: 'inside' },
])

/** Loads only product-level preprocessors for the properties rendered on this page. */
async function load() {
  if (!productId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    propertyOptions.value = properties.value
    const maxPage = Math.max(1, Math.ceil(filteredProperties.value.length / pageSize.value))
    if (pageCurrent.value > maxPage) pageCurrent.value = maxPage
    const pageProperties = filteredProperties.value.slice((pageCurrent.value - 1) * pageSize.value, pageCurrent.value * pageSize.value)
    const propertyIds = pageProperties.map(propertyIdOf).filter(Boolean)
    if (!propertyIds.length) {
      rows.value = []
      return
    }
    const propertyMap = new Map(pageProperties.map((property) => [propertyIdOf(property), property]))
    const configuredRows = await deviceAlarmApi.queryProductAlarmList(productId.value, {
      paging: false,
      terms: [{ column: 'property', termType: 'in', value: propertyIds }],
    })
    const configurations = configuredRows
      .map((item) => toDeviceAlarmRow(item, 'product', productName.value, propertyMap.get(String(item.property ?? ''))))
      .filter((item): item is DeviceAlarmRow => Boolean(item))
    const configurationMap = new Map(configurations.map((item) => [item.property, item]))
    rows.value = pageProperties.map((property) => {
      const propertyId = propertyIdOf(property)
      const configuration = configurationMap.get(propertyId)
      return configuration ? { ...configuration, configured: true } : createUnconfiguredRow(propertyId, property)
    })
  } finally {
    loading.value = false
  }
}

async function openEdit(row: ProductAlarmRow) {
  form.value = createProductFormFromRow(row)
  await loadNotifyResources()
  editorOpen.value = true
}

function searchProperties() {
  propertyKeyword.value = propertySearchText.value
  pageCurrent.value = 1
  void load()
}

async function save() {
  const validationError = validateForm(form.value)
  if (validationError) {
    message.warning(validationError)
    return
  }
  // 该页面没有设备覆盖层，所有写入都固定落到当前产品的预处理器。
  await deviceAlarmApi.saveProductAlarm(productId.value, form.value.property, buildPreprocessPayload(form.value))
  message.success($t('DeviceAlarm.message.saveSuccess', { name: form.value.name }))
  editorOpen.value = false
  await load()
}

async function remove(row: ProductAlarmRow) {
  await deviceAlarmApi.deleteProductAlarm(productId.value, row.property)
  message.success($t('DeviceAlarm.message.deleteSuccess', { name: row.name }))
  await load()
}

async function loadNotifyResources() {
  notifyLoading.value = true
  try {
    const [methods, users] = await Promise.all([
      queryDeviceAlarmNotifyMethods().catch(() => []),
      queryDeviceAlarmNotifyUsers({ pageIndex: 0 }).catch(() => ({ data: [], total: 0 })),
    ])
    notifyMethods.value = methods
    notifyUsers.value = users.data
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
    const userMap = new Map(notifyUsers.value.map((user) => [user.id, user]))
    page.data.forEach((user) => userMap.set(user.id, user))
    notifyUsers.value = [...userMap.values()]
    notifyUserPageIndex.value += 1
    notifyUserTotal.value = page.total
  } finally {
    notifyLoading.value = false
  }
}

function createUnconfiguredRow(propertyId: string, property: ThingModelProperty): ProductAlarmRow {
  const propertyName = propertyNameOf(property)
  return {
    key: `none:${productId.value}:${propertyId}`,
    name: propertyName,
    source: 'product',
    targetId: productId.value,
    targetName: productName.value,
    productId: productId.value,
    productName: productName.value,
    property: propertyId,
    propertyName,
    propertyUnit: formatPropertyUnit(property.valueType?.unit),
    level: 4,
    trigger: 'outside',
    limit: {},
    notification: createEmptyNotification(),
    configured: false,
  }
}

function createProductFormFromRow(row: ProductAlarmRow): DeviceAlarmFormModel {
  return {
    ...row,
    source: 'product',
    targetId: productId.value,
    targetName: productName.value,
    productId: productId.value,
    productName: productName.value,
    deviceId: undefined,
    limit: { ...row.limit },
    notification: row.configured ? normalizeNotification(row.notification) : createEmptyNotification(),
  }
}

function createEmptyForm(): DeviceAlarmFormModel {
  return {
    name: '',
    source: 'product',
    targetId: productId.value,
    productId: productId.value,
    productName: productName.value,
    property: '',
    level: 4,
    trigger: 'outside',
    limit: {},
    notification: createEmptyNotification(),
  }
}

function validateForm(current: DeviceAlarmFormModel) {
  if (current.limit.lower === undefined || current.limit.upper === undefined) return $t('DeviceAlarm.validation.limit')
  if (Number(current.limit.lower) > Number(current.limit.upper)) return $t('DeviceAlarm.validation.limitOrder')
  const hasChannel = Boolean(current.notification.channelProviders.length || current.notification.notifyChannelIds?.length)
  const hasRecipient = Boolean(current.notification.userIds.length || current.notification.dimensions?.length)
  if (current.notification.enabled && !hasChannel) return $t('DeviceAlarm.validation.notifyChannel')
  if (current.notification.enabled && !hasRecipient) return $t('DeviceAlarm.validation.notifyUser')
  const messageError = validateNotificationMessage(current.notification)
  if (current.notification.enabled && messageError === 'required') return $t('DeviceAlarm.validation.notifyMessage')
  if (current.notification.enabled && messageError === 'maxLength') {
    return $t('DeviceAlarm.validation.notifyMessageMaxLength', { max: DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH })
  }
  return ''
}

function rowTriggerText(record: ProductAlarmRow) {
  return formatTriggerText(record)
}

function levelLabel(level: number) {
  return levelOptions.value.find((item) => item.value === level)?.label || level
}

function createDefaultLevelOptions(): AlarmLevelOption[] {
  return [
    { label: $t('DeviceAlarm.level.emergency'), value: 1 },
    { label: $t('DeviceAlarm.level.urgent'), value: 2 },
    { label: $t('DeviceAlarm.level.severity'), value: 3 },
    { label: $t('DeviceAlarm.level.ordinary'), value: 4 },
    { label: $t('DeviceAlarm.level.warn'), value: 5 },
  ]
}

onMounted(() => {
  void queryDefaultAlarmLevels().then((levels) => { if (levels.length) levelOptions.value = levels }).catch(() => undefined)
  void load()
})

watch(
  () => [productId.value, productStore.current?.metadata],
  () => {
    pageCurrent.value = 1
    void load()
  },
)
</script>

<style scoped lang="less">
.product-alarm-config { display: grid; gap: var(--space-3); }
.product-alarm-config__bar { display: flex; justify-content: flex-end; }
.product-alarm-config__search { width: 16.25rem; max-width: 100%; }
.product-alarm-config__search :deep(svg) { width: 0.875rem; height: 0.875rem; color: var(--jet-theme-text-disabled); }
.product-alarm-config__property { display: grid; gap: 0.125rem; line-height: 1.35; }
.product-alarm-config__property span:first-child { color: var(--jet-theme-text); font-weight: 600; }
.product-alarm-config__property span:last-child { color: var(--jet-theme-text-disabled); font-size: var(--fs-14); }
.product-alarm-config__pagination { justify-self: end; }
</style>
