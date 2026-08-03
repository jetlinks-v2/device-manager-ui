<template>
  <section class="device-alarm-config">
    <div class="device-alarm-config__bar">
      <a-input-search
        v-model:value="propertySearchText"
        class="device-alarm-config__search"
        allow-clear
        enter-button
        :placeholder="$t('DeviceAlarm.detail.configSearchPlaceholder')"
        @search="searchProperties"
      >
        <template #enterButton>
          <a-button>
            <template #icon>
              <AIcon type="SearchOutlined" aria-hidden="true" />
            </template>
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
          <div class="device-alarm-config__property">
            <span>{{ record.propertyName }}</span>
            <span>{{ record.property }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'source'">
          <a-tag>{{ sourceLabel(record.source) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'trigger'">
          <span>{{ record.configured ? rowTriggerText(record) : $t('DeviceAlarm.notification.none') }}</span>
        </template>
        <template v-else-if="column.key === 'level'">
          <a-badge
            v-if="record.configured"
            :status="levelTone(record.level)"
            :text="levelLabel(record.level)"
          />
          <span v-else>{{ $t('DeviceAlarm.notification.none') }}</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="openEdit(toAlarmRow(record))">
              {{ $t('DeviceAlarm.action.edit') }}
            </a-button>
            <a-popconfirm
              v-if="record.source === 'device'"
              :title="$t('DeviceAlarm.confirm.delete', { name: record.name })"
              @confirm="remove(toAlarmRow(record))"
            >
              <a-button type="link" size="small" danger>
                {{ $t('DeviceAlarm.action.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-pagination
      v-if="paginationTotal"
      v-model:current="pageCurrent"
      class="device-alarm-config__pagination"
      size="small"
      :page-size="pageSize"
      :total="paginationTotal"
      :show-size-changer="false"
      @change="load"
    />

    <DeviceAlarmEditorModal
      v-model:open="editorOpen"
      :model="form"
      readonly-scope
      :level-options="levelOptions"
      :trigger-options="triggerOptions"
      :product-option="productOption"
      :device-option="deviceOption"
      :product-request="emptyTargetRequest"
      :device-request="emptyTargetRequest"
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
import { computed, onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import DeviceAlarmEditorModal from '../../../alarm/components/DeviceAlarmEditorModal.vue'
import {
  deviceAlarmApi,
  queryDefaultAlarmLevels,
  queryDeviceAlarmNotifyMethods,
  queryDeviceAlarmNotifyUsers,
} from '../../../alarm/api'
import type {
  AlarmLevelOption,
  DeviceAlarmFormModel,
  DeviceAlarmNotifyMethod,
  DeviceAlarmNotifyUser,
  DeviceAlarmRow,
  DeviceAlarmSource,
  ThingModelProperty,
} from '../../../alarm/types'
import {
  buildPreprocessPayload,
  createEmptyNotification,
  DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
  formatTriggerText,
  formatPropertyUnit,
  isNumberProperty,
  levelTone,
  normalizeNotification,
  propertyIdOf,
  propertyNameOf,
  toDeviceAlarmRow,
  validateNotificationMessage,
} from '../../../alarm/utils'
import type { IotDevice } from '../../types'

type EffectiveAlarmSource = DeviceAlarmSource | 'none'
type EffectiveAlarmRow = Omit<DeviceAlarmRow, 'source'> & {
  source: EffectiveAlarmSource
  configured: boolean
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  properties: {
    type: Array as PropType<ThingModelProperty[]>,
    default: () => [],
  },
})

const { t: $t } = useI18n()
const loading = ref(false)
const rows = ref<EffectiveAlarmRow[]>([])
const propertyKeyword = ref('')
const propertySearchText = ref('')
const pageCurrent = ref(1)
const pageSize = ref(10)
const editorOpen = ref(false)
const form = ref<DeviceAlarmFormModel>(createEmptyForm())
const propertyOptions = ref<ThingModelProperty[]>([])
const levelOptions = ref<AlarmLevelOption[]>(createDefaultLevelOptions())
const notifyMethods = ref<DeviceAlarmNotifyMethod[]>([])
const notifyUsers = ref<DeviceAlarmNotifyUser[]>([])
const notifyLoading = ref(false)
const notifyUserPageIndex = ref(-1)
const notifyUserTotal = ref(0)

const columns = computed(() => [
  { title: $t('DeviceAlarm.column.property'), dataIndex: 'propertyName', key: 'propertyName' },
  { title: $t('DeviceAlarm.column.source'), dataIndex: 'source', key: 'source', width: 110 },
  { title: $t('DeviceAlarm.column.name'), dataIndex: 'name', key: 'name' },
  { title: $t('DeviceAlarm.column.trigger'), dataIndex: 'trigger', key: 'trigger' },
  { title: $t('DeviceAlarm.column.level'), dataIndex: 'level', key: 'level', width: 110 },
  { title: $t('DeviceAlarm.column.action'), key: 'action', width: 130 },
])

const triggerOptions = computed(() => [
  { label: $t('DeviceAlarm.trigger.outside'), value: 'outside' },
  { label: $t('DeviceAlarm.trigger.inside'), value: 'inside' },
])
const productOption = computed(() => ({
  label: props.device.productName || props.device.productId,
  value: props.device.productId,
  source: 'product' as const,
  productId: props.device.productId,
}))
const deviceOption = computed(() => ({
  label: props.device.name || props.device.id,
  value: props.device.id,
  source: 'device' as const,
  productId: props.device.productId,
  deviceId: props.device.id,
}))
const emptyTargetRequest = async () => ({ data: [], total: 0 })

const properties = computed(() => props.properties.filter(isNumberProperty))
const filteredProperties = computed(() => {
  const keyword = propertyKeyword.value.trim().toLowerCase()
  if (!keyword) return properties.value
  return properties.value.filter((item) => {
    const propertyId = propertyIdOf(item)
    const propertyName = propertyNameOf(item)
    return [propertyId, propertyName].join(' ').toLowerCase().includes(keyword)
  })
})
const paginationTotal = computed(() => filteredProperties.value.length)
const levelLabel = (level: number) => levelOptions.value.find((item) => item.value === level)?.label || level
const toAlarmRow = (record: Record<string, any>) => record as EffectiveAlarmRow
const rowTriggerText = (record: Record<string, any>) => formatTriggerText(toAlarmRow(record))
const sourceLabel = (source: EffectiveAlarmSource) => {
  if (source === 'product') return $t('DeviceAlarm.source.product')
  if (source === 'device') return $t('DeviceAlarm.source.device')
  return $t('DeviceAlarm.notification.none')
}

async function load() {
  if (!props.device.productId || !props.device.id) return
  loading.value = true
  try {
    propertyOptions.value = properties.value
    const propertyMap = new Map(properties.value.map((property) => [propertyIdOf(property), property]))
    const maxPage = Math.max(1, Math.ceil(filteredProperties.value.length / pageSize.value))
    if (pageCurrent.value > maxPage) pageCurrent.value = maxPage
    const start = (pageCurrent.value - 1) * pageSize.value
    const pageProperties = filteredProperties.value.slice(start, start + pageSize.value)
    const propertyIds = pageProperties.map(propertyIdOf)
    if (!propertyIds.length) {
      rows.value = []
      return
    }
    const queryParams = {
      paging: false,
      terms: [{ column: 'property', termType: 'in', value: propertyIds }],
    }
    const [productRows, deviceRows] = await Promise.all([
      deviceAlarmApi.queryProductAlarmList(props.device.productId, queryParams).catch(() => []),
      deviceAlarmApi.queryDeviceAlarmList(props.device.productId, props.device.id, queryParams).catch(() => []),
    ])
    const productAlarms = productRows
      .map((item) => toDeviceAlarmRow(item, 'product', props.device.productName || '-', propertyMap.get(String(item.property ?? ''))))
      .filter((item): item is DeviceAlarmRow => Boolean(item))
    const deviceAlarms = deviceRows
      .map((item) => toDeviceAlarmRow(item, 'device', props.device.name, propertyMap.get(String(item.property ?? ''))))
      .filter((item): item is DeviceAlarmRow => Boolean(item))
    const productMap = new Map(productAlarms.map((item) => [item.property, item]))
    const deviceMap = new Map(deviceAlarms.map((item) => [item.property, item]))
    rows.value = pageProperties.map((metadataProperty) => {
      const propertyId = propertyIdOf(metadataProperty)
      const property = propertyMap.get(propertyId)
      const config = deviceMap.get(propertyId) || productMap.get(propertyId)
      if (config) return { ...config, configured: true }
      return createUnconfiguredRow(propertyId, property)
    })
  } finally {
    loading.value = false
  }
}

async function loadAlarmLevels() {
  const levels = await queryDefaultAlarmLevels().catch(() => [])
  if (levels.length) levelOptions.value = levels
}
async function openEdit(row: EffectiveAlarmRow) {
  form.value = createDeviceFormFromRow(row)
  await loadNotifyResources()
  editorOpen.value = true
}

function searchProperties() {
  propertyKeyword.value = propertySearchText.value
  pageCurrent.value = 1
  void load()
}

async function save() {
  const current = form.value
  const validationError = validateForm(current)
  if (validationError) {
    message.warning(validationError)
    return
  }
  const payload = buildPreprocessPayload(current)
  await deviceAlarmApi.saveDeviceAlarm(String(props.device.productId), props.device.id, current.property, payload)
  message.success($t('DeviceAlarm.message.saveSuccess', { name: current.name }))
  editorOpen.value = false
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

async function remove(row: EffectiveAlarmRow) {
  if (row.source !== 'device') return
  await deviceAlarmApi.deleteDeviceAlarm(String(props.device.productId), props.device.id, row.property)
  message.success($t('DeviceAlarm.message.deleteSuccess', { name: row.name }))
  await load()
}

function createUnconfiguredRow(propertyId: string, property?: ThingModelProperty): EffectiveAlarmRow {
  const propertyName = property ? propertyNameOf(property) : propertyId
  return {
    key: `none:${props.device.productId}:${props.device.id}:${propertyId}`,
    name: propertyName,
    source: 'none',
    targetId: props.device.id,
    targetName: props.device.name,
    productId: props.device.productId,
    deviceId: props.device.id,
    property: propertyId,
    propertyName,
    propertyUnit: formatPropertyUnit(property?.valueType?.unit),
    level: 4,
    trigger: 'outside',
    limit: {},
    notification: createEmptyNotification(),
    configured: false,
  }
}

function createDeviceFormFromRow(row: EffectiveAlarmRow): DeviceAlarmFormModel {
  return {
    ...row,
    id: row.source === 'device' ? row.id : undefined,
    source: 'device',
    targetId: props.device.id,
    targetName: props.device.name,
    productId: props.device.productId,
    deviceId: props.device.id,
    limit: { ...row.limit },
    notification: row.source === 'device'
      ? normalizeNotification(row.notification)
      : createEmptyNotification(),
  }
}

function createEmptyForm(): DeviceAlarmFormModel {
  return {
    name: '',
    source: 'device',
    targetId: props.device.id,
    productId: props.device.productId,
    deviceId: props.device.id,
    property: '',
    level: 4,
    trigger: 'outside',
    limit: {},
    notification: createEmptyNotification(),
  }
}

function validateForm(current: DeviceAlarmFormModel) {
  if (current.limit.lower === undefined || current.limit.upper === undefined) {
    return $t('DeviceAlarm.validation.limit')
  }
  if (Number(current.limit.lower) > Number(current.limit.upper)) {
    return $t('DeviceAlarm.validation.limitOrder')
  }
  const hasChannel = Boolean(current.notification.channelProviders.length || current.notification.notifyChannelIds?.length)
  const hasRecipient = Boolean(current.notification.userIds.length || current.notification.dimensions?.length)
  if (current.notification.enabled && !hasChannel) {
    return $t('DeviceAlarm.validation.notifyChannel')
  }
  if (current.notification.enabled && !hasRecipient) return $t('DeviceAlarm.validation.notifyUser')
  const messageError = validateNotificationMessage(current.notification)
  if (current.notification.enabled && messageError === 'required') {
    return $t('DeviceAlarm.validation.notifyMessage')
  }
  if (current.notification.enabled && messageError === 'maxLength') {
    return $t('DeviceAlarm.validation.notifyMessageMaxLength', {
      max: DEVICE_ALARM_NOTIFICATION_MESSAGE_MAX_LENGTH,
    })
  }
  return ''
}

onMounted(() => {
  void loadAlarmLevels()
  void load()
})

watch(
  () => [props.device.id, props.device.productId, props.properties.length],
  () => {
    pageCurrent.value = 1
    void load()
  },
)

function createDefaultLevelOptions(): AlarmLevelOption[] {
  return [
    { label: $t('DeviceAlarm.level.emergency'), value: 1 },
    { label: $t('DeviceAlarm.level.urgent'), value: 2 },
    { label: $t('DeviceAlarm.level.severity'), value: 3 },
    { label: $t('DeviceAlarm.level.ordinary'), value: 4 },
    { label: $t('DeviceAlarm.level.warn'), value: 5 },
  ]
}

</script>

<style scoped lang="less">
.device-alarm-config {
  display: grid;
  gap: var(--space-3);
}
.device-alarm-config__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.device-alarm-config__search {
  width: 16.25rem;
  max-width: 100%;
}
.device-alarm-config__search :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-text-disabled);
}
.device-alarm-config__property {
  display: grid;
  gap: 0.125rem;
  line-height: 1.35;
}
.device-alarm-config__property span:first-child {
  color: var(--jet-theme-text);
  font-weight: 600;
}
.device-alarm-config__property span:last-child {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}
.device-alarm-config__pagination {
  justify-self: end;
}
</style>
