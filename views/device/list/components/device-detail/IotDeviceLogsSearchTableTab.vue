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
    />

    <JProTable
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

const props = defineProps<{
  device: IotDevice
  logs: IotDeviceLog[]
}>()

const { t: $t } = useI18n()
const logTypeOptions = ref<Array<{ label: string; value: string }>>([])
const filterTerms = ref<ConditionFilterTerm[]>([])
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

function buildQueryTerms() {
  return buildQueryFilter(filterTerms.value, filterFields.value).terms ?? []
}

function mapApiLog(item: any, index: number): LogRow {
  const type = item.type?.value || item.type || ''
  const typeText = item.type?.text || item.type?.label || item.type?.value || item.type || $t('IotDeviceDetail.logs.defaultType')
  const content = item.content ?? item.message ?? ''
  return {
    id: item.id || `${item.timestamp || item.createTime || index}-${type}`,
    type: String(type || typeText),
    typeText: String(typeText),
    direction: inferDirection(typeText, content),
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
    direction: inferDirection(log.title, log.message),
    message: log.message || '--',
    happenedAt: log.happenedAt,
    rawContent: log.message || '',
    raw: log,
  }
}

function inferDirection(typeText = '', content = ''): 'up' | 'down' {
  return /下发|调用|WRITE|INVOKE|down/i.test(`${typeText} ${content}`) ? 'down' : 'up'
}

function openDetail(row: LogRow) {
  selectedLog.value = row
  detailOpen.value = true
}
</script>

<style scoped src="./IotDeviceLogsSearchTableTab.css"></style>
