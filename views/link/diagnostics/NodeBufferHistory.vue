<template>
  <a-button v-if="queues.length" class="buffer-history-entry" type="text" size="small" @click="show"><LineChartOutlined />{{ t('runtimeDiagnostics.bufferHistoryTitle') }}</a-button>
  <a-modal v-model:open="open" :title="t('runtimeDiagnostics.bufferHistoryTitle')" :footer="null" :width="1120" :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }" :body-style="{ height: 'min(760px, calc(100dvh - 144px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }" destroy-on-close>
    <section class="buffer-history-shell">
      <div v-if="queues.length > 1" class="buffer-directory-toggle">
        <a-button ref="directoryTrigger" type="text" size="small" :aria-expanded="directoryOpen" @click="toggleDirectory"><UnorderedListOutlined />{{ t('runtimeDiagnostics.bufferQueueDirectory') }} ({{ queues.length }})<RightOutlined :rotate="directoryOpen ? 90 : 0" /></a-button>
      </div>
      <div class="buffer-history-workspace" :class="{ 'has-directory': queues.length > 1, 'directory-open': directoryOpen }" @keydown.esc="closeDirectory">
        <nav v-if="queues.length > 1" ref="directory" class="buffer-history-directory" :aria-label="t('runtimeDiagnostics.bufferQueueDirectory')">
          <div class="buffer-directory-heading"><strong>{{ t('runtimeDiagnostics.bufferQueueDirectory') }}</strong><span>{{ queues.length }}</span></div>
          <div class="buffer-directory-filters" role="group" :aria-label="t('runtimeDiagnostics.bufferQueueDirectory')">
            <a-button v-for="item in filters" :key="item.value" type="text" size="small" :class="{ 'is-active': filter === item.value }" :aria-pressed="filter === item.value" @click="filter = item.value">{{ item.label }} <span>{{ item.count }}</span></a-button>
          </div>
          <div class="buffer-directory-list">
            <a-button v-for="queue in visibleQueues" :key="queue.objectName" type="text" class="buffer-directory-row" :class="{ 'is-selected': objectName === queue.objectName }" :aria-pressed="objectName === queue.objectName" @click="selectQueue(queue.objectName)">
              <span class="buffer-directory-name" :title="queue.objectName">{{ queue.name }}</span>
              <span class="buffer-directory-rate"><span>{{ t('runtimeDiagnostics.bufferObservation.WrittenRate') }}</span><b>{{ number(queue.rate) }}</b><small>{{ t('runtimeDiagnostics.bufferItemsPerSecond') }}</small></span>
              <span class="buffer-directory-peak"><span>{{ t('runtimeDiagnostics.bufferHistoryTodayPeak') }}</span> {{ number(queue.peak?.value) }} {{ t('runtimeDiagnostics.bufferItemsPerSecond') }}</span>
              <span class="buffer-directory-signals">
                <a-tag v-if="queue.observation && !queue.observation.fresh" color="warning">{{ t('runtimeDiagnostics.bufferSampleStale') }}</a-tag>
                <a-tag v-if="queue.pending !== undefined && queue.pending > 0">{{ t('runtimeDiagnostics.queue.pending') }} {{ number(queue.pending) }} {{ t('runtimeDiagnostics.items') }}</a-tag>
                <a-tag v-if="queue.dead !== undefined && queue.dead > 0" color="error">{{ t('runtimeDiagnostics.bufferRetainedFailures') }} {{ number(queue.dead) }} {{ t('runtimeDiagnostics.items') }}</a-tag>
                <a-tag v-else-if="queue.failed" color="error">{{ t('runtimeDiagnostics.hasFailures') }}</a-tag>
              </span>
            </a-button>
            <a-empty v-if="!visibleQueues.length" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('runtimeDiagnostics.noMatches')" />
          </div>
        </nav>
        <div class="buffer-history-detail">
          <div class="buffer-history-toolbar">
            <strong class="buffer-history-queue" :title="objectName">{{ selected?.name }}</strong>
            <div class="buffer-history-actions" role="group" :aria-label="t('runtimeDiagnostics.bufferHistoryTitle')">
              <template v-if="selected?.observation"><a-button v-for="item in ranges" :key="item.value" :type="range === item.value ? 'link' : 'text'" :aria-pressed="range === item.value" :title="item.label" size="small" @click="range = item.value">{{ item.shortLabel }}</a-button><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.refresh')" :title="t('runtimeDiagnostics.refresh')" :loading="query.state.value.status === 'loading'" @click="load"><ReloadOutlined /></a-button></template>
              <a-button v-if="selected" type="text" size="small" @click="inspect">{{ t('runtimeDiagnostics.bufferInspect') }}</a-button>
              <a-tooltip v-if="selected && resetAccess.allowed" :title="resetAccess.reason"><a-button type="text" size="small" :disabled="!canReset(selected.objectName)" @click="requestReset">{{ t('runtimeDiagnostics.bufferReset') }}</a-button></a-tooltip>
            </div>
          </div>
          <div class="buffer-history-content">
            <p v-if="['loading', 'error', 'forbidden', 'unsupported'].includes(resetState.status)" role="status">{{ resetState.status === 'loading' ? t('runtimeDiagnostics.bufferResetting') : resetState.message || t('runtimeDiagnostics.failed') }}</p>
            <BufferQueueDetail v-if="selected" :buffer="selected" :show-observation="!query.data.value" />
            <p v-if="selected && !selected.observation" class="buffer-legacy-rates">{{ t('runtimeDiagnostics.bufferDetailRates') }}: {{ number(selected.rate) }} / {{ number(selected.attemptedRate) }}</p>
            <a-spin :spinning="query.state.value.status === 'loading'">
              <BufferObservationHistory v-if="query.data.value" :recording="query.data.value" />
              <a-empty v-else :description="selected && !selected.observation ? t('runtimeDiagnostics.bufferHistoryUnavailable') : query.state.value.message || t('runtimeDiagnostics.noMonitoringData')" />
            </a-spin>
          </div>
        </div>
      </div>
    </section>
  </a-modal>
  <a-modal :open="resetOpen" :title="t('runtimeDiagnostics.bufferReset')" :ok-text="t('runtimeDiagnostics.bufferConfirm')" :cancel-text="t('runtimeDiagnostics.bufferCancel')" :confirm-loading="resetState.status === 'loading'" @ok="confirm" @cancel="cancel" @after-close="restoreFocus()"><p>{{ t('runtimeDiagnostics.bufferResetConfirm') }}</p><p class="buffer-reset-identity">{{ resetTarget }}</p></a-modal>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty } from 'ant-design-vue'
import { LineChartOutlined, ReloadOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons-vue'
import { BufferObservationHistory, BufferQueueDetail, type ActionAccess, type BufferHistorySample, type MBeanDescriptor, type ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { useBufferQueueReset } from '@jetlinks-web-core/components/RuntimeDiagnostics/buffer/useBufferQueueReset'
import { useBufferHistory } from './useBufferHistory'
const props = withDefaults(defineProps<{ nodeId: string; scopeKey: string; active: boolean; permitted: boolean; beans: MBeanDescriptor[]; history?: BufferHistorySample[]; resetAccess?: ActionAccess; resetState?: ViewState }>(), { resetAccess: () => ({ allowed: false }), resetState: () => ({ status: 'ready' }) })
const emit = defineEmits<{ (event: 'inspect' | 'reset', objectName: string): void }>()
const { t, locale } = useI18n()
const { open, objectName, range, filter, queues, visibleQueues, selected, query, show, load } = useBufferHistory(props)
const directoryOpen = ref(false), directory = ref<HTMLElement>(), directoryTrigger = ref<{ $el: HTMLElement }>()
// 确认只针对当前可见队列；切换对象、关闭窗口或失去权限即失效。
const { resetOpen, resetTarget, canReset, request, cancel, confirm, restoreFocus } = useBufferQueueReset({ queues: computed(() => selected.value ? [selected.value] : []), active: computed(() => open.value && props.active && props.permitted && !directoryOpen.value), scope: computed(() => JSON.stringify([props.nodeId, props.scopeKey, objectName.value])), access: toRef(props, 'resetAccess'), state: toRef(props, 'resetState') }, target => emit('reset', target))
function requestReset(event: MouseEvent) { if (selected.value) request(selected.value.objectName, event.currentTarget as HTMLElement) }
function inspect() { if (selected.value) { const target = selected.value.objectName; open.value = false; emit('inspect', target) } }
const format = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const number = (value: number | undefined) => value === undefined ? '—' : value > 0 && value < 0.01 ? '<0.01' : format.value.format(value)
const ranges = computed(() => [{ value: 'recent' as const, label: t('runtimeDiagnostics.bufferHistoryRecent'), shortLabel: t('runtimeDiagnostics.bufferHistoryRecentShort') }, { value: 'hour' as const, label: t('runtimeDiagnostics.bufferHistoryHour'), shortLabel: t('runtimeDiagnostics.bufferHistoryHourShort') }])
const filters = computed(() => [
  { value: 'all' as const, label: t('runtimeDiagnostics.all'), count: queues.value.length },
  { value: 'pending' as const, label: t('runtimeDiagnostics.hasPending'), count: queues.value.filter(queue => (queue.pending ?? 0) > 0).length },
  { value: 'failed' as const, label: t('runtimeDiagnostics.hasFailures'), count: queues.value.filter(queue => queue.failed).length },
])
function closeDirectory(event?: KeyboardEvent) {
  if (!directoryOpen.value) return
  event?.stopPropagation()
  directoryOpen.value = false
  void nextTick(() => directoryTrigger.value?.$el.focus())
}
function toggleDirectory() {
  if (directoryOpen.value) { closeDirectory(); return }
  directoryOpen.value = true
  void nextTick(() => (directory.value?.querySelector<HTMLElement>('.buffer-directory-row[aria-pressed="true"]') ?? directory.value?.querySelector<HTMLElement>('button'))?.focus())
}
function selectQueue(name: string) { objectName.value = name; closeDirectory() }
watch([open, () => queues.value.length], ([isOpen, count]) => { if (!isOpen || count <= 1) directoryOpen.value = false }, { flush: 'sync' })
</script>
<style scoped>
.buffer-history-entry { padding-inline:4px; color:var(--ink-2); font-size:var(--fs-caption,12px); }
.buffer-history-shell { container:buffer-history / inline-size; display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; }
.buffer-history-workspace { display:grid; grid-template-columns:minmax(0,1fr); flex:1; min-width:0; min-height:0; }.buffer-history-workspace.has-directory { grid-template-columns:224px minmax(0,1fr); gap:20px; }
.buffer-history-directory,.buffer-history-detail { display:flex; flex-direction:column; min-width:0; min-height:0; }.buffer-history-directory { border-inline-end:1px solid var(--line); padding-inline-end:12px; }
.buffer-directory-heading { display:flex; align-items:center; gap:8px; min-height:30px; font-size:var(--fs-body,14px); }.buffer-directory-heading > span { color:var(--ink-3); font-size:var(--fs-caption,12px); }
.buffer-directory-filters { display:flex; align-items:center; flex-wrap:wrap; gap:2px; margin-bottom:8px; }.buffer-directory-filters :deep(.ant-btn) { padding-inline:5px; font-size:var(--fs-caption,12px); }.buffer-directory-filters span { color:var(--ink-3); }.buffer-directory-filters .is-active { color:var(--primary-color); background:var(--bg-sunken); }
.buffer-directory-list { overflow-y:auto; overscroll-behavior:contain; min-height:0; padding-inline-end:4px; }
.buffer-directory-list :deep(.ant-empty) { grid-column:1 / -1; }
.buffer-directory-row.ant-btn { display:flex; flex-direction:column; gap:4px; width:100%; height:auto; padding:10px 8px; border:0; border-radius:6px; text-align:start; white-space:normal; margin-bottom:2px; font-size:var(--fs-caption,12px); line-height:18px; }
.buffer-directory-row.is-selected { background:var(--bg-sunken); }.buffer-directory-row.is-selected .buffer-directory-name { color:var(--primary-color); }
.buffer-directory-name { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:anywhere; font-weight:500; width:100%; }
.buffer-directory-rate { display:flex; align-items:baseline; gap:5px; width:100%; }.buffer-directory-rate b { margin-inline-start:auto; color:var(--ink-1); font-weight:500; font-variant-numeric:tabular-nums; }
.buffer-directory-rate > span,.buffer-directory-rate small,.buffer-directory-peak { color:var(--ink-3); font-size:var(--fs-caption,12px); }.buffer-directory-peak { width:100%; font-variant-numeric:tabular-nums; }.buffer-directory-peak > span { margin-inline-end:5px; }
.buffer-directory-signals { display:flex; flex-wrap:wrap; gap:4px; }.buffer-directory-signals:empty { display:none; }.buffer-directory-signals :deep(.ant-tag) { margin:0; font-size:var(--fs-caption,12px); line-height:18px; }
.buffer-history-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:4px 12px; padding-bottom:8px; border-bottom:1px solid var(--line); }
.buffer-history-queue { flex:1 1 180px; min-width:0; overflow-wrap:anywhere; font-size:var(--fs-body,14px); font-weight:500; }
.buffer-history-actions { display:flex; align-items:center; gap:2px; margin-inline-start:auto; flex-shrink:0; }.buffer-history-actions :deep(.ant-btn) { padding-inline:6px; font-size:var(--fs-caption,12px); }
.buffer-history-content { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; padding-inline-end:4px; }.buffer-directory-toggle { display:none; }
.buffer-history-content :deep(.buffer-detail) { margin-top:12px; }.buffer-reset-identity { overflow-wrap:anywhere; }
@container buffer-history (max-width:799px) {
  .buffer-directory-toggle { display:flex; flex:none; margin-bottom:8px; }.buffer-directory-toggle :deep(.ant-btn) { padding-inline:0; font-size:var(--fs-caption,12px); }
  .buffer-history-workspace.has-directory { grid-template-columns:minmax(0,1fr); gap:0; }.buffer-history-directory { display:none; border-inline-end:0; padding:0; }
  .has-directory.directory-open .buffer-history-directory { display:flex; }.has-directory.directory-open .buffer-history-detail { display:none; }.buffer-directory-heading { display:none; }
  .buffer-directory-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr)); gap:4px 8px; align-content:start; }
}
</style>
