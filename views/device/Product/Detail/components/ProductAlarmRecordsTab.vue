<template>
  <section class="product-alarm-records">
    <IotDeviceAlarmHandleModal v-model:open="handleOpen" :record="currentRecord" :readonly="handleMode === 'view'" @success="reload" />
    <IotDeviceAlarmLogDrawer v-model:open="logOpen" :record="currentRecord" @handle="openHandle" />
    <ConditionFilter v-model="filterTerms" :fields="filterFields" :common-fields="commonFields" :placeholder="$t('DeviceAlarm.record.searchPlaceholder')" @change="submitSearch" />
    <JProTable
      ref="tableRef"
      row-key="id"
      mode="TABLE"
      :columns="columns"
      :request="queryRecords"
      :params="tableParams"
      :defaultParams="{ sorts: [{ name: 'alarmTime', order: 'desc' }] }"
      :alertShow="false"
      :bodyStyle="{ padding: 0 }"
    >
      <template #alarmTime="record">{{ formatTime(record.alarmTime) }}</template>
      <template #duration="record">{{ formatDuration(record) }}</template>
      <template #alarmName="record"><j-ellipsis>{{ text(record.alarmName) }}</j-ellipsis></template>
      <template #level="record">{{ text(record.level?.text || record.level) }}</template>
      <template #triggerDesc="record"><j-ellipsis>{{ text(record.triggerDesc) }}</j-ellipsis></template>
      <template #actualDesc="record"><j-ellipsis>{{ text(record.actualDesc) }}</j-ellipsis></template>
      <template #handleTime="record">{{ record.handleTime ? formatTime(record.handleTime) : '--' }}</template>
      <template #handleType="record">{{ text(record.handleType?.text || record.handleType) }}</template>
      <template #state="record"><a-tag :color="stateValue(record) === 'normal' ? 'success' : 'error'">{{ stateValue(record) === 'normal' ? $t('DeviceAlarm.record.handled') : $t('DeviceAlarm.record.alarming') }}</a-tag></template>
      <template #actions="record">
        <a-space>
          <j-permission-button
            v-if="stateValue(record) === 'normal'"
            type="link"
            hasPermission="rule-engine/Alarm/Log:view"
            @click="openView(record)"
          >
            {{ $t('DeviceAlarm.record.detail') }}
          </j-permission-button>
          <j-permission-button
            v-else
            type="link"
            hasPermission="rule-engine/Alarm/Log:action"
            @click="openHandle(record)"
          >
            {{ $t('DeviceAlarm.record.handle') }}
          </j-permission-button>
          <j-permission-button type="link" hasPermission="rule-engine/Alarm/Log:view" @click="openLog(record)">{{ $t('DeviceAlarm.record.log') }}</j-permission-button>
        </a-space>
      </template>
      <template #emptyText><CloudEmpty :description="$t('Product.detail.alarmEmpty')" /></template>
    </JProTable>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import ConditionFilter, { buildQueryFilter, type ConditionFilterField, type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { queryByDevice } from '@device-manager-ui/api/rule-engine/log'
import { useProductStore } from '@device-manager-ui/store/product'
import IotDeviceAlarmHandleModal from '@device-manager-ui/views/device/list/components/device-detail/IotDeviceAlarmHandleModal.vue'
import IotDeviceAlarmLogDrawer from '@device-manager-ui/views/device/list/components/device-detail/IotDeviceAlarmLogDrawer.vue'

const { t: $t } = useI18n()
const productStore = useProductStore()
const tableRef = ref()
const filterTerms = ref<ConditionFilterTerm[]>([])
const submittedTerms = ref<ConditionFilterTerm[]>([])
const currentRecord = ref<Record<string, any> | null>(null)
const handleOpen = ref(false)
const logOpen = ref(false)
const handleMode = ref<'handle' | 'view'>('handle')
const commonFields = ['alarmName', 'triggerDesc', 'actualDesc']
const filterFields = computed<ConditionFilterField[]>(() => [
  { title: $t('DeviceAlarm.record.alarmTime'), dataIndex: 'alarmTime', search: { type: 'date' } },
  { title: $t('DeviceAlarm.record.alarmName'), dataIndex: 'alarmName', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  { title: $t('DeviceAlarm.record.condition'), dataIndex: 'triggerDesc', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  { title: $t('DeviceAlarm.record.reason'), dataIndex: 'actualDesc', search: { type: 'string', defaultTermType: 'like', termTypeOptions: ['like', 'eq'] } },
  { title: $t('DeviceAlarm.record.status'), dataIndex: 'state', search: { type: 'select', defaultTermType: 'eq', options: [{ label: $t('DeviceAlarm.record.alarming'), value: 'warning' }, { label: $t('DeviceAlarm.record.handled'), value: 'normal' }] } },
])
const columns = computed(() => [
  { title: $t('DeviceAlarm.record.alarmTime'), dataIndex: 'alarmTime', key: 'alarmTime', scopedSlots: true, width: 180 },
  { title: $t('DeviceAlarm.record.duration'), dataIndex: 'duration', key: 'duration', scopedSlots: true, width: 120 },
  { title: $t('DeviceAlarm.record.alarmName'), dataIndex: 'alarmName', key: 'alarmName', scopedSlots: true, width: 160 },
  { title: $t('DeviceAlarm.record.condition'), dataIndex: 'triggerDesc', key: 'triggerDesc', scopedSlots: true, ellipsis: true },
  { title: $t('DeviceAlarm.record.reason'), dataIndex: 'actualDesc', key: 'actualDesc', scopedSlots: true, ellipsis: true },
  { title: $t('DeviceAlarm.record.handleTime'), dataIndex: 'handleTime', key: 'handleTime', scopedSlots: true, width: 180 },
  { title: $t('DeviceAlarm.record.status'), dataIndex: 'state', key: 'state', scopedSlots: true, width: 100 },
  { title: $t('DeviceAlarm.column.action'), dataIndex: 'actions', key: 'actions', scopedSlots: true, fixed: 'right', width: 130 },
])
const tableParams = computed(() => ({ terms: buildTerms() }))

/**
 * 产品告警由产品下设备的阈值预处理器产生，必须同时锁定设备目标与关联产品。
 * 使用设备告警专用接口，避免通用告警查询将其他目标类型混入结果。
 */
function buildTerms() {
  const filter = buildQueryFilter(submittedTerms.value, filterFields.value)
  const productId = productStore.current?.id
  if (!productId) return []
  return [{ terms: [
    { column: 'sourceId$dev-instance', value: [{ column: 'productId', value: productId, termType: 'eq' }] },
    { column: 'targetType', value: 'device', termType: 'eq' },
  ], type: 'and' }, ...(filter.terms || [])]
}
function queryRecords(params: Record<string, any>) {
  // 产品摘要异步加载前不能发起无范围查询，避免短暂展示全量告警记录。
  if (!productStore.current?.id) return emptyResponse(params)
  return queryByDevice(params)
}
function submitSearch(payload?: { terms?: ConditionFilterTerm[] }) { submittedTerms.value = payload?.terms || filterTerms.value }
function reload() { tableRef.value?.reload?.() }
function openHandle(record: Record<string, any>) { currentRecord.value = record; handleMode.value = 'handle'; handleOpen.value = true }
function openView(record: Record<string, any>) { currentRecord.value = record; handleMode.value = 'view'; handleOpen.value = true }
function openLog(record: Record<string, any>) { currentRecord.value = record; logOpen.value = true }
function stateValue(record: Record<string, any>) { return String(record.state?.value ?? record.state ?? '') }
function text(value: unknown) { return value === undefined || value === null || value === '' ? '--' : String(value) }
function formatTime(value: unknown) { const date = dayjs(value as any); return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : '--' }
function formatDuration(record: Record<string, any>) { const start = dayjs(record.alarmTime); const end = stateValue(record) === 'normal' ? dayjs(record.handleTime) : dayjs(); if (!start.isValid() || !end.isValid()) return '--'; const seconds = Math.max(0, end.diff(start, 'second')); return seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${(seconds / 60).toFixed(1)} min` : `${(seconds / 3600).toFixed(1)} h` }

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

watch(() => productStore.current?.id, () => reload(), { immediate: true })
</script>

<style scoped>
.product-alarm-records { display: grid; gap: 16px; }
</style>
