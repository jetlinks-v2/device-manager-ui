<template>
  <div class="trend-controls">
    <div class="trend-controls__metric">
      <a-segmented class="trend-controls__switch" :value="view.activeMetric" :options="view.metricOptions" size="small" :disabled="view.disabled" @change="view.selectMetric" />
      <a-tooltip v-if="view.metricScope" :title="view.metricScope.tooltip">
        <span class="trend-controls__scope"><AIcon type="InfoCircleOutlined" /> {{ view.metricScope.label }}</span>
      </a-tooltip>
    </div>
    <div class="trend-controls__time">
      <a-popover :open="open" trigger="click" placement="bottomRight" @open-change="setOpen">
        <template #content>
          <div class="trend-time-panel" @keydown.esc.stop="setOpen(false)">
            <a-segmented class="trend-controls__switch trend-time-panel__shortcuts" :value="view.shortcut ?? ''" :options="shortcuts" :disabled="view.disabled" @change="selectShortcut" />
            <div class="trend-time-panel__label">{{ t('components.MonitorTrend.customRange') }}</div>
            <a-range-picker :value="draft" :disabled="view.disabled" :allow-clear="true"
              :show-time="{ format: 'HH:mm:ss' }" format="YYYY-MM-DD HH:mm:ss"
              :placeholder="[t('components.MonitorTrend.startTime'), t('components.MonitorTrend.endTime')]"
              :get-popup-container="rangeContainer" popup-class-name="system-monitor-range-dropdown" @change="setDraft">
              <template #suffixIcon><AIcon type="CalendarOutlined" /></template>
            </a-range-picker>
            <p v-if="error" class="trend-time-panel__error" role="alert">{{ error }}</p>
            <div class="trend-time-panel__actions">
              <a-button size="small" @click="setOpen(false)">{{ t('components.MonitorTrend.cancel') }}</a-button>
              <a-button type="primary" size="small" :disabled="view.disabled" @click="apply">{{ t('components.MonitorTrend.apply') }}</a-button>
            </div>
          </div>
        </template>
        <a-button class="trend-controls__range" type="text" size="small" :disabled="view.disabled"
          :aria-label="t('components.MonitorTrend.rangeFor', [view.title])" :aria-expanded="open" aria-haspopup="dialog" @keydown.esc="setOpen(false)">
          <AIcon type="CalendarOutlined" /> {{ label }}
        </a-button>
      </a-popover>
      <a-tooltip :title="t('components.MonitorRefresh.button')">
        <a-button type="text" :loading="view.loading" :disabled="view.disabled"
          :aria-label="t('components.MonitorTrend.refreshFor', [view.title])" @click="view.refresh">
          <template #icon><AIcon type="ReloadOutlined" /></template>
        </a-button>
      </a-tooltip>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TrendView } from '../types'
import { useTrendTimeControls } from '../hooks/useTrendTimeControls'
const props = defineProps({ view: { type: Object as PropType<TrendView>, required: true } })
const { t } = useI18n()
const { open, draft, error, shortcuts, label, setOpen, setDraft, selectShortcut, apply } = useTrendTimeControls(() => props.view)
// 日期选择面板挂在当前浮层内，选择日期不会被外层 Popover 当作外部点击。
const rangeContainer = (trigger: HTMLElement) => trigger.closest<HTMLElement>('.trend-time-panel') ?? trigger.parentElement!
</script>
<style scoped>
.trend-controls { display: flex; flex: 1 1 auto; align-items: center; flex-wrap: wrap; gap: var(--space-2, 8px); min-width: 0; }
.trend-controls__metric { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2, 8px); min-width: 0; }
.trend-controls__switch.ant-segmented { max-width: 100%; overflow-x: auto; padding: 2px; border-radius: 4px; background: var(--bg-2, #f2f3f5); color: var(--ink-2, #4e5969); font-size: 12px; }
.trend-controls__switch :deep(.ant-segmented-group) { gap: 2px; }
.trend-controls__switch :deep(.ant-segmented-item) { border-radius: 3px; transition: color .2s; }
.trend-controls__switch :deep(.ant-segmented-item-label) { min-height: 22px; padding: 2px 8px; line-height: 18px; font-size: 12px; font-weight: 400; }
.trend-controls__switch :deep(.ant-segmented-item-selected), .trend-controls__switch :deep(.ant-segmented-thumb) { border-radius: 3px; background: var(--bg, #fff); color: var(--primary-color, #165dff); font-weight: 500; box-shadow: 0 1px 2px rgb(0 0 0 / 8%); }
.trend-controls__switch :deep(.ant-segmented-item:has(input:focus-visible)) { outline: 2px solid var(--primary-color, #1677ff); outline-offset: -1px; }
.trend-controls__scope { color: var(--ink-3, #86909c); font-size: 12px; white-space: nowrap; cursor: help; }
.trend-controls__time { display: flex; align-items: center; gap: 4px; margin-left: auto; flex: none; }
.trend-controls__range { background: var(--primary-1, #eef5ff); color: var(--primary-color, #1677ff); border-radius: 4px; font-size: 12px; }
.trend-time-panel { position: relative; width: min(360px, calc(100vw - 64px)); color: var(--ink-1, #1d2129); }
.trend-time-panel__shortcuts { width: 100%; }
.trend-time-panel__shortcuts :deep(.ant-segmented-group) { display: flex; }
.trend-time-panel__shortcuts :deep(.ant-segmented-item) { flex: 1; text-align: center; }
.trend-time-panel__label { margin: 12px 0 8px; color: var(--ink-3, #86909c); font-size: 12px; }
.trend-time-panel :deep(.ant-picker-range) { width: 100%; }
.trend-time-panel__error { color: var(--danger-color, #ff4d4f); font-size: 12px; margin: 8px 0 0; }
.trend-time-panel__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
<style>
@media (max-width: 640px) {
  .system-monitor-range-dropdown .ant-picker-panel-container { max-width: calc(100vw - 32px); max-height: calc(100vh - 80px); overflow: auto; }
  .system-monitor-range-dropdown .ant-picker-datetime-panel { flex-direction: column; }
  .system-monitor-range-dropdown .ant-picker-time-panel { border-left: 0; border-top: 1px solid var(--line, #f0f0f0); }
  .system-monitor-range-dropdown .ant-picker-time-panel-column { height: 144px; }
  .system-monitor-range-dropdown .ant-picker-panels { flex-wrap: wrap; }
}
</style>
