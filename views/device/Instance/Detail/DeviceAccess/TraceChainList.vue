<template>
  <div class="trace-chain-list">
    <div class="trace-chain-layout">
      <TraceDebugPanel class="trace-chain-layout__debug" @trace-match="onTraceMatch" />
      <div class="trace-chain-layout__main">
    <div class="trace-hint">
      <p class="trace-hint__text">
        <InfoCircleOutlined class="trace-hint__icon" aria-hidden="true" />
        {{ $t('InstanceDeviceAccess.952800-20') }}
      </p>
      <span class="trace-hint__count" aria-live="polite">
        {{ $t('InstanceDeviceAccess.traceHintCount', { n: receivedTotal }) }}
      </span>
    </div>
    <div class="list-wrap">
      <div
        v-if="rows.length"
        ref="listRef"
        class="trace-list-body"
        @scroll.passive="onListScroll"
      >
        <div
          class="trace-list-virtual"
          :style="{ height: `${totalVirtualHeight}px` }"
        >
          <div
            class="trace-list-virtual__window"
            :style="{ transform: `translate3d(0, ${virtualOffsetY}px, 0)` }"
          >
            <button
              v-for="row in visibleRows"
              :key="row.traceKey"
              v-memo="[
                row.traceKey,
                row.lastTime,
                row.flowKind,
                row.payloadPreview,
                row.firstOpLabel,
                row.messageTypeRaw,
                row.lastLogPreview,
                row.hasError,
                row.spanChainText,
                selectedKey === row.traceKey,
              ]"
              type="button"
              class="trace-item"
              :data-trace-key="row.traceKey"
              :class="[
                { 'trace-item--selected': selectedKey === row.traceKey },
                { 'trace-item--matched': matchedFlashKey === row.traceKey },
                `trace-item--flow-${row.flowKind}`,
              ]"
              @click="openDetail(row.traceKey)"
            >
              <div class="trace-item__flow-line">
                <span
                  class="flow-dir"
                  :class="{
                    'flow-dir--up': row.flowKind === 'uplink',
                    'flow-dir--down': row.flowKind === 'downlink',
                    'flow-dir--unknown': row.flowKind === 'unknown',
                  }"
                  :aria-label="flowAriaLabel(row)"
                >
                  <ArrowUpOutlined v-if="row.flowKind === 'uplink'" aria-hidden="true" />
                  <ArrowDownOutlined v-else-if="row.flowKind === 'downlink'" aria-hidden="true" />
                  <BranchesOutlined v-else aria-hidden="true" />
                </span>
                <span class="trace-item__chain" :title="listPrimaryLine(row)">
                  {{ listPrimaryLine(row) }}
                </span>
              </div>
              <div class="trace-item__payload-line">
                <span class="trace-item__plabel">{{
                  row.payloadPreview?.trim()
                    ? $t('InstanceDeviceAccess.traceListRaw')
                    : $t('InstanceDeviceAccess.traceListDesc')
                }}</span>
                <span
                  class="trace-item__pval"
                  :class="{ 'trace-item__pval--hint': !row.payloadPreview?.trim() }"
                  :title="fullPayloadTitle(row)"
                >{{ payloadOrHintLine(row) }}</span>
                <template v-if="row.lastLogPreview">
                  <span class="trace-item__psep">|</span>
                  <a-tag
                    :color="lastLogLevelTagColor(row)"
                    class="trace-item__log-tag"
                  >
                    {{ lastLogLevelLabel(row) }}
                  </a-tag>
                  <span class="trace-item__pval trace-item__pval--log" :title="row.lastLogPreview">{{
                    row.lastLogPreview
                  }}</span>
                </template>
              </div>
              <div class="trace-item__meta">
                <a-tag :color="row.hasError ? 'error' : 'success'" class="meta-tag">
                  {{ row.hasError ? $t('InstanceDeviceAccess.952800-22') : $t('InstanceDeviceAccess.952800-21') }}
                </a-tag>
                <span class="meta-time">
                  <ClockCircleOutlined class="meta-time__icon" aria-hidden="true" />
                  {{ formatTime(row.lastTime) }}
                </span>
                <a-button type="link" size="small" class="meta-action" @click.stop="openDetail(row.traceKey)">
                  {{ $t('InstanceDeviceAccess.952800-24') }}
                  <RightOutlined class="meta-action__arrow" aria-hidden="true" />
                </a-button>
              </div>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="trace-empty">
        <j-empty>
          <template #description>{{ $t('InstanceDeviceAccess.952800-5') }}</template>
        </j-empty>
      </div>
    </div>
      </div>
    </div>

    <TraceChainDetailDrawer
      v-model:open="detailOpen"
      :group="detailGroup"
    />
  </div>
</template>

<script lang="ts" setup>
import type { TraceGroup } from './composables/useDeviceTraceLog'
import { createTraceOperationLabel } from './traceOperationLabels'
import { antTagColorForLogLevel } from './traceLogLevel'
import {
  buildTraceRows,
  cloneTraceGroup,
  findGroupByKey,
  pickRawPayloadDetail,
  sortedEvents,
  type TraceListRow,
} from './traceListUtils'
import TraceChainDetailDrawer from './TraceChainDetailDrawer.vue'
import TraceDebugPanel from './TraceDebugPanel.vue'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

const props = defineProps<{
  traceGroups: TraceGroup[]
  deviceId?: string
  /** 由父级 useTraceReceivedTotal 提供的累加条数（与 Tab 角标一致） */
  receivedTotal: number
}>()

const detailOpen = ref(false)
const detailGroup = ref<TraceGroup | null>(null)
const selectedKey = ref<string | null>(null)
const selectedTraceId = ref<string | null>(null)
const pendingTraceIds = ref<string[]>([])
const matchedFlashKey = ref<string | null>(null)
const listRef = ref<HTMLElement | null>(null)
const listViewportHeight = ref(0)
const listScrollTop = ref(0)
const rowHeight = ref(64)
let matchedFlashTimer: ReturnType<typeof setTimeout> | null = null
let listResizeObserver: ResizeObserver | null = null

const TRACE_ROW_GAP = 6
const TRACE_ROW_BUFFER = 8

onBeforeUnmount(() => {
  if (matchedFlashTimer) clearTimeout(matchedFlashTimer)
  matchedFlashTimer = null
  listResizeObserver?.disconnect()
  listResizeObserver = null
})

const labelOp = createTraceOperationLabel($t)

const rows = computed(() => buildTraceRows(props.traceGroups, labelOp))
const traceGroupsToken = computed(() =>
  props.traceGroups.map((group) => `${group.key}:${group.version ?? 0}`).join('|'),
)
const itemFullHeight = computed(() => rowHeight.value + TRACE_ROW_GAP)
const visibleCount = computed(() => {
  const viewport = listViewportHeight.value || itemFullHeight.value * 10
  return Math.max(12, Math.ceil(viewport / itemFullHeight.value) + TRACE_ROW_BUFFER * 2)
})
const visibleStartIndex = computed(() =>
  Math.max(0, Math.floor(listScrollTop.value / itemFullHeight.value) - TRACE_ROW_BUFFER),
)
const visibleEndIndex = computed(() =>
  Math.min(rows.value.length, visibleStartIndex.value + visibleCount.value),
)
const visibleRows = computed(() => rows.value.slice(visibleStartIndex.value, visibleEndIndex.value))
const virtualOffsetY = computed(() => visibleStartIndex.value * itemFullHeight.value)
const totalVirtualHeight = computed(() =>
  rows.value.length ? rows.value.length * itemFullHeight.value - TRACE_ROW_GAP : 0,
)

function syncListViewport() {
  listViewportHeight.value = listRef.value?.clientHeight || 0
}

function onListScroll(event: Event) {
  listScrollTop.value = (event.target as HTMLElement | null)?.scrollTop || 0
}

function measureTraceItemHeight() {
  const height = listRef.value?.querySelector<HTMLElement>('.trace-item')?.offsetHeight || 0
  if (height > 0 && Math.abs(height - rowHeight.value) > 1) {
    rowHeight.value = height
  }
}

function scheduleListMeasure() {
  void nextTick(() => {
    syncListViewport()
    measureTraceItemHeight()
  })
}

function bindListResizeObserver() {
  listResizeObserver?.disconnect()
  listResizeObserver = null
  if (typeof ResizeObserver === 'undefined' || !listRef.value) return
  listResizeObserver = new ResizeObserver(() => {
    syncListViewport()
    measureTraceItemHeight()
  })
  listResizeObserver.observe(listRef.value)
}

function scrollTraceRowIntoView(traceKey: string, behavior: ScrollBehavior = 'smooth') {
  const index = rows.value.findIndex((row) => row.traceKey === traceKey)
  if (index < 0 || !listRef.value) return
  const viewport = listViewportHeight.value || listRef.value.clientHeight
  const top = index * itemFullHeight.value
  const bottom = top + itemFullHeight.value
  const viewTop = listRef.value.scrollTop
  const viewBottom = viewTop + viewport
  if (top >= viewTop && bottom <= viewBottom) return
  const nextTop = top < viewTop ? Math.max(0, top - TRACE_ROW_GAP) : Math.max(0, bottom - viewport)
  listRef.value.scrollTo({ top: nextTop, behavior })
}

function updateDetailGroup(group: TraceGroup | null) {
  detailGroup.value = group ? cloneTraceGroup(group) : null
}

/** 消息类型展示名（与 InstanceDeviceAccess.msgType.* 对齐） */
const messageTypeLabel = (row: TraceListRow): string => {
  if (!row.messageTypeRaw) return ''
  const key = `InstanceDeviceAccess.msgType.${row.messageTypeRaw}`
  const tr = $t(key)
  return tr !== key ? tr : row.messageTypeRaw
}

/**
 * 首行：链路步骤 + messageType（如 decode → 身份识别 · 上线）
 * 无步骤链时仅用消息类型兜底
 */
const listPrimaryLine = (row: TraceListRow): string => {
  const chain = row.spanChainText?.trim()
  const hasChain = chain && chain !== '—'
  const mt = messageTypeLabel(row)
  if (hasChain && mt) return `${chain} · ${mt}`
  if (hasChain) return chain as string
  if (mt) return mt
  return '—'
}

/** 第二行：有原始报文则展示报文；否则展示「首条操作 · 消息类型」说明 */
const payloadOrHintLine = (row: TraceListRow): string => {
  const p = row.payloadPreview?.trim()
  if (p) return p
  const mt = messageTypeLabel(row)
  const first = row.firstOpLabel && row.firstOpLabel !== '—' ? row.firstOpLabel : ''
  if (first && mt) return `${first} · ${mt}`
  if (mt) return mt
  if (first) return first
  if (row.lastOpLabel && row.lastOpLabel !== '—') return row.lastOpLabel
  return '—'
}

const flowAriaLabel = (row: TraceListRow): string => {
  if (row.flowKind === 'uplink') return $t('InstanceDeviceAccess.flowUplink')
  if (row.flowKind === 'downlink') return $t('InstanceDeviceAccess.flowDownlink')
  return $t('InstanceDeviceAccess.flowUnknown')
}

const lastLogLevelLabel = (row: TraceListRow): string => {
  return row.lastLogLevel || $t('InstanceDeviceAccess.952800-10')
}

const lastLogLevelTagColor = (row: TraceListRow): string => {
  return row.lastLogLevel ? antTagColorForLogLevel(row.lastLogLevel) : 'default'
}

const formatTime = (t: number) => {
  if (!t) return '—'
  return dayjs(t).format('HH:mm:ss')
}

/** title：有报文时展示完整原始内容；无报文时与「说明」行一致 */
const fullPayloadTitle = (row: TraceListRow) => {
  if (row.payloadPreview?.trim()) {
    const g = findGroupByKey(props.traceGroups, row.traceKey)
    if (!g) return row.payloadPreview
    const nonLog = sortedEvents(g).filter((e) => e.type !== 'log')
    const raw = pickRawPayloadDetail(nonLog, row.flowKind)
    return raw ? String(raw) : row.payloadPreview
  }
  return payloadOrHintLine(row)
}

const openDetail = (traceKey: string) => {
  selectedKey.value = traceKey
  const g = findGroupByKey(props.traceGroups, traceKey) || null
  if (!g) return
  updateDetailGroup(g)
  selectedTraceId.value = normalizeTraceId(g.traceId) || null
  detailOpen.value = true
}

function flashMatched(traceKey: string) {
  matchedFlashKey.value = traceKey
  if (matchedFlashTimer) clearTimeout(matchedFlashTimer)
  matchedFlashTimer = setTimeout(() => {
    if (matchedFlashKey.value === traceKey) {
      matchedFlashKey.value = null
    }
  }, 1800)
}

async function focusMatchedGroup(group: TraceGroup, byTraceId?: string) {
  selectedKey.value = group.key
  updateDetailGroup(group)
  selectedTraceId.value = normalizeTraceId(byTraceId || group.traceId) || null
  detailOpen.value = true
  flashMatched(group.key)
  await nextTick()
  scrollTraceRowIntoView(group.key)
}

function normalizeTraceId(v: string | undefined): string {
  if (!v) return ''
  const text = String(v).trim()
  if (!text || text === '_no_trace_') return ''
  return text.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
}

function findGroupByTraceId(traceId: string): TraceGroup | null {
  const normalized = normalizeTraceId(traceId)
  if (!normalized) return null
  const found = props.traceGroups.find((g) => {
    if (normalizeTraceId(g.traceId) === normalized) return true
    const extra = g.traceIds || []
    return extra.some((id) => normalizeTraceId(id) === normalized)
  })
  return found || null
}

function onTraceMatch(traceId: string) {
  const g = findGroupByTraceId(traceId)
  if (!g) {
    const normalized = normalizeTraceId(traceId)
    if (!normalized) return
    if (!pendingTraceIds.value.includes(normalized)) {
      pendingTraceIds.value.push(normalized)
    }
    return
  }
  const normalized = normalizeTraceId(traceId)
  if (normalized) {
    pendingTraceIds.value = pendingTraceIds.value.filter((id) => id !== normalized)
  }
  focusMatchedGroup(g, normalized || undefined)
}

watch(detailOpen, (v) => {
  if (!v) {
    selectedKey.value = null
    selectedTraceId.value = null
    detailGroup.value = null
  }
})

watch(
  traceGroupsToken,
  () => {
    if (!rows.value.length) {
      listScrollTop.value = 0
    }
    scheduleListMeasure()
    if (pendingTraceIds.value.length) {
      let matchedGroup: TraceGroup | null = null
      const remain: string[] = []
      for (const tid of pendingTraceIds.value) {
        const g = findGroupByTraceId(tid)
        if (g && !matchedGroup) {
          matchedGroup = g
          continue
        }
        if (!g) remain.push(tid)
      }
      pendingTraceIds.value = remain
      if (matchedGroup) {
        focusMatchedGroup(matchedGroup)
      }
    }
    if (!props.traceGroups.length && detailOpen.value) {
      detailOpen.value = false
      return
    }
    if (detailOpen.value && selectedKey.value) {
      const byKey = findGroupByKey(props.traceGroups, selectedKey.value) || null
      if (byKey) {
        updateDetailGroup(byKey)
      } else if (selectedTraceId.value) {
        // 分组合并后 key 可能变化，按 traceId 重新定位当前选中链路
        const relocated = findGroupByTraceId(selectedTraceId.value)
        if (relocated) {
          selectedKey.value = relocated.key
          updateDetailGroup(relocated)
          flashMatched(relocated.key)
          void nextTick(() => scrollTraceRowIntoView(relocated.key, 'auto'))
        }
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.deviceId,
  () => {
    listScrollTop.value = 0
    if (!detailOpen.value) {
      detailGroup.value = null
      selectedKey.value = null
      selectedTraceId.value = null
      return
    }
    detailOpen.value = false
  },
)

watch(
  () => rows.value.length,
  () => {
    if (!rows.value.length && listRef.value) {
      listRef.value.scrollTop = 0
    }
    scheduleListMeasure()
  },
  { flush: 'post' },
)

watch(listRef, () => {
  bindListResizeObserver()
  scheduleListMeasure()
})

onMounted(() => {
  syncListViewport()
  bindListResizeObserver()
  scheduleListMeasure()
})
</script>

<style lang="less" scoped>
.trace-chain-layout {
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
  min-height: 0;
  min-width: 0;
}

.trace-chain-layout__debug {
  flex: 0 0 288px;
  flex-shrink: 0;
  width: 288px;
  max-width: min(288px, 100%);
  min-width: 0;
  align-self: stretch;
}

.trace-chain-layout__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

@media (max-width: 992px) {
  .trace-chain-layout {
    flex-direction: column;
  }

  .trace-chain-layout__debug {
    flex: 0 0 auto;
    width: 100%;
    max-width: none;
  }
}

.trace-chain-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  --trace-up: #1677ff;
  --trace-up-soft: rgba(22, 119, 255, 0.1);
  --trace-down: #08979c;
  --trace-down-soft: rgba(8, 151, 156, 0.11);
  --trace-text: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  --trace-text-secondary: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.55));
  --trace-text-tertiary: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.38));
  --trace-font-sans: var(--ant-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif);
  --trace-font-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.trace-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  flex-shrink: 0;
  margin: 0 0 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  color: var(--trace-text-secondary);
  font-family: var(--trace-font-sans);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.01em;
  line-height: 1.55;
}

.trace-hint__text {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
  min-width: 0;
  margin: 0;
}

.trace-hint__count {
  flex-shrink: 0;
  color: var(--trace-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.trace-hint__icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 14px;
  color: rgba(22, 119, 255, 0.75);
}

.list-wrap {
  flex: 1;
  min-height: 200px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trace-list-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding-right: 2px;
}

.trace-list-virtual {
  position: relative;
  min-height: 100%;
}

.trace-list-virtual__window {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  will-change: transform;
}

.trace-item {
  display: grid;
  /* 第一列不用 fr 跟整行变宽，否则链路省略后左侧仍会占满比例宽度，报文看起来像被挤到最右 */
  grid-template-columns: minmax(120px, min(38%, 280px)) minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px 10px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 5px 8px;
  text-align: left;
  background: var(--ant-color-bg-container, #fff);
  border: 1px solid var(--ant-color-border-secondary, rgba(0, 0, 0, 0.06));
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    transform 0.15s ease;
  font-family: var(--trace-font-sans);
  font-size: 13px;
  color: var(--trace-text);
  line-height: 1.35;

  &:hover {
    border-color: var(--ant-color-primary-border-hover, rgba(24, 144, 255, 0.45));
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &:focus-visible {
    outline: 2px solid var(--ant-color-primary, #1677ff);
    outline-offset: 2px;
  }

  &--selected {
    border-color: var(--ant-color-primary, #1890ff);
    background: rgba(24, 144, 255, 0.05);
    box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.12);
  }

  &--matched {
    animation: trace-match-flash 1.8s ease;
  }
}

@keyframes trace-match-flash {
  0% {
    box-shadow:
      0 0 0 2px rgba(22, 119, 255, 0.35),
      0 0 0 8px rgba(22, 119, 255, 0.12);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.12);
  }
}

@media (max-width: 900px) {
  .trace-item {
    grid-template-columns: 1fr;
    gap: 6px;
    align-items: start;
  }

  .trace-item__meta {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .trace-item__payload-line {
    grid-column: 1 / -1;
  }
}

.trace-item__flow-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.flow-dir {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1;
}

.flow-dir--up {
  color: var(--trace-up);
  background: var(--trace-up-soft);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.22);
}

.flow-dir--down {
  color: var(--trace-down);
  background: var(--trace-down-soft);
  box-shadow: inset 0 0 0 1px rgba(8, 151, 156, 0.24);
}

.flow-dir--unknown {
  color: var(--trace-text-secondary);
  background: rgba(0, 0, 0, 0.05);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.trace-item__chain {
  display: inline-block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--trace-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-item__payload-line {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-left: 0;
  font-size: 11px;
  line-height: 1.3;
}

.trace-item__plabel {
  flex-shrink: 0;
  color: var(--trace-text-secondary);
  font-weight: 500;
  font-size: 10px;
}

.trace-item__log-tag {
  flex-shrink: 0;
  margin-inline-end: 0 !important;
  font-size: 10px;
  line-height: 1.2;
  padding: 0 5px;
}

.trace-item__psep {
  flex-shrink: 0;
  color: var(--trace-text-tertiary);
}

.trace-item__pval {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-family: var(--trace-font-mono);
  color: var(--trace-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-item__pval--log {
  flex: 0.85;
  color: var(--trace-text-tertiary);
}

.trace-item__pval--hint {
  font-family: inherit;
  color: var(--trace-text-secondary);
}

.trace-item__meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: nowrap;
}

.meta-tag {
  margin-inline-end: 0 !important;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  padding: 0 5px;
}

.meta-time {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-family: var(--trace-font-mono);
  font-size: 10px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: var(--trace-text-secondary);
  white-space: nowrap;
}

.meta-time__icon {
  font-size: 11px;
  color: var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.28));
}

.meta-action {
  display: inline-flex !important;
  align-items: center;
  gap: 2px;
  padding: 0 !important;
  height: 22px !important;
  font-size: 11px !important;
  font-weight: 500;
  line-height: 1.2;
}

.meta-action__arrow {
  font-size: 10px;
  opacity: 0.75;
  transition: transform 0.15s ease;
}

.trace-item:hover .meta-action__arrow {
  transform: translateX(2px);
}

.trace-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}
</style>
