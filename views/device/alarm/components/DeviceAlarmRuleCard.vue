<template>
  <article class="alarm-rule" :class="{ 'is-selected': selected }">
    <button class="alarm-rule__select" :disabled="!row.id" :aria-pressed="selected" @click="emit('select', row)">
      <span class="alarm-rule__top">
        <strong :title="row.name">{{ row.name }}</strong>
        <span class="alarm-rule__badges">
          <StatusTag :text="stateLabel" :status="activeCount ? 'error' : 'disabled'" />
          <StatusTag :text="levelLabel" :status="levelStatus" />
        </span>
      </span>
      <a-tooltip :title="summary"><span class="alarm-rule__device">{{ summary }}</span></a-tooltip>
    </button>
    <div class="alarm-rule__actions">
      <a-tooltip :title="$t('DeviceAlarm.action.edit')">
        <a-button type="text" size="small" :disabled="busy" :aria-label="$t('DeviceAlarm.action.edit')" @click="emit('edit', row)">
          <AIcon type="FormOutlined" />
        </a-button>
      </a-tooltip>
      <a-popconfirm :title="$t('DeviceAlarm.confirm.delete', { name: row.name })" @confirm="emit('remove', row)">
        <a-tooltip :title="$t('DeviceAlarm.action.delete')">
          <a-button type="text" size="small" danger :disabled="busy" :aria-label="$t('DeviceAlarm.action.delete')">
            <AIcon type="DeleteOutlined" />
          </a-button>
        </a-tooltip>
      </a-popconfirm>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import { ruleSummary } from '../workspaceUtils'
import type { AlarmLevelOption, DeviceAlarmRow } from '../types'

const props = defineProps<{
  row: DeviceAlarmRow
  selected: boolean
  levels: AlarmLevelOption[]
  activeCount?: number
  busy?: boolean
}>()
const emit = defineEmits<{
  (event: 'select' | 'edit' | 'remove', row: DeviceAlarmRow): void
}>()
const { t: $t } = useI18n()
const levelLabel = computed(() => props.levels.find(level => level.value === props.row.level)?.label || String(props.row.level))
const levelStatus = computed(() => props.row.level === 1 ? 'error' : props.row.level <= 3 ? 'warning' : 'info')
const stateLabel = computed(() => props.activeCount === undefined ? $t('DeviceAlarm.workspace.unknown')
  : props.activeCount > 0 ? $t('DeviceAlarm.workspace.warningCount', { count: props.activeCount }) : $t('DeviceAlarm.workspace.normal'))
const summary = computed(() => ruleSummary(props.row, $t))
</script>

<style scoped lang="less">
.alarm-rule {
  position: relative;
  border: 1px solid var(--jet-theme-border);
  margin-bottom: var(--space-2);
  border-radius: var(--jet-theme-radius);
  min-width: 0;
  &:hover { background: var(--jet-theme-primary-soft); }
  &.is-selected { background: var(--jet-theme-primary-soft); border-color: var(--jet-theme-primary-3); }
}
.alarm-rule__select {
  width: 100%; height: 68px; padding: 10px 12px;
  display: flex; flex-direction: column; justify-content: space-between;
  border: 0; border-radius: inherit; background: transparent; text-align: left;
  color: var(--jet-theme-text); cursor: pointer;
  &:focus-visible { outline: 2px solid var(--ant-primary-color); }
}
.alarm-rule__top { display: flex; align-items: center; gap: 8px; width: 100%; height: 22px; }
.alarm-rule__top strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.alarm-rule__badges { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.alarm-rule__badges :deep(.status-tag) { font-size: 11px; padding: 1px 6px; }
.alarm-rule__device { max-width: calc(100% - 64px); height: 24px; line-height: 24px; font-size: 12px; color: var(--jet-theme-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alarm-rule__actions { position: absolute; right: 12px; bottom: 10px; display: flex; gap: 4px; height: 24px; }
.alarm-rule__actions :deep(.ant-btn) { width: 24px; height: 24px; padding: 0; }
</style>
