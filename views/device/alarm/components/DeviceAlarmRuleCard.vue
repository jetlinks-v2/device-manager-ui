<template>
  <article class="alarm-rule" :class="{ 'is-selected': selected }">
    <button class="alarm-rule__select" type="button" :disabled="!row.id" :aria-pressed="selected" @click="emit('select', row)">
      <span class="alarm-rule__icon" aria-hidden="true">
        <!-- 告警灯图标沿用截图造型：无对应 Ant Design / iconfont 字形，固定内联 SVG 避免额外图标依赖。 -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 19v-7a4 4 0 0 1 8 0v7" />
          <path d="M6.2 21h11.6" />
          <path d="M12 3.6v2.1" />
          <path d="M6.4 6.2l1.4 1.4" />
          <path d="M17.6 6.2l-1.4 1.4" />
          <path d="M3.4 12.4h2.2" />
          <path d="M18.4 12.4h2.2" />
        </svg>
      </span>
      <span class="alarm-rule__content">
        <strong class="alarm-rule__name" :title="row.name">{{ row.name }}</strong>
        <a-tooltip :title="summary"><span class="alarm-rule__summary">{{ summary }}</span></a-tooltip>
        <span class="alarm-rule__badges">
          <StatusTag :text="stateLabel" :status="activeCount ? 'error' : 'disabled'" />
          <StatusTag :text="levelLabel" :status="levelStatus" />
        </span>
      </span>
    </button>
    <a-dropdown :trigger="['click']" placement="bottomRight" :disabled="busy">
      <a-button class="alarm-rule__more" type="text" size="small" :disabled="busy"
                :aria-label="$t('DeviceAlarm.action.more', { name: row.name })" @click.stop>
        <AIcon type="MoreOutlined" />
      </a-button>
      <template #overlay>
        <a-menu>
          <a-menu-item key="edit" @click="emit('edit', row)">
            <AIcon type="FormOutlined" aria-hidden="true" />
            {{ $t('DeviceAlarm.action.edit') }}
          </a-menu-item>
          <a-menu-item key="remove" danger @click="emit('remove', row)">
            <AIcon type="DeleteOutlined" aria-hidden="true" />
            {{ $t('DeviceAlarm.action.delete') }}
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
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
  min-width: 0;
  margin-bottom: 0.875rem;
  border: 1px solid var(--jet-theme-border-color-1);
  border-radius: var(--r-1);
  background: var(--jet-theme-bg-container);
  transition: border-color 0.2s ease, background-color 0.2s ease;
  &:hover { border-color: var(--jet-theme-primary-3); }
  &.is-selected { border-color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
}
.alarm-rule__select {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  width: 100%;
  padding: 0.875rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--jet-theme-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  &:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; }
  &:disabled { cursor: default; }
}
.alarm-rule__icon {
  display: grid;
  place-items: center;
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #63a8ff 0%, #1f6feb 100%);
  box-shadow: 0 0.125rem 0.375rem rgb(31 111 235 / 30%);
  svg { width: 1.25rem; height: 1.25rem; }
}
.alarm-rule__content { display: grid; min-width: 0; gap: var(--space-1); }
.alarm-rule__name {
  overflow: hidden;
  padding-right: 1.25rem;
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alarm-rule__summary {
  display: block;
  overflow: hidden;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-12);
  line-height: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alarm-rule__badges { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-1); }
// 嵌套一层提高特异性，确保紧凑尺寸覆盖 StatusTag 自身的 .status-tag[data-v-*] 规则。
.alarm-rule .alarm-rule__badges :deep(.status-tag) { min-height: 1.25rem; padding: 0 var(--space-2); font-size: var(--fs-12); }
.alarm-rule__more {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 1;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  color: var(--jet-theme-text-secondary);
}
</style>
