<template>
  <section class="alarm-history">
    <a-tabs :active-key="state.tab" @change="key => emit('tab', key as HistoryTab)">
      <a-tab-pane key="logs" :tab="$t('DeviceAlarm.workspace.logs')" />
      <a-tab-pane key="handles" :tab="$t('DeviceAlarm.workspace.handles')" />
      <template #rightExtra>
        <a-range-picker show-time size="small" :value="range || undefined" @change="onRangeChange" />
      </template>
    </a-tabs>
    <a-alert v-if="state.error" type="error" show-icon :message="$t('DeviceAlarm.workspace.historyError')">
      <template #action><a-button size="small" @click="emit('retry')">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template>
    </a-alert>
    <a-table v-else row-key="id" size="small" :loading="state.loading" :columns="columns"
      :data-source="state.rows" :pagination="pagination" :scroll="{ x: 640 }"
      @change="page => emit('page', (page.current || 1) - 1, page.pageSize || 10)">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">{{ formatApiTime(state.tab === 'logs' ? record.alarmTime : record.handleTime) }}</template>
        <template v-else-if="column.key === 'type'">{{ enumText(record.handleType, '—') }}</template>
        <template v-else-if="column.key === 'description'">{{ record.description || record.describe || '—' }}</template>
        <template v-else-if="column.key === 'action'">
          <a-tooltip :title="$t('DeviceAlarm.record.detail')">
            <a-button type="link" size="small" :aria-label="$t('DeviceAlarm.record.detail')" @click="openDetail(record.id)">
              <AIcon type="EyeOutlined" />
            </a-button>
          </a-tooltip>
        </template>
      </template>
      <template #emptyText><CloudEmpty :description="$t('DeviceAlarm.workspace.historyEmpty')" /></template>
    </a-table>
    <a-modal :open="Boolean(current)" :width="600" :footer="null" :title="$t('DeviceAlarm.record.detail')" @cancel="current = undefined">
      <a-descriptions v-if="current" bordered :column="1" size="small">
        <a-descriptions-item :label="$t('DeviceAlarm.form.name')">{{ current.alarmConfigName || current.alarmName || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.alarmTime')">{{ formatApiTime(current.alarmTime) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.sourceDevice')">{{ current.sourceName || current.targetName || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.condition')">{{ current.triggerDesc || '—' }}</a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.reason')">{{ current.actualDesc || '—' }}</a-descriptions-item>
        <template v-if="state.tab === 'handles'">
          <a-descriptions-item :label="$t('DeviceAlarm.workspace.handleTime')">{{ formatApiTime(current.handleTime) }}</a-descriptions-item>
          <a-descriptions-item :label="$t('DeviceAlarm.workspace.handler')">{{ current.creatorName || '—' }}</a-descriptions-item>
          <a-descriptions-item :label="$t('DeviceAlarm.record.handleDescription')">{{ current.description || current.describe || '—' }}</a-descriptions-item>
        </template>
      </a-descriptions>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs, { type Dayjs } from 'dayjs'
import { useI18n } from 'vue-i18n'
import { formatApiTime } from '../../list/services/iotDeviceDetailReal.service'
import { enumText } from '../utils'
import type { AlarmHistoryState, DeviceAlarmEvent, HistoryTab } from '../workspaceTypes'
const props = defineProps<{ state: AlarmHistoryState; range: [Dayjs, Dayjs] | null; ruleKey: string }>()
const emit = defineEmits<{
  (event: 'tab', value: HistoryTab): void
  (event: 'range', value: [Dayjs, Dayjs] | null): void
  (event: 'page', pageIndex: number, pageSize: number): void
  (event: 'retry'): void
}>()
const { t: $t } = useI18n()
const current = ref<DeviceAlarmEvent>()
function openDetail(id: string) { current.value = props.state.rows.find(row => row.id === id) }
function onRangeChange(value: [Dayjs, Dayjs] | [string, string] | null) {
  emit('range', value ? [dayjs(value[0]), dayjs(value[1])] : null)
}
// 切换规则或页签时关闭旧快照，防止详情弹窗残留上一规则的记录。
watch(() => [props.ruleKey, props.state.tab], () => { current.value = undefined })
const columns = computed(() => props.state.tab === 'logs' ? [
  { title: $t('DeviceAlarm.record.alarmTime'), dataIndex: 'alarmTime', key: 'time', width: 168 },
  { title: $t('DeviceAlarm.record.sourceDevice'), dataIndex: 'sourceName', key: 'sourceName', ellipsis: true },
  { title: $t('DeviceAlarm.record.reason'), dataIndex: 'actualDesc', key: 'actualDesc', ellipsis: true },
  { title: $t('DeviceAlarm.column.action'), key: 'action', width: 60 },
] : [
  { title: $t('DeviceAlarm.workspace.handleTime'), dataIndex: 'handleTime', key: 'time', width: 168 },
  { title: $t('DeviceAlarm.workspace.handleType'), dataIndex: 'handleType', key: 'type', width: 110 },
  { title: $t('DeviceAlarm.workspace.handler'), dataIndex: 'creatorName', key: 'creatorName', width: 100 },
  { title: $t('DeviceAlarm.record.handleDescription'), dataIndex: 'description', key: 'description', ellipsis: true },
  { title: $t('DeviceAlarm.column.action'), key: 'action', width: 60 },
])
const pagination = computed(() => ({ current: props.state.pageIndex + 1, pageSize: props.state.pageSize,
  total: props.state.total, showSizeChanger: true, size: 'small' as const }))
</script>

<style scoped>
.alarm-history { padding: 0 var(--space-4) var(--space-4); min-width: 0; }
@media (max-width: 1100px) { .alarm-history :deep(.ant-tabs-extra-content) { max-width: 220px; } }
</style>
