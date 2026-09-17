<template>
  <CardBox class="alarm-record-card" :value="row" :status="stateKey" :status-text="stateText"
           :status-names="STATUS_NAMES" :background-opacity="100">
    <template #content>
      <div class="alarm-record-head">
        <j-ellipsis class="alarm-record-name"><strong>{{ row.alarmName || row.alarmConfigName || '—' }}</strong></j-ellipsis>
        <StatusTag class="alarm-record-level" :text="levelLabel" :status="levelStatus" />
      </div>
      <dl class="alarm-record-fields">
        <div v-for="field in fields" :key="field.label">
          <dt>{{ field.label }}</dt>
          <dd><j-ellipsis>{{ field.value }}</j-ellipsis></dd>
        </div>
      </dl>
    </template>
    <template #bottom-tool>
      <div class="alarm-record-actions">
        <div class="alarm-record-actions__links">
          <a-button type="text" @click="emit('history', row, 'logs')">
            <template #icon><AIcon type="FileTextOutlined" /></template>
            {{ $t('DeviceAlarm.workspace.logs') }}
          </a-button>
          <a-button type="text" @click="emit('history', row, 'handles')">
            <template #icon><AIcon type="HistoryOutlined" /></template>
            {{ $t('DeviceAlarm.workspace.handles') }}
          </a-button>
        </div>
        <a-button type="primary" :disabled="!canHandleRecord(row)" @click="emit('handle', row)">
          {{ $t('DeviceAlarm.workspace.handle') }}
        </a-button>
      </div>
    </template>
  </CardBox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CardBox from '@jetlinks-web-core/components/CardBox/index.vue'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import { formatApiTime } from '../../list/services/iotDeviceDetailReal.service'
import { enumText, enumValue } from '../utils'
import { alarmDuration, canHandleRecord } from '../workspaceUtils'
import type { AlarmLevelOption } from '../types'
import type { DeviceAlarmEvent, HistoryTab } from '../workspaceTypes'

const props = defineProps<{ row: DeviceAlarmEvent; levels: AlarmLevelOption[]; now: number }>()
const emit = defineEmits<{
  (event: 'handle', record: DeviceAlarmEvent): void
  (event: 'history', record: DeviceAlarmEvent, tab: HistoryTab): void
}>()
const { t: $t } = useI18n()

// 只有 warning 需要红色状态位，其余状态由 BadgeStatus / getHexColor 回退为灰色。
const STATUS_NAMES: Record<string, string> = { warning: 'error' }
// 服务端未返回枚举字典时，裸状态值回退到本地文案；来自字典的 text 优先。
const STATE_LABELS: Record<string, string> = {
  warning: 'DeviceAlarm.workspace.warning',
  normal: 'DeviceAlarm.workspace.normal',
}

const stateKey = computed(() => enumValue(props.row.state))
const stateText = computed(() => {
  const dictText = enumText(props.row.state)
  if (dictText && dictText !== stateKey.value) return dictText
  return $t(STATE_LABELS[stateKey.value] || 'DeviceAlarm.workspace.unknown')
})
const levelLabel = computed(() => props.levels.find(level => level.value === props.row.level)?.label || String(props.row.level ?? '—'))
const levelStatus = computed(() => props.row.level === 1 ? 'error' : (props.row.level || 4) <= 3 ? 'warning' : 'info')
// 字段顺序与截图一致：设备/时间在上，原因/时长在下；快照字段缺失时显示占位符。
const fields = computed(() => [
  { label: $t('DeviceAlarm.workspace.alarmDevice'), value: props.row.sourceName || props.row.targetName || '—' },
  { label: $t('DeviceAlarm.workspace.lastAlarmTime'), value: formatApiTime(props.row.lastAlarmTime || props.row.alarmTime) },
  { label: $t('DeviceAlarm.record.reason'), value: props.row.actualDesc || '—' },
  { label: $t('DeviceAlarm.workspace.duration'), value: alarmDuration(props.row, props.now) },
])
</script>

<style scoped lang="less">
// 复用 CardBox 内置的顶部状态色条与右上斜角状态位，只调内容与底栏。
.alarm-record-card {
  --panel-padding: 1.25rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
}
// 双列网格里卡片等高，底栏贴底而不是紧跟内容；记录卡不可点击，去掉 CardBox 的可点光标。
.alarm-record-card :deep(.card-warp) { flex: 1; cursor: default; }
.alarm-record-card :deep(.card-item-avatar) { display: none; }
.alarm-record-card :deep(.card-content-main) { min-height: 0; align-items: flex-start; }
.alarm-record-card :deep(.card-content) { padding-bottom: var(--space-4); }
// 状态位文案跟随状态色，与截图中的红色“告警中”一致。
.alarm-record-card :deep(.card-state) { color: var(--card-status-color-solid); }
.alarm-record-card :deep(.card-state .ant-badge-status-text) { font-size: var(--fs-14); font-weight: 600; }
.alarm-record-head { display: flex; align-items: center; gap: var(--space-2); min-width: 0; margin-bottom: var(--space-4); }
.alarm-record-name { min-width: 0; color: var(--ink-1); font-size: var(--fs-18); }
.alarm-record-level { flex-shrink: 0; }
.alarm-record-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); margin: 0; }
.alarm-record-fields > div { display: grid; min-width: 0; gap: var(--space-1); }
.alarm-record-fields dt { color: var(--jet-theme-text-secondary); font-size: var(--fs-14); font-weight: normal; }
.alarm-record-fields dd { min-width: 0; margin: 0; color: var(--ink-1); font-size: var(--fs-16); }
.alarm-record-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--panel-padding);
  border-top: 1px solid var(--jet-theme-border-color-1);
}
.alarm-record-actions__links { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
.alarm-record-actions :deep(.ant-btn) { height: 2.5rem; font-size: var(--fs-14); }
.alarm-record-actions__links :deep(.ant-btn) { padding-inline: var(--space-2); color: var(--jet-theme-text-secondary); }
.alarm-record-actions > :deep(.ant-btn-primary) { flex-shrink: 0; padding-inline: var(--space-5); }
@media (max-width: 600px) {
  .alarm-record-actions { flex-wrap: wrap; }
  .alarm-record-actions > :deep(.ant-btn-primary) { flex: 1 0 100%; }
}
</style>
