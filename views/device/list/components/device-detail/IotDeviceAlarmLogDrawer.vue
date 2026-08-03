<template>
  <a-drawer
    :open="open"
    :width="900"
    :title="$t('DeviceAlarm.record.log')"
    destroy-on-close
    @close="emit('update:open', false)"
  >
    <template #extra>
      <a-space>
        <a-tag :color="stateValue === 'warning' ? 'error' : 'default'">
          {{ enumText(record?.state, '--') }}
        </a-tag>
        <a-button v-if="stateValue === 'warning'" type="link" @click="emit('handle', record)">
          {{ $t('DeviceAlarm.record.handle') }}
        </a-button>
      </a-space>
    </template>

    <a-table
      row-key="id"
      size="small"
      :loading="loading"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
    >
      <template #bodyCell="{ column, record: row }">
        <template v-if="column.key === 'alarmTime'">
          {{ formatApiTime(row.alarmTime) }}
        </template>
        <template v-else-if="column.key === 'sourceName'">
          <div class="alarm-log-source">
            <span>{{ $t('DeviceAlarm.record.sourceDevice') }}</span>
            <j-ellipsis>{{ displayText(row.sourceName) }}</j-ellipsis>
          </div>
        </template>
        <template v-else-if="column.key === 'triggerDesc' || column.key === 'actualDesc'">
          <j-ellipsis>{{ displayText(row[column.dataIndex]) }}</j-ellipsis>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-tooltip :title="$t('DeviceAlarm.record.logDetail')">
            <a-button type="link" size="small" @click="openDetail(row)">
              <template #icon>
                <AIcon type="EyeOutlined" />
              </template>
            </a-button>
          </a-tooltip>
        </template>
      </template>
      <template #emptyText>
        <CloudEmpty :description="$t('DeviceAlarm.record.emptyLog')" />
      </template>
    </a-table>
  </a-drawer>

  <a-modal
    :open="detailOpen"
    :title="$t('DeviceAlarm.record.logDetail')"
    :footer="null"
    :width="920"
    destroy-on-close
    @cancel="detailOpen = false"
  >
    <div v-if="currentLog" class="alarm-log-detail">
      <header class="alarm-log-detail__head">
        <strong>{{ displayText(currentLog.alarmConfigName || currentLog.alarmName) }}</strong>
        <time>{{ formatApiTime(currentLog.alarmTime) }}</time>
      </header>
      <a-descriptions bordered :column="1" size="small">
        <a-descriptions-item :label="$t('DeviceAlarm.record.condition')">
          {{ displayText(currentLog.triggerDesc) }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.reason')">
          {{ displayText(currentLog.actualDesc) }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.sourceDevice')">
          {{ displayText(currentLog.sourceName) }}
        </a-descriptions-item>
        <a-descriptions-item :label="$t('DeviceAlarm.record.alarmInfo')">
          <div class="alarm-log-detail__payload">
            <JsonViewer
              v-if="parsedAlarmInfo.isJson"
              :value="parsedAlarmInfo.value"
              :expanded="true"
              :expand-depth="4"
            />
            <pre v-else>{{ parsedAlarmInfo.value }}</pre>
          </div>
        </a-descriptions-item>
      </a-descriptions>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'
import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'

const props = defineProps<{
  open: boolean
  record?: Record<string, any> | null
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'handle', record?: Record<string, any> | null): void
}>()

const { t: $t } = useI18n()
const loading = ref(false)
const rows = ref<Record<string, any>[]>([])
const detailOpen = ref(false)
const currentLog = ref<Record<string, any> | null>(null)
const stateValue = computed(() => enumValue(props.record?.state))
const columns = computed(() => [
  { title: $t('DeviceAlarm.record.alarmTime'), dataIndex: 'alarmTime', key: 'alarmTime', width: 180 },
  { title: $t('DeviceAlarm.record.condition'), dataIndex: 'triggerDesc', key: 'triggerDesc', ellipsis: true },
  { title: $t('DeviceAlarm.record.sourceDevice'), dataIndex: 'sourceName', key: 'sourceName', width: 220 },
  { title: $t('DeviceAlarm.record.reason'), dataIndex: 'actualDesc', key: 'actualDesc', ellipsis: true },
  { title: $t('DeviceAlarm.column.action'), dataIndex: 'actions', key: 'actions', width: 80 },
])
const parsedAlarmInfo = computed(() => parseAlarmInfo(currentLog.value?.alarmInfo))

watch(
  () => [props.open, props.record?.id] as const,
  ([open]) => {
    if (open) void loadRows()
  },
  { immediate: true },
)

async function loadRows() {
  const recordId = String(props.record?.id ?? '')
  if (!recordId) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.queryAlarmRecordLogs(recordId, {
      pageIndex: 0,
      pageSize: 50,
      sorts: [{ name: 'alarmTime', order: 'desc' }],
    })
    rows.value = extractRows(resp?.result)
  } finally {
    loading.value = false
  }
}

function openDetail(row: Record<string, any>) {
  currentLog.value = row
  detailOpen.value = true
}

function parseAlarmInfo(value: unknown): { isJson: boolean; value: unknown } {
  if (value && typeof value === 'object') return { isJson: true, value }
  const text = displayText(value)
  if (text === '--') return { isJson: false, value: text }
  try {
    return { isJson: true, value: JSON.parse(text) }
  } catch {
    return { isJson: false, value: text }
  }
}

function enumValue(value: unknown) {
  if (value && typeof value === 'object') return String((value as any).value ?? '')
  return String(value ?? '')
}

function enumText(value: unknown, fallback = '--') {
  if (value && typeof value === 'object') return String((value as any).text ?? (value as any).value ?? fallback)
  return String(value || fallback)
}

function displayText(value: unknown) {
  return value === undefined || value === null || value === '' ? '--' : String(value)
}
</script>

<style scoped>
.alarm-log-source {
  display: flex;
  gap: var(--space-1);
  min-width: 0;
}

.alarm-log-source > span {
  flex-shrink: 0;
  color: var(--jet-theme-text-disabled);
}

.alarm-log-detail {
  display: grid;
  gap: var(--space-3);
}

.alarm-log-detail__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
}

.alarm-log-detail__head strong {
  min-width: 0;
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarm-log-detail__head time {
  flex-shrink: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.alarm-log-detail__payload {
  max-height: 28rem;
  overflow: auto;
}

.alarm-log-detail__payload pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
