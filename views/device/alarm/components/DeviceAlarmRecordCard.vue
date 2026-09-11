<template>
  <EntityCard class="alarm-record-card" :interactive="false">
    <template #icon><img class="alarm-record-icon" :src="deviceIcon" alt="" /></template>
    <template #title><span class="alarm-record-name"><j-ellipsis>{{ row.alarmName || row.alarmConfigName || '—' }}</j-ellipsis></span></template>
    <template #badges><StatusTag :text="levelLabel" :status="row.level === 1 ? 'error' : (row.level || 4) <= 3 ? 'warning' : 'info'" /></template>
    <template #action><StatusTag class="alarm-record-corner" :status="warning ? 'error' : 'disabled'"><span class="alarm-status-dot" aria-hidden="true" />{{ enumText(row.state, $t('DeviceAlarm.workspace.unknown')) }}</StatusTag></template>
    <template #body>
      <dl class="alarm-record-fields">
        <div><dt>{{ $t('DeviceAlarm.workspace.alarmDevice') }}</dt><dd><j-ellipsis>{{ row.sourceName || row.targetName || '—' }}</j-ellipsis></dd></div>
        <div><dt>{{ $t('DeviceAlarm.record.reason') }}</dt><dd><j-ellipsis>{{ row.actualDesc || '—' }}</j-ellipsis></dd></div>
        <div><dt>{{ $t('DeviceAlarm.record.alarmTime') }}</dt><dd>{{ formatApiTime(row.lastAlarmTime || row.alarmTime) }}</dd></div>
        <div><dt>{{ $t('DeviceAlarm.workspace.duration') }}</dt><dd>{{ alarmDuration(row, now) }}</dd></div>
      </dl>
    </template>
    <template #footer>
      <div class="alarm-record-actions">
        <a-button type="text" :disabled="!canHandleRecord(row)" @click="emit('handle', row)"><AIcon type="ToolOutlined" />{{ $t('DeviceAlarm.workspace.handle') }}</a-button>
        <a-button type="text" @click="emit('history', row, 'logs')"><AIcon type="FileTextOutlined" />{{ $t('DeviceAlarm.workspace.logs') }}</a-button>
        <a-button type="text" @click="emit('history', row, 'handles')"><AIcon type="HistoryOutlined" />{{ $t('DeviceAlarm.workspace.handles') }}</a-button>
      </div>
    </template>
  </EntityCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import deviceIcon from '../../../../assets/device/device-card.png'
import { useI18n } from 'vue-i18n'
import EntityCard from '@jetlinks-web-core/components/EntityCard/index.vue'
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
const warning = computed(() => enumValue(props.row.state) === 'warning')
const levelLabel = computed(() => props.levels.find(level => level.value === props.row.level)?.label || String(props.row.level ?? '—'))
</script>

<style scoped lang="less">
.alarm-record-card { position: relative; height: 100%; min-width: 0; padding: var(--space-5, 20px); border: 1px solid var(--jet-theme-border); border-radius: var(--jet-theme-radius-lg); background: var(--jet-theme-bg-container); box-shadow: none; }
.alarm-record-card :deep(.ec-top) { align-items: center; gap: 14px; padding-top: 10px; padding-right: 0; padding-bottom: var(--space-4); }
.alarm-record-card :deep(.ec-title) { flex-wrap: nowrap; font-size: 15px; gap: var(--space-2); }
.alarm-record-name { min-width: 0; }
.alarm-record-card :deep(.ec-badges) { flex-shrink: 0; }
.alarm-record-card :deep(.ec-action) { position: absolute; top: 0; right: 0; }
.alarm-record-corner { border: 0; border-radius: 0; padding: 7px 12px 7px 24px; clip-path: polygon(0 0, 100% 0, 100% 100%, 18px 100%); font-size: 13px; gap: 7px; }
.alarm-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.alarm-record-card :deep(.ec-body) { border: 0; padding: 0 0 var(--space-5, 20px) 58px; }
.alarm-record-card :deep(.ec-footer) { margin: 0 calc(-1 * var(--space-5, 20px)) calc(-1 * var(--space-5, 20px)); padding: 0; background: var(--jet-theme-bg-layout); }
.alarm-record-icon { width: 44px; height: 44px; object-fit: contain; }
.alarm-record-fields { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 12px; margin: 0; font-size: 13px; }
.alarm-record-fields > div { display: contents; }
.alarm-record-fields dt { color: var(--jet-theme-text-secondary); font-weight: normal; }
.alarm-record-fields dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.alarm-record-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
.alarm-record-actions :deep(.ant-btn) { border-radius: 0; height: 38px; color: var(--jet-theme-primary); font-size: 13px; }
.alarm-record-actions :deep(.ant-btn[disabled]) { color: var(--jet-theme-text-disabled); }
.alarm-record-actions :deep(.ant-btn + .ant-btn) { border-left: 1px solid var(--jet-theme-border); }
@media (max-width: 600px) {
  .alarm-record-card { padding: var(--space-4); }
  .alarm-record-card :deep(.ec-top) { padding-right: 0; gap: 10px; }
  .alarm-record-card :deep(.ec-body) { padding-left: 0; }
  .alarm-record-card :deep(.ec-footer) { margin: 0 calc(-1 * var(--space-4)) calc(-1 * var(--space-4)); }
  .alarm-record-actions :deep(.ant-btn) { padding-inline: 4px; font-size: 12px; }
}
</style>
