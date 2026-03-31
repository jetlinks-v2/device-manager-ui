<template>
  <div class="trace-chain-list">
    <div class="trace-hint">
      <p class="trace-hint__text">
        <InfoCircleOutlined class="trace-hint__icon" aria-hidden="true" />
        {{ $t('InstanceDeviceAccess.952800-20') }}
      </p>
      <span class="trace-hint__count" aria-live="polite">
        {{ $t('InstanceDeviceAccess.traceHintCount', { n: traceReceivedTotal }) }}
      </span>
    </div>
    <div class="list-wrap">
      <div v-if="rows.length" class="trace-list-body">
        <button
          v-for="row in rows"
          :key="row.traceKey"
          v-memo="[
            row.traceKey,
            row.lastTime,
            row.flowKind,
            row.payloadPreview,
            row.lastLogPreview,
            row.hasError,
            row.spanChainText,
            selectedKey === row.traceKey,
          ]"
          type="button"
          class="trace-item"
          :class="[
            { 'trace-item--selected': selectedKey === row.traceKey },
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
            <span class="trace-item__chain" :title="chainTitle(row)">
              <template v-for="(seg, si) in chainSegments(row)" :key="`${row.traceKey}-seg-${si}`">
                <span v-if="si > 0" class="trace-item__chain-sep">→</span>
                <span class="trace-item__chain-part">{{ seg.label }}</span>
                <span v-if="seg.repeat" class="trace-item__chain-repeat">({{ seg.repeat }})</span>
              </template>
            </span>
          </div>
          <div class="trace-item__payload-line">
            <span class="trace-item__plabel">{{ $t('InstanceDeviceAccess.traceListRaw') }}</span>
            <span
              class="trace-item__pval"
              :title="fullPayloadTitle(row)"
            >{{ row.payloadPreview || $t('InstanceDeviceAccess.952800-25') }}</span>
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
      <div v-else class="trace-empty">
        <j-empty>
          <template #description>{{ $t('InstanceDeviceAccess.952800-5') }}</template>
        </j-empty>
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
  findGroupByKey,
  parseChainSegmentsFromText,
  pickRawPayloadDetail,
  sortedEvents,
  truncateText,
  type TraceListRow,
} from './traceListUtils'
import TraceChainDetailDrawer from './TraceChainDetailDrawer.vue'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

const props = defineProps<{
  traceGroups: TraceGroup[]
  /** 切换设备时重置「已收到」计数 */
  deviceId?: string
}>()

/** 本会话内累计收到的不同链路条数（去重 key，列表被裁剪后计数不减少） */
const traceReceivedTotal = ref(0)
const seenTraceKeys = new Set<string>()

function ingestNewTraceKeys(groups: TraceGroup[]) {
  for (const g of groups) {
    if (!seenTraceKeys.has(g.key)) {
      seenTraceKeys.add(g.key)
      traceReceivedTotal.value += 1
    }
  }
}

watch(
  () => props.traceGroups,
  (groups) => ingestNewTraceKeys(groups),
  { deep: true, immediate: true },
)

watch(
  () => props.deviceId,
  () => {
    seenTraceKeys.clear()
    traceReceivedTotal.value = 0
    ingestNewTraceKeys(props.traceGroups)
  },
)

const detailOpen = ref(false)
const detailGroup = ref<TraceGroup | null>(null)
const selectedKey = ref<string | null>(null)

const labelOp = createTraceOperationLabel($t)

const rows = computed(() => buildTraceRows(props.traceGroups, labelOp))

/** 列表主文案：链路步骤（decode → …）；无链时用消息类型兜底 */
const chainLine = (row: TraceListRow): string => {
  const chain = row.spanChainText?.trim()
  if (chain && chain !== '—') {
    return truncateText(chain, 140)
  }
  if (row.messageTypeRaw) {
    const key = `InstanceDeviceAccess.msgType.${row.messageTypeRaw}`
    const tr = $t(key)
    return tr !== key ? tr : row.messageTypeRaw
  }
  return '—'
}

const chainTitle = (row: TraceListRow): string => {
  const chain = row.spanChainText?.trim()
  if (chain && chain !== '—') return chain
  return chainLine(row)
}

/** 链路步骤拆段（含连续合并后的次数样式） */
const chainSegments = (row: TraceListRow) => parseChainSegmentsFromText(chainLine(row))

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

/** title 展示未截断的原始报文（从分组事件重算） */
const fullPayloadTitle = (row: TraceListRow) => {
  const g = findGroupByKey(props.traceGroups, row.traceKey)
  if (!g) return row.payloadPreview || undefined
  const nonLog = sortedEvents(g).filter((e) => e.type !== 'log')
  const raw = pickRawPayloadDetail(nonLog, row.flowKind)
  return raw ? String(raw) : row.payloadPreview || undefined
}

const openDetail = (traceKey: string) => {
  selectedKey.value = traceKey
  detailGroup.value = findGroupByKey(props.traceGroups, traceKey) || null
  detailOpen.value = true
}

watch(detailOpen, (v) => {
  if (!v) {
    selectedKey.value = null
  }
})

watch(
  () => props.traceGroups,
  () => {
    if (detailOpen.value && selectedKey.value) {
      detailGroup.value = findGroupByKey(props.traceGroups, selectedKey.value) || null
    }
  },
  { deep: true },
)
</script>

<style lang="less" scoped>
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
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
  max-height: 420px;
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
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: baseline;
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

.trace-item__chain-sep {
  flex-shrink: 0;
  margin: 0 3px;
  color: var(--trace-text-tertiary);
  font-size: 11px;
  font-weight: 500;
}

.trace-item__chain-part {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trace-item__chain-repeat {
  flex-shrink: 0;
  margin-left: 1px;
  color: var(--ant-color-primary, #1677ff);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  opacity: 0.88;
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
