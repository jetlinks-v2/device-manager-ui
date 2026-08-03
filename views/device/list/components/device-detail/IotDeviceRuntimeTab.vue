<template>
  <section class="runtime-tab" :aria-label="$t('IotDeviceDetail.runtime.aria')">
    <JlDrawerShell
      :open="historyDrawerOpen"
      :width="680"
      icon="HistoryOutlined"
      :title="historyDrawerTitle"
      :sub="historyDrawerSub"
      @update:open="historyDrawerOpen = $event"
    >
      <section v-if="selectedHistoryProperty" class="history-drawer" :aria-label="$t('IotDeviceDetail.runtime.historyAria')">
        <div class="history-summary">
          <div>
            <span>{{ $t('IotDeviceDetail.runtime.identifier') }}</span>
            <strong>{{ selectedHistoryProperty.identifier }}</strong>
          </div>
          <div>
            <span>{{ $t('IotDeviceDetail.runtime.currentValue') }}</span>
            <strong>{{ selectedHistoryProperty.value }}{{ selectedHistoryProperty.unit || '' }}</strong>
          </div>
          <div>
            <span>{{ $t('IotDeviceDetail.runtime.dataType') }}</span>
            <strong>{{ selectedHistoryProperty.dataType }}</strong>
          </div>
        </div>

        <div class="history-table">
          <div class="history-row history-row--head">
            <span>{{ $t('IotDeviceDetail.runtime.reportTime') }}</span>
            <span>{{ $t('IotDeviceDetail.runtime.reportValue') }}</span>
            <span>{{ $t('IotDeviceDetail.runtime.quality') }}</span>
            <span>{{ $t('IotDeviceDetail.runtime.source') }}</span>
          </div>
          <div v-for="row in pagedHistoryRows" :key="row.id" class="history-row">
            <time>{{ row.reportedAt }}</time>
            <strong>{{ row.value }}{{ row.unit || '' }}</strong>
            <em :data-tone="row.tone">{{ row.quality }}</em>
            <span>{{ row.source }}</span>
          </div>
        </div>

        <footer class="history-pagination" :aria-label="$t('IotDeviceDetail.runtime.historyPagination')">
          <a-pagination
            v-model:current="historyPage"
            v-model:page-size="historyPageSize"
            :total="historyRows.length"
            :page-size-options="antHistoryPageSizeOptions"
            :show-total="showHistoryTotal"
            show-size-changer
            size="small"
          />
        </footer>
      </section>

      <template #foot>
        <a-button @click="historyDrawerOpen = false">{{ $t('IotDeviceDetail.common.close') }}</a-button>
      </template>
    </JlDrawerShell>

    <div class="runtime-tip">
      <AIcon type="RadarChartOutlined" aria-hidden="true" />
      <span>{{ $t('IotDeviceDetail.runtime.realtimeSubscribing') }}</span>
      <em>{{ subscribeText }}</em>
    </div>

    <article class="runtime-panel">
      <header class="runtime-head">
        <div>
          <AIcon type="CheckSquareOutlined" aria-hidden="true" />
          <h3>{{ $t('IotDeviceDetail.runtime.properties') }}</h3>
          <span>{{ $t('IotDeviceDetail.runtime.propertyCount', { count: properties.length }) }}</span>
        </div>
        <div class="runtime-toolbar">
          <a-input
            class="runtime-search"
            :value="keyword"
            :placeholder="$t('IotDeviceDetail.runtime.searchPlaceholder')"
            allow-clear
            @update:value="(value) => emit('update:keyword', value)"
          >
            <template #prefix>
              <AIcon type="SearchOutlined" aria-hidden="true" />
            </template>
          </a-input>

          <a-select
            class="runtime-access-select"
            :value="accessFilter"
            :options="accessFilterOptions"
            @change="(value) => emit('update:accessFilter', value as 'all' | RealtimeAccessMode)"
          />
        </div>
      </header>

      <div class="property-table">
        <div class="table-row table-row--head">
          <span>{{ $t('IotDeviceDetail.runtime.propertyName') }}</span>
          <span>{{ $t('IotDeviceDetail.runtime.identifier') }}</span>
          <span>{{ $t('IotDeviceDetail.runtime.currentValue') }}</span>
          <span>{{ $t('IotDeviceDetail.runtime.type') }}</span>
          <span>{{ $t('IotDeviceDetail.runtime.accessMode') }}</span>
          <span>{{ $t('IotDeviceDetail.runtime.updateTime') }}</span>
          <span>{{ $t('IotDeviceDetail.common.action') }}</span>
        </div>
        <div
          v-for="item in filteredProperties"
          :key="item.id"
          class="table-row"
          :data-tone="item.tone"
        >
          <strong>{{ item.name }}</strong>
          <span class="mono">{{ item.identifier }}</span>
          <span class="value">{{ item.value }}{{ item.unit || '' }}</span>
          <span>{{ item.dataType }}</span>
          <span>
            <em :data-access="item.accessMode">{{ accessModeLabel(item.accessMode) }}</em>
          </span>
          <time>{{ item.updatedAt }}</time>
          <span class="row-actions">
            <a-button type="link" size="small" @click="openHistoryDrawer(item)">{{ $t('IotDeviceDetail.runtime.historyData') }}</a-button>
            <a-button type="link" size="small">{{ $t('IotDeviceDetail.runtime.read') }}</a-button>
            <a-button v-if="item.writable" type="link" size="small">{{ $t('IotDeviceDetail.runtime.set') }}</a-button>
          </span>
        </div>
      </div>
    </article>

    <div class="runtime-grid">
      <article class="runtime-panel">
        <header class="runtime-head">
          <div>
            <AIcon type="LineChartOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.runtime.deviceEvents') }}</h3>
          </div>
        </header>
        <div class="compact-table">
          <div class="compact-row compact-row--head">
            <span>{{ $t('IotDeviceDetail.runtime.eventName') }}</span>
            <span>{{ $t('IotDeviceDetail.runtime.level') }}</span>
            <span>{{ $t('IotDeviceDetail.runtime.time') }}</span>
          </div>
          <div v-for="event in events" :key="event.id" class="compact-row">
            <strong>{{ event.name }}</strong>
            <em :data-level="event.level">{{ eventLevelLabel(event.level) }}</em>
            <time>{{ event.time }}</time>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import JlDrawerShell from '../common/JlDrawerShell.vue'
import type {

  RealtimeAccessMode,
  RealtimeEventLevel,
  RealtimeEventRow,
  RealtimePropertyRow,
  RealtimeServiceRow,
} from './iotDeviceDetail.types'

interface HistoryRow {
  id: string
  reportedAt: string
  value: string
  unit?: string
  quality: string
  tone: RealtimePropertyRow['tone']
  source: string
}

defineProps({
  subscribeText: {
    type: String,
    required: true,
  },
  properties: {
    type: Array as PropType<RealtimePropertyRow[]>,
    required: true,
  },
  filteredProperties: {
    type: Array as PropType<RealtimePropertyRow[]>,
    required: true,
  },
  events: {
    type: Array as PropType<RealtimeEventRow[]>,
    required: true,
  },
  services: {
    type: Array as PropType<RealtimeServiceRow[]>,
    required: true,
  },
  keyword: {
    type: String,
    required: true,
  },
  accessFilter: {
    type: String as PropType<'all' | RealtimeAccessMode>,
    required: true,
  },
})

const { t: $t } = useI18n()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:accessFilter': [value: 'all' | RealtimeAccessMode]
}>()

const historyDrawerOpen = ref(false)
const selectedHistoryProperty = ref<RealtimePropertyRow | null>(null)
const historyPage = ref(1)
const historyPageSize = ref(8)
const historyPageSizeOptions = [8, 12, 20] as const
const antHistoryPageSizeOptions = historyPageSizeOptions.map(String)
const accessFilterOptions = [
  { label: $t('IotDeviceDetail.runtime.filter.all'), value: 'all' },
  { label: $t('IotDeviceDetail.runtime.filter.read'), value: 'read' },
  { label: $t('IotDeviceDetail.runtime.filter.readwrite'), value: 'readwrite' },
  { label: $t('IotDeviceDetail.runtime.filter.write'), value: 'write' },
]

const historyRows = computed(() => {
  if (!selectedHistoryProperty.value) return []
  return buildHistoryRows(selectedHistoryProperty.value)
})

const historyTotalPages = computed(() => Math.max(1, Math.ceil(historyRows.value.length / historyPageSize.value)))
const pagedHistoryRows = computed(() => {
  const start = (historyPage.value - 1) * historyPageSize.value
  return historyRows.value.slice(start, start + historyPageSize.value)
})
const historyDrawerTitle = computed(() => selectedHistoryProperty.value ? $t('IotDeviceDetail.runtime.historyTitle', { name: selectedHistoryProperty.value.name }) : $t('IotDeviceDetail.runtime.historyData'))
const historyDrawerSub = computed(() => selectedHistoryProperty.value ? selectedHistoryProperty.value.identifier : '')
watch([historyPageSize, selectedHistoryProperty], () => {
  historyPage.value = 1
})

watch(historyTotalPages, (total) => {
  if (historyPage.value > total) historyPage.value = total
})

function accessModeLabel(mode: RealtimeAccessMode) {
  if (mode === 'readwrite') return 'R/W'
  if (mode === 'write') return 'W'
  if (mode === 'none') return '-'
  return 'R'
}

function showHistoryTotal(total: number, range: [number, number]) {
  return total ? $t('IotDeviceDetail.common.pageTotal', { start: range[0], end: range[1], total }) : $t('IotDeviceDetail.common.zeroItems')
}

function eventLevelLabel(level: RealtimeEventLevel) {
  if (level === 'critical') return $t('IotDeviceDetail.common.level.critical')
  if (level === 'major') return $t('IotDeviceDetail.common.level.major')
  return $t('IotDeviceDetail.common.level.info')
}

function openHistoryDrawer(item: RealtimePropertyRow) {
  selectedHistoryProperty.value = item
  historyPage.value = 1
  historyDrawerOpen.value = true
}

function buildHistoryRows(item: RealtimePropertyRow): HistoryRow[] {
  const numericValue = Number.parseFloat(item.value)
  const isNumeric = !Number.isNaN(numericValue)
  const minuteSteps = [1, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 960, 1200, 1440]

  return minuteSteps.map((minutes, index) => {
    const value = isNumeric
      ? formatNumericHistoryValue(numericValue, index)
      : formatEnumHistoryValue(item.value, index)
    const tone = index < 2 ? item.tone : index % 7 === 0 ? 'warning' : 'normal'
    return {
      id: `${item.id}-history-${index}`,
      reportedAt: formatHistoryTime(minutes),
      value,
      unit: item.unit,
      quality: qualityLabel(tone),
      tone,
      source: index % 3 === 0 ? $t('IotDeviceDetail.runtime.source.deviceReport') : $t('IotDeviceDetail.runtime.source.platformPoll'),
    }
  })
}

function formatNumericHistoryValue(base: number, index: number) {
  const deltaPattern = [0, -1.4, -0.8, 0.6, 1.2, -1.1, 0.4, 1.7]
  const value = base + (deltaPattern[index % deltaPattern.length] ?? 0)
  return Number.isInteger(base) ? String(Math.round(value)) : value.toFixed(1)
}

function formatEnumHistoryValue(value: string, index: number) {
  if (index === 0) return value
  if (/报警|告警|预警/.test(value)) return index % 5 === 0 ? $t('IotDeviceDetail.common.status.normal') : value
  return value
}

function formatHistoryTime(minutes: number) {
  if (minutes < 60) return $t('IotDeviceDetail.common.time.minutesAgo', { count: minutes })
  if (minutes < 1440) return $t('IotDeviceDetail.common.time.hoursAgo', { count: Math.round(minutes / 60) })
  return $t('IotDeviceDetail.common.time.oneDayAgo')
}

function qualityLabel(tone: RealtimePropertyRow['tone']) {
  if (tone === 'critical') return $t('IotDeviceDetail.common.quality.exception')
  if (tone === 'warning') return $t('IotDeviceDetail.common.quality.warning')
  if (tone === 'stale') return $t('IotDeviceDetail.common.quality.stale')
  return $t('IotDeviceDetail.common.quality.normal')
}
</script>

<style scoped>
.runtime-tab {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.runtime-panel,
.runtime-tip {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.runtime-tip {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--jet-theme-primary-soft);
}

.runtime-tip :deep(svg),
.runtime-head :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-primary);
}

.runtime-tip span {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.runtime-tip em,
.runtime-head span,
.table-row,
.compact-row,
.service-list span,
.service-list small {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.runtime-tip em {
  font-style: normal;
}

.runtime-panel {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: 0.875rem;
}

.runtime-head,
.runtime-head > div,
.runtime-toolbar,
.row-actions {
  display: flex;
  align-items: center;
}

.runtime-head {
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.runtime-head > div {
  gap: 0.4375rem;
  min-width: 0;
}

.runtime-head h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.runtime-toolbar {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.runtime-search {
  min-width: 13.75rem;
}

.runtime-search :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-text-disabled);
}

.runtime-access-select {
  min-width: 8.25rem;
}

.property-table,
.compact-table {
  overflow-x: auto;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
}

.table-row {
  display: grid;
  grid-template-columns: minmax(8.125rem, 1fr) minmax(8.75rem, 1fr) minmax(6.875rem, 0.9fr) 4.75rem 4.25rem 6.25rem 9.375rem;
  gap: var(--space-3);
  align-items: center;
  min-width: 58.75rem;
  min-height: 2.625rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.75rem;
}

.table-row--head,
.compact-row--head {
  min-height: 2.25rem;
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-disabled);
  font-weight: 600;
}

.table-row[data-tone='critical'] {
  background: color-mix(in srgb, var(--jet-theme-error) 7%, var(--jet-theme-bg-container));
}

.table-row[data-tone='warning'] {
  background: color-mix(in srgb, var(--jet-theme-warning) 8%, var(--jet-theme-bg-container));
}

.table-row strong,
.service-list strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-row:first-child {
  border-top: 0;
}

.table-row span,
.table-row time {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono,
.table-row time { }

.value {
  color: var(--jet-theme-text); font-weight: 600;
}

.table-row em,
.compact-row em {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  padding: calc(var(--space-1) / 2) var(--space-2);
  font-style: normal;
}

.table-row em[data-access='readwrite'] {
  color: var(--jet-theme-success);
}

.compact-row em[data-level='critical'],
.compact-row em[data-level='major'] {
  color: var(--jet-theme-error);
}

.row-actions {
  gap: var(--space-1);
}

.history-drawer {
  display: grid;
  gap: var(--space-4);
}

.history-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
  background: var(--jet-theme-bg-container);
}

.history-summary div {
  display: grid;
  gap: 0.3125rem;
  min-width: 0;
  border-right: 0.0625rem solid var(--jet-theme-border);
  padding: var(--space-3);
}

.history-summary div:last-child {
  border-right: 0;
}

.history-summary span,
.history-pagination,
.history-pagination label,
.history-pagination select {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.history-summary strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-table {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  overflow: hidden;
}

.history-row {
  display: grid;
  grid-template-columns: 7.5rem minmax(6.25rem, 1fr) 5.25rem 6.875rem;
  gap: var(--space-3);
  align-items: center;
  min-height: 2.5rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.75rem;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.history-row:first-child {
  border-top: 0;
}

.history-row--head {
  min-height: 2.25rem;
  background: var(--jet-theme-primary-soft);
  font-weight: 600;
}

.history-row time,
.history-row strong {
  color: var(--jet-theme-text); }

.history-row strong {
  font-weight: 600;
}

.history-row em {
  justify-self: start;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: 62.4375rem;
  padding: 0.0625rem 0.5rem;
  color: var(--jet-theme-text-disabled);
  font-style: normal;
}

.history-row em[data-tone='normal'] {
  color: var(--jet-theme-success);
}

.history-row em[data-tone='warning'] {
  color: var(--jet-theme-warning);
}

.history-row em[data-tone='critical'] {
  color: var(--jet-theme-error);
}

.history-pagination,
.history-pagination :deep(.ant-pagination) {
  display: flex;
  align-items: center;
}

.history-pagination {
  justify-content: flex-end;
  gap: var(--space-3);
}

.runtime-grid {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.compact-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem 6.25rem;
  gap: var(--space-3);
  align-items: center;
  min-height: 2.375rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding: 0 0.75rem;
}

.compact-row strong {
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-row:first-child {
  border-top: 0;
}

.compact-row time { }

.service-list {
  display: grid;
  gap: var(--space-2);
}

.service-list article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10rem auto;
  gap: var(--space-2);
  align-items: center;
  border-radius: var(--jet-theme-radius-sm);
  padding: 0.625rem;
  background: var(--jet-theme-primary-soft);
}

.service-list article[data-status='disabled'] {
  opacity: 0.62;
}

.service-list div {
  display: grid;
  gap: 0.1875rem;
  min-width: 0;
}

@media (max-width: 68.75rem) {
  .runtime-head {
    align-items: stretch;
    flex-direction: column;
  }

  .runtime-toolbar {
    justify-content: flex-start;
  }

  .runtime-grid,
  .service-list article {
    grid-template-columns: 1fr;
  }

  .history-summary,
  .history-row {
    grid-template-columns: 1fr;
  }

  .history-summary div {
    border-right: 0;
    border-bottom: 0.0625rem solid var(--jet-theme-border);
  }

  .history-summary div:last-child {
    border-bottom: 0;
  }

  .history-row {
    align-items: start;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
  }

  .history-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
}</style>
