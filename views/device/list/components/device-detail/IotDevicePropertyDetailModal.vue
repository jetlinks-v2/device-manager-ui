<template>
  <a-modal
    :open="open"
    :title="title"
    :width="920"
    :ok-text="$t('IotDeviceDetail.propertyDetail.okText')"
    :cancel-text="$t('IotDeviceDetail.common.cancel')"
    @update:open="emit('update:open', $event)"
  >
    <section v-if="property" class="property-detail-modal">
      <div class="detail-ranges">
        <a-segmented
          v-model:value="detailRange"
          :options="detailRangeOptions"
          @change="onRangeShortcutChange"
        />
        <a-range-picker
          v-model:value="detailTimeRange"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          @change="onTimeRangeChange"
        />
      </div>
      <a-tabs v-model:active-key="detailMode" class="detail-mode-tabs">
        <a-tab-pane key="list" :tab="$t('IotDeviceDetail.common.tab.list')" />
        <a-tab-pane key="chart" :tab="$t('IotDeviceDetail.common.tab.chart')" />
        <a-tab-pane
          v-if="isGeoPointProperty"
          key="trajectory"
          :tab="$t('IotDeviceDetail.propertyDetail.trajectory')"
        />
      </a-tabs>

      <IotDevicePropertyHistoryDetailModal
        v-model:open="rowDetailOpen"
        :row="selectedDetailRow"
        :property-name="property.name"
        :value-type="property.valueType"
        :data-type="property.dataType"
      />

      <div v-if="detailMode === 'chart'" class="detail-chart" :data-tone="tone">
        <IotDevicePropertyHistoryChart
          :device-id="deviceId"
          :property="property"
          :time-range="detailTimeRange"
        />
      </div>
      <IotDevicePropertyTrajectory
        v-else-if="detailMode === 'trajectory'"
        :device-id="deviceId"
        :property="property"
        :time-range="detailTimeRange"
      />
      <a-spin v-else :spinning="loading">
        <div class="detail-table-filter">
          <a-select
            v-model:value="listFilterField"
            class="detail-filter-field"
            :options="listFilterFieldOptions"
            @change="onListFilterFieldChange"
          />
          <a-select
            v-model:value="listFilterOperator"
            class="detail-filter-operator"
            :options="listFilterOperatorOptions"
          />
          <a-date-picker
            v-if="listFilterField === 'timestamp'"
            v-model:value="listFilterValue"
            class="detail-filter-time"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('IotDeviceDetail.propertyDetail.datePlaceholder')"
          />
          <a-select
            v-else-if="propertyValueOptions.length"
            v-model:value="listFilterValue"
            class="detail-filter-time"
            :options="propertyValueOptions"
            allow-clear
          />
          <a-input-number
            v-else-if="isNumericPropertyValue"
            v-model:value="listFilterValue"
            class="detail-filter-time"
            :placeholder="$t('IotDeviceDetail.propertyDetail.valuePlaceholder')"
          />
          <a-input
            v-else
            v-model:value="listFilterValue"
            class="detail-filter-time"
            :placeholder="$t('IotDeviceDetail.propertyDetail.valuePlaceholder')"
          />
          <a-button class="detail-filter-reset" @click="resetListFilter">{{ $t('IotDeviceDetail.common.reset') }}</a-button>
          <a-button type="primary" @click="searchListRows">{{ $t('IotDeviceDetail.common.search') }}</a-button>
        </div>
        <div class="detail-list">
          <div class="detail-list__row detail-list__row--head">
            <span>{{ $t('IotDeviceDetail.runtime.time') }}</span>
            <span>{{ property.name }}</span>
            <span>{{ $t('IotDeviceDetail.propertyDetail.rawValue') }}</span>
            <span>{{ $t('IotDeviceDetail.common.action') }}</span>
          </div>
          <div v-for="row in detailRows" :key="row.id" class="detail-list__row">
            <time>{{ row.time }}</time>
            <IotDevicePropertyValuePreview
              :value="row.value"
              :value-type="property.valueType"
              :data-type="property.dataType"
              :name="property.name"
              :thumbnail-size="40"
            />
            <IotDevicePropertyValuePreview
              :value="row.rawValue"
              :value-type="property.valueType"
              :data-type="property.dataType"
              :name="property.name"
              raw
            />
            <a-tooltip :title="$t('IotDeviceDetail.propertyDetail.viewDetail')">
              <a-button
                type="text"
                size="small"
                class="detail-list__action"
                :aria-label="$t('IotDeviceDetail.propertyDetail.viewDetail')"
                @click="openRowDetail(row)"
              >
                <template #icon><AIcon type="SearchOutlined" aria-hidden="true" /></template>
              </a-button>
            </a-tooltip>
          </div>
          <CloudEmpty v-if="!loading && !detailRows.length" class="detail-list__empty" :description="$t('IotDeviceDetail.propertyDetail.noHistory')" />
        </div>
        <footer class="detail-list-footer">
          <a-pagination
            v-model:current="pageCurrent"
            v-model:page-size="pageSize"
            :total="pageTotal"
            :page-size-options="pageSizeOptions"
            show-size-changer
            show-less-items
            size="small"
            @change="onPageChange"
            @show-size-change="onPageChange"
          />
        </footer>
      </a-spin>
    </section>
  </a-modal>
</template>

<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { formatPropertyValueWithUnit, isStructuredPropertyType } from './iotDevicePropertyDisplay'
import IotDevicePropertyHistoryDetailModal from './IotDevicePropertyHistoryDetailModal.vue'
import IotDevicePropertyHistoryChart from './IotDevicePropertyHistoryChart.vue'
import IotDevicePropertyTrajectory from './IotDevicePropertyTrajectory.vue'
import IotDevicePropertyValuePreview from './IotDevicePropertyValuePreview.vue'
import { useIotDevicePropertyHistoryFilter } from './useIotDevicePropertyHistoryFilter'

const props = defineProps<{
  open: boolean
  deviceId: string
  property: RealtimePropertyRow | null
  tone: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t: $t } = useI18n()

type DetailRange = 'today' | 'week' | 'month' | ''

interface DetailRow {
  id: string
  time: string
  reportedAt: string
  value: unknown
  rawValue: unknown
  raw?: any
}

const detailMode = ref<'list' | 'chart' | 'trajectory'>('list')
const detailRange = ref<DetailRange>('today')
const detailTimeRange = ref<[Dayjs, Dayjs]>(getShortcutRange('today'))
const detailRows = ref<DetailRow[]>([])
const loading = ref(false)
const pageCurrent = ref(1)
const pageSize = ref(8)
const pageTotal = ref(0)
const pageSizeOptions = ['8', '12', '24', '48']
const rowDetailOpen = ref(false)
const selectedDetailRow = ref<DetailRow | null>(null)
let requestTicket = 0

const title = computed(() => props.property ? $t('IotDeviceDetail.propertyDetail.titleWithName', { name: props.property.name }) : $t('IotDeviceDetail.dataTable.detail'))
const detailRangeOptions = computed(() => [
  { label: $t('IotDeviceDetail.timeFilter.today'), value: 'today' },
  { label: $t('IotDeviceDetail.timeFilter.week'), value: 'week' },
  { label: $t('IotDeviceDetail.timeFilter.month'), value: 'month' },
])
const {
  listFilterField,
  listFilterOperator,
  listFilterValue,
  listFilterFieldOptions,
  listFilterOperatorOptions,
  isNumericPropertyValue,
  propertyValueOptions,
  buildListTerms,
  onListFilterFieldChange,
  resetListFilter: resetHistoryFilter,
} = useIotDevicePropertyHistoryFilter(computed(() => props.property), detailTimeRange)

function getShortcutRange(type: Exclude<DetailRange, ''>): [Dayjs, Dayjs] {
  const end = dayjs()
  if (type === 'today') return [dayjs().startOf('day'), end]
  if (type === 'week') return [dayjs().subtract(6, 'days'), end]
  return [dayjs().subtract(30, 'days'), end]
}

function onRangeShortcutChange(value: string | number) {
  const next = String(value) as Exclude<DetailRange, ''>
  detailTimeRange.value = getShortcutRange(next)
  pageCurrent.value = 1
}

function onTimeRangeChange(value: [Dayjs, Dayjs] | null) {
  detailTimeRange.value = value ?? getShortcutRange('today')
  detailRange.value = ''
  pageCurrent.value = 1
}

async function loadRows() {
  if (!props.open || detailMode.value !== 'list' || !props.deviceId || !props.property?.identifier) return
  // 翻页和筛选会并发触发请求，用序号避免旧响应覆盖当前表格。
  const currentTicket = ++requestTicket
  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryPropertyData(props.deviceId, props.property.identifier, {
      pageSize: pageSize.value,
      pageIndex: pageCurrent.value - 1,
      sorts: [{ name: 'timestamp', order: 'desc' }],
      terms: buildListTerms(),
    })
    if (currentTicket !== requestTicket) return
    pageTotal.value = Number(resp?.result?.total ?? resp?.result?.totalElements ?? resp?.result?.totalCount ?? 0)
    detailRows.value = extractRows(resp?.result).map((row: any, index) => mapDetailRow(row, index))
  } finally {
    if (currentTicket === requestTicket) {
      loading.value = false
    }
  }
}

function mapDetailRow(row: any, index: number): DetailRow {
  const valueSource = row?.value && typeof row.value === 'object' ? row.value : row
  const value = getDetailValue(row, valueSource)
  const rawValue = row?.originValue ?? row?.numberValue ?? valueSource?.value ?? row?.value ?? '--'
  const timestamp = row?.timestamp ?? valueSource?.timestamp ?? row?.createTime ?? row?.time
  return {
    id: `${props.property?.identifier || 'property'}-${row?.id ?? timestamp ?? index}`,
    time: formatApiTime(timestamp, '--'),
    reportedAt: formatApiTime(timestamp, '--'),
    value: isComplexProperty.value
      ? value ?? '--'
      : formatPropertyValueWithUnit(value, props.property?.unit),
    rawValue: rawValue === undefined || rawValue === null ? '--' : rawValue,
    raw: row,
  }
}

const isComplexProperty = computed(() => (
  isStructuredPropertyType(props.property?.valueType, props.property?.dataType)
  || props.property?.valueType?.type === 'file'
  || props.property?.dataType === 'file'
))

const isGeoPointProperty = computed(() => (
  props.property?.valueType?.type === 'geoPoint' || props.property?.dataType === 'geoPoint'
))

function getDetailValue(row: Record<string, unknown>, valueSource: Record<string, unknown>) {
  const candidates = [
    valueSource?.formatValue,
    valueSource?.value,
    row?.formatValue,
    row?.numberValue,
    row?.value,
  ]
  if (!isComplexProperty.value) return candidates.find((item) => item !== undefined) ?? '--'

  return candidates.find((item) => {
    if (item && typeof item === 'object') return true
    if (typeof item !== 'string') return false
    return item !== '[object Object]' && item !== '[object Array]'
  }) ?? '--'
}

function resetListFilter() {
  resetHistoryFilter()
  pageCurrent.value = 1
  void loadRows()
}

function searchListRows() {
  pageCurrent.value = 1
  void loadRows()
}

function onPageChange(page: number, size: number) {
  pageCurrent.value = page
  pageSize.value = size
  void loadRows()
}

function openRowDetail(row: DetailRow) {
  selectedDetailRow.value = row
  rowDetailOpen.value = true
}

watch(
  () => [props.open, props.deviceId, props.property?.identifier, detailMode.value, detailTimeRange.value?.[0]?.valueOf(), detailTimeRange.value?.[1]?.valueOf()],
  (_next, prev) => {
    const propertyChanged = prev?.[2] !== props.property?.identifier
    if (propertyChanged) {
      detailRows.value = []
      pageTotal.value = 0
      resetHistoryFilter()
      if (!isGeoPointProperty.value && detailMode.value === 'trajectory') {
        detailMode.value = 'list'
      }
    }
    pageCurrent.value = 1
    void loadRows()
  },
  { immediate: true },
)
</script>

<style scoped src="./IotDeviceDataTableTab.css"></style>
