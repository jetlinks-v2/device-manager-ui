<template>
  <section class="logs-pro-tab">
    <IotDeviceLogDetailDrawer
      :open="detailOpen"
      :device="device"
      :row="selectedLog"
      @update:open="detailOpen = $event"
    />

    <ConditionFilter
      v-model="filterTerms"
      class="logs-pro-tab__filter"
      :fields="filterFields"
      :common-fields="filterCommonFields"
      :placeholder="$t('IotDeviceDetail.logsSearch.searchPlaceholder')"
      @change="handleSearch"
    />

    <JProTable
      ref="tableRef"
      mode="TABLE"
      row-key="id"
      class="logs-pro-tab__table"
      :columns="columns"
      :request="queryLogs"
      :params="tableParams"
      :defaultParams="{ sorts: [{ name: 'timestamp', order: 'desc' }] }"
      :alertShow="false"
      :bodyStyle="{ padding: 0 }"
    >
      <template #type="record">
        <span class="log-chip">{{ record.typeText }}</span>
      </template>
      <template #direction="record">
        <span class="log-direction" :data-direction="record.direction">
          {{ record.direction === 'down' ? $t('IotDeviceDetail.logs.direction.down') : $t('IotDeviceDetail.logs.direction.up') }}
        </span>
      </template>
      <template #time="record">
        <time>{{ record.happenedAt }}</time>
      </template>
      <template #content="record">
        <j-ellipsis>{{ record.message }}</j-ellipsis>
      </template>
      <template #action="record">
        <a-tooltip :title="$t('IotDeviceDetail.logsSearch.viewDetail')">
          <a-button type="link" size="small" @click="openDetail(record)">
            <template #icon><AIcon type="SearchOutlined" /></template>
          </a-button>
        </a-tooltip>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('IotDeviceDetail.logsSearch.empty')" />
      </template>
    </JProTable>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import {
  buildQueryFilter,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '@jetlinks-web-core/components/ConditionFilter'
import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice, IotDeviceLog } from '../../types'
import IotDeviceLogDetailDrawer from './IotDeviceLogDetailDrawer.vue'

interface LogRow {
  id: string
  type: string
  typeText: string
  direction: 'up' | 'down'
  message: string
  happenedAt: string
  rawContent: string
  raw: any
}

type LogDirection = 'up' | 'down'

// DeviceLogType does not persist a direction field. Keep the query-side type
// groups aligned with the direction shown in the log table.
const DOWNLINK_LOG_TYPES = [
  'readProperty',
  'writeProperty',
  'functionInvoke',
  'readFirmware',
  'pullFirmware',
  'upgradeFirmware',
  'stateCheck',
  'disconnect',
  'readCollectorData',
  'writeCollectorData',
] as const

const UPLINK_LOG_TYPES = [
  'event',
  'writePropertyReply',
  'reportProperty',
  'readPropertyReply',
  'child',
  'childReply',
  'functionReply',
  'register',
  'unregister',
  'readFirmwareReply',
  'reportFirmware',
  'pullFirmwareReply',
  'upgradeFirmwareReply',
  'upgradeFirmwareProgress',
  'log',
  'tag',
  'offline',
  'online',
  'other',
  'direct',
  'acknowledge',
  'metadata',
  'stateCheckReply',
  'disconnectReply',
  'reportCollectorData',
  'readCollectorDataReply',
  'writeCollectorDataReply',
  'broadcast',
  'batch',
  'module',
  'unknown',
] as const

const LOG_TYPES_BY_DIRECTION: Record<LogDirection, readonly string[]> = {
  up: UPLINK_LOG_TYPES,
  down: DOWNLINK_LOG_TYPES,
}
const DOWNLINK_LOG_TYPE_SET = new Set<string>(DOWNLINK_LOG_TYPES)
const UPLINK_LOG_TYPE_SET = new Set<string>(UPLINK_LOG_TYPES)

const props = defineProps<{
  device: IotDevice
  logs: IotDeviceLog[]
}>()

const { t: $t } = useI18n()
const tableRef = ref()
const logTypeOptions = ref<Array<{ label: string; value: string }>>([])
const filterTerms = ref<ConditionFilterTerm[]>([])
// Keep editing terms separate from submitted terms so the table refresh is explicit.
const submittedTerms = ref<ConditionFilterTerm[]>([])
const detailOpen = ref(false)
const selectedLog = ref<LogRow | null>(null)
const filterCommonFields = ['typeText', 'direction', 'happenedAt', 'message']
const filterFields = computed<ConditionFilterField[]>(() => [
  {
    title: $t('IotDeviceDetail.logs.column.type'),
    dataIndex: 'type',
    search: {
      type: 'select',
      options: logTypeOptions.value,
    },
  },
  {
    title: $t('IotDeviceDetail.logs.column.direction'),
    dataIndex: 'direction',
    search: {
      type: 'select',
      options: [
        { label: $t('IotDeviceDetail.logs.direction.up'), value: 'up' },
        { label: $t('IotDeviceDetail.logs.direction.down'), value: 'down' },
      ],
      handleParamsItem: (term) => ({
        ...term,
        column: 'type',
        termType: 'in',
        value: LOG_TYPES_BY_DIRECTION[term.value as LogDirection] ?? [],
      }),
    },
  },
  { title: $t('IotDeviceDetail.logs.column.time'), dataIndex: 'timestamp', search: { type: 'date' } },
  { title: $t('IotDeviceDetail.logs.column.content'), dataIndex: 'content', search: { type: 'string', termTypeOptions: ['like', 'eq'] } },
])

const columns = computed(() => [
  { title: $t('IotDeviceDetail.logs.column.type'), dataIndex: 'type', key: 'type', scopedSlots: true, width: 120 },
  { title: $t('IotDeviceDetail.logs.column.direction'), dataIndex: 'direction', key: 'direction', scopedSlots: true, width: 90 },
  { title: $t('IotDeviceDetail.logs.column.time'), dataIndex: 'time', key: 'time', scopedSlots: true, width: 168 },
  { title: $t('IotDeviceDetail.logs.column.content'), dataIndex: 'content', key: 'content', scopedSlots: true },
  { title: $t('IotDeviceDetail.common.action'), dataIndex: 'action', key: 'action', scopedSlots: true, width: 64, align: 'center' },
])

const tableParams = computed(() => ({
  terms: buildQueryTerms(),
}))

onMounted(() => {
  void loadLogTypes()
})

watch(
  () => props.device.id,
  () => {
    filterTerms.value = []
    submittedTerms.value = []
    tableRef.value?.reload?.()
  },
  { immediate: true },
)

async function loadLogTypes() {
  const resp: any = await iotDeviceDetailRealApi.queryLogsType()
  logTypeOptions.value = extractRows(resp?.result ?? resp)
    .map((item: any) => ({
      label: item.text || item.label || item.value,
      value: String(item.value),
    }))
    .filter((item) => item.label && item.value)
}

async function queryLogs(params: Record<string, unknown>) {
  if (!props.device.id) return fallbackLogResponse(params)
  const resp: any = await iotDeviceDetailRealApi.queryLog(props.device.id, params)
  const result = resp?.result ?? {}
  return {
    ...resp,
    result: {
      ...result,
      data: extractRows(result).map(mapApiLog),
    },
  }
}

function fallbackLogResponse(params: Record<string, unknown>) {
  const pageIndex = Number(params.pageIndex ?? 0)
  const pageSize = Number(params.pageSize ?? 12)
  const rows = props.logs.map(mapFallbackLog)
  return {
    success: true,
    result: {
      data: rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
      pageIndex,
      pageSize,
      total: rows.length,
    },
  }
}

function handleSearch(payload?: { terms?: ConditionFilterTerm[] }) {
  submittedTerms.value = payload?.terms ?? filterTerms.value
  tableRef.value?.reload?.()
}

function buildQueryTerms() {
  return buildQueryFilter(submittedTerms.value, filterFields.value).terms ?? []
}

function mapApiLog(item: any, index: number): LogRow {
  const type = item.type?.value || item.type || ''
  const typeText = item.type?.text || item.type?.label || item.type?.value || item.type || $t('IotDeviceDetail.logs.defaultType')
  const content = item.content ?? item.message ?? ''
  return {
    id: item.id || `${item.timestamp || item.createTime || index}-${type}`,
    type: String(type || typeText),
    typeText: String(typeText),
    direction: inferDirection(String(type), typeText, content),
    message: String(content || '--'),
    happenedAt: formatApiTime(item.timestamp || item.createTime),
    rawContent: String(content || ''),
    raw: item,
  }
}

function mapFallbackLog(log: IotDeviceLog): LogRow {
  return {
    id: `fallback-${log.id}`,
    type: log.title || log.level || 'device-log',
    typeText: log.title || $t('IotDeviceDetail.logs.defaultType'),
    direction: inferDirection('', log.title, log.message),
    message: log.message || '--',
    happenedAt: log.happenedAt,
    rawContent: log.message || '',
    raw: log,
  }
}

function inferDirection(type = '', typeText = '', content = ''): LogDirection {
  if (DOWNLINK_LOG_TYPE_SET.has(type)) return 'down'
  if (UPLINK_LOG_TYPE_SET.has(type)) return 'up'
  // Keep the existing content-based fallback for local or unknown log rows.
  return /下发|调用|WRITE|INVOKE|down/i.test(`${typeText} ${content}`) ? 'down' : 'up'
}

function openDetail(row: LogRow) {
  selectedLog.value = row
  detailOpen.value = true
}
</script>

<style scoped src="./IotDeviceLogsSearchTableTab.css"></style>
