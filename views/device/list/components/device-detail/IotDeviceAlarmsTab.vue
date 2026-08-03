<template>
  <section class="alarm-record-tab" :aria-label="$t('IotDeviceDetail.alarms.aria')">
    <IotDeviceAlarmHandleModal
      v-model:open="handleOpen"
      :record="currentRecord"
      :readonly="handleMode === 'view'"
      @success="reloadTable"
    />
    <IotDeviceAlarmLogDrawer
      v-model:open="logOpen"
      :record="currentRecord"
      @handle="openHandle"
    />

    <ConditionFilter
      v-model="filterTerms"
      class="alarm-record-tab__filter"
      :fields="filterFields"
      :common-fields="commonFilterFields"
      :placeholder="$t('DeviceAlarm.record.searchPlaceholder')"
      @change="handleSearch"
    />

    <JProTable
      ref="tableRef"
      row-key="id"
      mode="TABLE"
      class="alarm-record-tab__table"
      :columns="columns"
      :request="queryRecords"
      :params="tableParams"
      :defaultParams="{ sorts: [{ name: 'alarmTime', order: 'desc' }] }"
      :alertShow="false"
      :bodyStyle="{ padding: 0 }"
    >
      <template #alarmTime="record">
        {{ formatApiTime(record.alarmTime) }}
      </template>
      <template #duration="record">
        {{ formatDuration(record) }}
      </template>
      <template #alarmName="record">
        <j-ellipsis>{{ displayText(record.alarmName) }}</j-ellipsis>
      </template>
      <template #level="record">
        <span>{{ levelLabel(record.level ?? record.alarmLevel) }}</span>
      </template>
      <template #triggerDesc="record">
        <span class="threshold"><j-ellipsis>{{ displayText(record.triggerDesc) }}</j-ellipsis></span>
      </template>
      <template #actualDesc="record">
        <j-ellipsis>{{ displayText(record.actualDesc) }}</j-ellipsis>
      </template>
      <template #handleTime="record">
        {{ record.handleTime ? formatApiTime(record.handleTime) : '--' }}
      </template>
      <template #handleType="record">
        {{ enumText(record.handleType) }}
      </template>
      <template #state="record">
        <a-tag :color="enumValue(record.state) === 'normal' ? 'success' : 'error'">
          {{ stateLabel(record.state) }}
        </a-tag>
      </template>
      <template #actions="record">
        <a-space>
          <a-button type="link" size="small" @click="enumValue(record.state) === 'normal' ? openView(record) : openHandle(record)">
            {{ enumValue(record.state) === 'normal' ? $t('DeviceAlarm.record.detail') : $t('DeviceAlarm.record.handle') }}
          </a-button>
          <a-button type="link" size="small" @click="openLog(record)">
            {{ $t('DeviceAlarm.record.log') }}
          </a-button>
        </a-space>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('DeviceAlarm.record.empty')" />
      </template>
    </JProTable>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import {
  buildQueryFilter,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import { queryDefaultAlarmLevels } from '@device-manager-ui/views/device/alarm/api'
import type { AlarmLevelOption } from '@device-manager-ui/views/device/alarm/types'
import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../../types'
import IotDeviceAlarmHandleModal from './IotDeviceAlarmHandleModal.vue'
import IotDeviceAlarmLogDrawer from './IotDeviceAlarmLogDrawer.vue'

const props = defineProps<{
  device: IotDevice
}>()

const { t: $t } = useI18n()
const tableRef = ref()
const filterTerms = ref<ConditionFilterTerm[]>([])
const submittedTerms = ref<ConditionFilterTerm[]>([])
const currentRecord = ref<Record<string, any> | null>(null)
const handleOpen = ref(false)
const logOpen = ref(false)
const handleMode = ref<'handle' | 'view'>('handle')
const levelOptions = ref<AlarmLevelOption[]>([])
const commonFilterFields = ['alarmName', 'triggerDesc', 'actualDesc']
const stateOptions = computed(() => [
  { label: $t('DeviceAlarm.record.alarming'), value: 'warning' },
  { label: $t('DeviceAlarm.record.handled'), value: 'normal' },
])

const filterFields = computed<ConditionFilterField[]>(() => [
  {
    title: $t('DeviceAlarm.record.alarmTime'),
    dataIndex: 'alarmTime',
    search: { type: 'date' },
  },
  {
    title: $t('DeviceAlarm.record.alarmName'),
    dataIndex: 'alarmName',
    search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] },
  },
  {
    title: $t('DeviceAlarm.record.condition'),
    dataIndex: 'triggerDesc',
    search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] },
  },
  {
    title: $t('DeviceAlarm.record.reason'),
    dataIndex: 'actualDesc',
    search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] },
  },
  {
    title: $t('DeviceAlarm.record.handleTime'),
    dataIndex: 'handleTime',
    search: { type: 'date' },
  },
  {
    title: $t('DeviceAlarm.record.handleType'),
    dataIndex: 'handleType',
    search: {
      type: 'select',
      defaultTermType: 'eq',
      options: [
        { label: $t('DeviceAlarm.record.handleTypeUser'), value: 'user' },
        { label: $t('DeviceAlarm.record.handleTypeSystem'), value: 'system' },
      ],
      optionPanel: { multiple: false, showSearch: false },
    },
  },
  {
    title: $t('DeviceAlarm.record.status'),
    dataIndex: 'state',
    search: {
      type: 'select',
      defaultTermType: 'eq',
      options: stateOptions.value,
      optionPanel: { multiple: false, showSearch: false },
    },
  },
])

const columns = computed(() => [
  { title: $t('DeviceAlarm.record.alarmTime'), dataIndex: 'alarmTime', key: 'alarmTime', scopedSlots: true, width: 180 },
  { title: $t('DeviceAlarm.record.duration'), dataIndex: 'duration', key: 'duration', scopedSlots: true, width: 130 },
  { title: $t('DeviceAlarm.record.alarmName'), dataIndex: 'alarmName', key: 'alarmName', scopedSlots: true, ellipsis: true, width: 160 },
  { title: $t('DeviceAlarm.record.level'), dataIndex: 'level', key: 'level', scopedSlots: true, width: 110 },
  { title: $t('DeviceAlarm.record.condition'), dataIndex: 'triggerDesc', key: 'triggerDesc', scopedSlots: true, ellipsis: true, width: 180 },
  { title: $t('DeviceAlarm.record.reason'), dataIndex: 'actualDesc', key: 'actualDesc', scopedSlots: true, ellipsis: true },
  { title: $t('DeviceAlarm.record.handleTime'), dataIndex: 'handleTime', key: 'handleTime', scopedSlots: true, width: 180 },
  { title: $t('DeviceAlarm.record.handleType'), dataIndex: 'handleType', key: 'handleType', scopedSlots: true, width: 110 },
  { title: $t('DeviceAlarm.record.status'), dataIndex: 'state', key: 'state', scopedSlots: true, width: 100 },
  { title: $t('DeviceAlarm.column.action'), dataIndex: 'actions', key: 'actions', scopedSlots: true, fixed: 'right', width: 130 },
])

const tableParams = computed(() => ({ terms: buildRecordTerms() }))

onMounted(async () => {
  levelOptions.value = await queryDefaultAlarmLevels().catch(() => [])
})

watch(() => props.device.id, resetSearch)

async function queryRecords(params: Record<string, any>) {
  if (!props.device.id) return emptyResponse(params)
  const resp: any = await iotDeviceDetailRealApi.queryAlarmByDevice(params)
  const result = resp?.result ?? {}
  return {
    ...resp,
    result: {
      ...result,
      data: extractRows(result),
    },
  }
}

function handleSearch(payload?: { terms?: ConditionFilterTerm[] }) {
  submittedTerms.value = payload?.terms ?? filterTerms.value
}

function resetSearch() {
  filterTerms.value = []
  submittedTerms.value = []
  reloadTable()
}

function reloadTable() { tableRef.value?.reload?.() }

function buildRecordTerms() {
  const filter = buildQueryFilter(submittedTerms.value, filterFields.value)
  return [
    {
      // 设备告警记录后端按 sourceId + targetType 限定设备范围，保持与标准版设备详情一致。
      terms: [
        { column: 'sourceId', value: props.device.id, termType: 'eq' },
        { column: 'targetType', value: 'device', termType: 'eq' },
      ],
      type: 'and',
    },
    ...(Array.isArray(filter.terms) ? filter.terms : []),
  ]
}

function emptyResponse(params: Record<string, any>) {
  return {
    success: true,
    result: {
      data: [],
      total: 0,
      pageIndex: Number(params.pageIndex ?? 0),
      pageSize: Number(params.pageSize ?? 10),
    },
  }
}

function openHandle(record?: Record<string, any> | null) {
  currentRecord.value = record ?? null
  handleMode.value = 'handle'
  handleOpen.value = true
}

function openView(record: Record<string, any>) {
  currentRecord.value = record
  handleMode.value = 'view'
  handleOpen.value = true
}

function openLog(record: Record<string, any>) {
  currentRecord.value = record
  logOpen.value = true
}

function enumValue(value: unknown) {
  return value && typeof value === 'object' ? String((value as any).value ?? '') : String(value ?? '')
}

function enumText(value: unknown, fallback = '--') {
  if (value && typeof value === 'object') return String((value as any).text ?? (value as any).value ?? fallback)
  return displayText(value || fallback)
}

function stateLabel(value: unknown) {
  const text = enumText(value, '')
  if (text) return text
  return enumValue(value) === 'normal' ? $t('DeviceAlarm.record.handled') : $t('DeviceAlarm.record.alarming')
}

function levelLabel(value: unknown) {
  const level = Number(enumValue(value))
  const option = levelOptions.value.find((item) => item.value === level)
  return option?.label || enumText(value)
}

function displayText(value: unknown) { return value === undefined || value === null || value === '' ? '--' : String(value) }

function formatDuration(record: Record<string, any>) {
  const start = dayjs(record.alarmTime)
  const end = enumValue(record.state) === 'warning' ? dayjs() : dayjs(record.handleTime)
  if (!start.isValid() || !end.isValid()) return '--'
  const seconds = end.diff(start, 'second')
  if (seconds < 0) return '--'
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`
  return `${(seconds / 3600).toFixed(1)} h`
}

defineExpose({ resetSearch })
</script>

<style scoped src="./IotDeviceAlarmsTab.css"></style>
