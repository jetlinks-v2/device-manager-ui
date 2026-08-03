<template>
  <section class="logs-tab" :aria-label="$t('IotDeviceDetail.logs.aria')">
    <a-modal
      v-model:open="detailOpen"
      :title="$t('IotDeviceDetail.logs.detailTitle')"
      :footer="null"
      :width="700"
    >
      <a-textarea
        class="logs-detail"
        :value="detailContent"
        :rows="15"
        readonly
        :bordered="false"
      />
    </a-modal>

    <div class="filter-bar logs-filter">
      <a-input
        v-model:value="keyword"
        class="logs-search"
        :placeholder="$t('IotDeviceDetail.logs.searchPlaceholder')"
        allow-clear >
        <template #prefix>
          <AIcon type="SearchOutlined" aria-hidden="true" />
        </template>
      </a-input>

      <a-select
        v-model:value="typeFilter"
        :aria-label="$t('IotDeviceDetail.logs.filterType')"
        :options="typeFilterOptions"
      />
      <span class="logs-total">{{ $t('IotDeviceDetail.logs.filteredTotal', { filtered: filteredRows.length, total: rows.length }) }}</span>
    </div>

    <div v-if="pagedRows.length" class="logs-table">
      <div class="logs-row logs-row--head">
        <span>{{ $t('IotDeviceDetail.logs.column.type') }}</span>
        <span>{{ $t('IotDeviceDetail.logs.column.time') }}</span>
        <span>{{ $t('IotDeviceDetail.logs.column.content') }}</span>
        <span>{{ $t('IotDeviceDetail.common.action') }}</span>
      </div>
      <div v-for="row in pagedRows" :key="row.id" class="logs-row">
        <span class="logs-type">{{ row.typeText }}</span>
        <time>{{ row.happenedAt }}</time>
        <p>{{ row.message }}</p>
        <span>
          <a-tooltip :title="$t('IotDeviceDetail.logs.viewDetail')">
            <a-button type="link" size="small" class="logs-action" @click="openDetail(row)">
              <template #icon>
                <AIcon type="SearchOutlined" aria-hidden="true" />
              </template>
            </a-button>
          </a-tooltip>
        </span>
      </div>
    </div>

    <CloudEmpty v-else class="empty-state logs-empty">
      <template #description>
        <strong class="empty-state__title">{{ rows.length ? $t('IotDeviceDetail.logs.emptyNoMatch') : $t('IotDeviceDetail.logs.emptyNoLogs') }}</strong>
        <span v-if="rows.length">{{ $t('IotDeviceDetail.logs.emptyAdjustFilter') }}</span>
      </template>
    </CloudEmpty>

    <footer v-if="filteredRows.length" class="logs-pagination" :aria-label="$t('IotDeviceDetail.logs.pagination')">
      <a-pagination
        v-model:current="currentPage"
        v-model:page-size="pageSize"
        :total="filteredRows.length"
        :page-size-options="antPageSizeOptions"
        :show-total="showPaginationTotal"
        show-size-changer
        show-quick-jumper
      />
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice, IotDeviceLog } from '../../types'

interface LogRow {
  id: string
  type: string
  typeText: string
  message: string
  happenedAt: string
  rawContent: string
  raw: any
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
  logs: {
    type: Array as PropType<IotDeviceLog[]>,
    required: true,
  },
})

const { t: $t } = useI18n()
const apiLogs = ref<LogRow[]>([])
const keyword = ref('')
const typeFilter = ref('all')
const logTypeOptions = ref<Array<{ label: string; value: string }>>([])
const currentPage = ref(1)
const pageSize = ref(10)
const detailOpen = ref(false)
const detailContent = ref('')
const pageSizeOptions = [5, 10, 20] as const
const antPageSizeOptions = pageSizeOptions.map(String)

const rows = computed<LogRow[]>(() => apiLogs.value.length ? apiLogs.value : props.logs.map(mapFallbackLog))
const typeFilterOptions = computed(() => [
  { label: $t('IotDeviceDetail.logs.allTypes'), value: 'all' },
  ...logTypeOptions.value,
])

async function loadLogs() {
  if (!props.device.id) return
  const resp: any = await iotDeviceDetailRealApi.queryLog(props.device.id, {
    pageIndex: 0,
    pageSize: 200,
    sorts: [{ name: 'timestamp', order: 'desc' }],
  })
  apiLogs.value = extractRows(resp?.result).map(mapApiLog)
}

async function loadLogTypes() {
  const resp: any = await iotDeviceDetailRealApi.queryLogsType()
  logTypeOptions.value = extractRows(resp?.result).map((item: any) => ({
    label: item.text || item.label || item.value,
    value: String(item.value),
  })).filter((item) => item.label && item.value)
}

const filteredRows = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (typeFilter.value !== 'all' && row.type !== typeFilter.value) return false
    if (!q) return true
    return [row.typeText, row.message, row.happenedAt].join(' ').toLowerCase().includes(q)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value)))

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

watch([keyword, typeFilter, pageSize], () => {
  currentPage.value = 1
})

watch(
  () => props.device.id,
  () => {
    apiLogs.value = []
    void loadLogs()
    void loadLogTypes()
  },
  { immediate: true },
)

watch(totalPages, (nextTotalPages) => {
  if (currentPage.value > nextTotalPages) currentPage.value = nextTotalPages
})

function showPaginationTotal(total: number, range: [number, number]) {
  return $t('IotDeviceDetail.logs.paginationTotal', { start: range[0], end: range[1], total })
}

function mapApiLog(item: any, index: number): LogRow {
  const type = item.type?.value || item.type || ''
  const typeText = item.type?.text || item.type?.label || item.type?.value || item.type || $t('IotDeviceDetail.logs.defaultType')
  const content = item.content ?? item.message ?? ''
  return {
    id: item.id || `${item.timestamp || item.createTime || index}-${type}`,
    type: String(type || typeText),
    typeText: String(typeText),
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
    message: log.message || '--',
    happenedAt: log.happenedAt,
    rawContent: log.message || '',
    raw: log,
  }
}

function openDetail(row: LogRow) {
  detailContent.value = formatDetailContent(row.rawContent || row.message || row.raw)
  detailOpen.value = true
}

function formatDetailContent(value: unknown) {
  if (typeof value !== 'string') return JSON.stringify(value, null, 2)
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
</script>

<style scoped>
.logs-tab {
  display: grid;
  gap: var(--space-4);
}

.logs-pagination {
  display: flex;
  align-items: center;
}

.logs-filter {
  display: grid;
  grid-template-columns: minmax(15rem, 1fr) 11.25rem auto;
  gap: var(--space-2);
  align-items: center;
}

.logs-search {
  min-width: 0;
}

.logs-search :deep(svg) {
  color: var(--jet-theme-text-disabled);
}

.logs-total {
  color: var(--jet-theme-text-disabled);

  font-size: var(--fs-14);
  white-space: nowrap;
}

.logs-table {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
}

.logs-row {
  display: grid;
  grid-template-columns: 6.5rem 5.25rem 6.5rem minmax(8.75rem, 0.8fr) minmax(11.25rem, 1.2fr);
  gap: var(--space-3);
  align-items: center;
  min-height: 2.875rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.75rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.logs-row:first-child {
  border-top: 0;
}

.logs-row--head {
  min-height: 2.25rem;
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-secondary);
  font-weight: 600;
}

.logs-row time,
.logs-type {
  color: var(--jet-theme-text);
}

.logs-row time { }

.logs-row p {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logs-row p {
  margin: 0;
}

.logs-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  padding: 0.125rem 0.5rem;
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-disabled);
  font-style: normal;
  font-weight: 600;
}

.logs-action {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 1.75rem !important;
  height: 1.75rem !important;
  padding: 0 !important;
}

.logs-action :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}

.logs-detail {

  font-size: var(--fs-14);
  line-height: 1.7;
}

.logs-empty {
  margin-top: 0.125rem;
}

.logs-pagination {
  justify-content: flex-end;
  gap: var(--space-3);
}

@media (max-width: 53.75rem) {
  .logs-filter {
    grid-template-columns: 1fr;
  }

  .logs-table {
    overflow-x: auto;
  }

  .logs-row {
    min-width: 47.5rem;
  }

  .logs-pagination {
    justify-content: flex-start;
  }
}</style>
