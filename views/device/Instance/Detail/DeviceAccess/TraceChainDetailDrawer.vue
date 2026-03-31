<template>
  <a-drawer
    :open="open"
    :width="drawerWidth"
    :title="$t('InstanceDeviceAccess.952800-15')"
    destroy-on-close
    placement="right"
    class="trace-detail-drawer"
    @close="emit('update:open', false)"
  >
    <template v-if="group">
      <div class="drawer-head">
        <div class="drawer-meta">
          <span class="label">traceId</span>
          <a-typography-paragraph
            v-if="group.traceId !== '_no_trace_'"
            class="trace-id"
            :copyable="{
              text: group.traceId,
              tooltips: [
                $t('InstanceDeviceAccess.952800-6'),
                $t('InstanceDeviceAccess.952800-7'),
              ],
            }"
          >
            {{ group.traceId }}
          </a-typography-paragraph>
          <span v-else>—</span>
        </div>
        <a-space wrap>
          <a-tag :color="summary.hasError ? 'error' : 'success'">
            {{
              summary.hasError
                ? $t('InstanceDeviceAccess.952800-22')
                : $t('InstanceDeviceAccess.952800-21')
            }}
          </a-tag>
          <a-tag v-if="summary.isUpstream === true">{{ $t('InstanceDeviceAccess.952800-11') }}</a-tag>
          <a-tag v-else-if="summary.isUpstream === false">{{ $t('InstanceDeviceAccess.952800-12') }}</a-tag>
          <span class="muted">
            {{ summary.spanCount }} {{ $t('InstanceDeviceAccess.952800-18') }} ·
            {{ summary.logCount }} {{ $t('InstanceDeviceAccess.952800-19') }}
            <template v-if="groupWallElapsedLabel">
              · {{ $t('InstanceDeviceAccess.traceDrawer.wallElapsed', { time: groupWallElapsedLabel }) }}
              <a-tooltip
                :overlay-inner-style="{ maxWidth: '380px', whiteSpace: 'normal' }"
                :title="$t('InstanceDeviceAccess.traceDrawer.wallElapsedHelp')"
              >
                <QuestionCircleOutlined
                  class="trace-wall-elapsed-help"
                  :aria-label="$t('InstanceDeviceAccess.traceDrawer.wallElapsedHelpAria')"
                  role="img"
                  tabindex="0"
                />
              </a-tooltip>
            </template>
          </span>
        </a-space>
      </div>

      <div class="waterfall">
        <div
          v-for="ev in eventsSorted"
          :key="ev.key"
          class="wf-row"
          :class="{ 'wf-row--error': ev.error, 'wf-row--log': ev.type === 'log' }"
        >
          <div class="wf-rail-cell" aria-hidden="true">
            <span class="wf-rail-dot" />
          </div>
          <a-collapse
            v-model:activeKey="panelActiveKeys[ev.key]"
            class="wf-body-collapse"
            :bordered="false"
            expand-icon-position="end"
          >
            <a-collapse-panel :key="ev.key">
              <template #header>
                <div class="wf-head-inline">
                  <div class="wf-head-main">
                    <template v-if="ev.type === 'log'">
                      <a-tag
                        :color="logLevelTagColor(ev)"
                        class="wf-log-tag"
                      >
                        {{ logLevelTagText(ev) }}
                      </a-tag>
                    </template>
                    <template v-else>
                      <a-badge
                        :color="ev.error ? '#E50012' : '#24B276'"
                        class="wf-dot"
                      />
                      <!-- 有设备消息类型时：强化消息类型，弱化链路步骤名（如「处理解析结果」） -->
                      <template v-if="ev.detail && deviceHintParts(ev.detail).primary">
                        <span class="wf-msg-type">
                          <template v-for="p in [deviceHintParts(ev.detail)]" :key="`${ev.key}-hint`">
                            <span class="wf-msg-type__primary">{{ p.primary }}</span>
                            <span v-if="p.suffix" class="wf-msg-type__suffix">{{ p.suffix }}</span>
                          </template>
                        </span>
                        <span
                          class="wf-op"
                          :class="{ 'wf-op--weak': ev.operation === 'handle' }"
                        >{{ labelOp(ev.operation) }}</span>
                      </template>
                      <template v-else>
                        <span
                          class="wf-op"
                          :class="{ 'wf-op--weak': ev.operation === 'handle' }"
                        >{{ labelOp(ev.operation) }}</span>
                      </template>
                    </template>
                    <template v-if="ev.detail && showPayloadFormatTag(ev.detail, ev.operation)">
                      <a-tag :color="payloadTagColor(ev.detail)" class="wf-fmt-tag">
                        {{ payloadFormatLabel(ev.detail) }}
                      </a-tag>
                    </template>
                  </div>
                  <div class="wf-head-right">
                    <span class="wf-time-inline">{{ formatDisplayEventTime(ev) }}</span>
                    <span
                      v-if="formatTraceDurationParen(ev)"
                      class="wf-duration"
                    >{{ formatTraceDurationParen(ev) }}</span>
                  </div>
                </div>
              </template>
              <div
                v-if="ev.detail"
                class="wf-detail"
              >
                <!-- 仅展开时挂载解析器，步骤多时显著降 CPU；步骤 ≤20 默认已展开 -->
                <TracePayloadViewer
                  v-if="stepPanelExpanded(ev.key)"
                  :content="ev.detail"
                  :has-error="!!ev.error"
                  :error-text="resolveTraceErrorText(ev)"
                  toolbar-mode="minimal"
                />
              </div>
              <div
                v-if="ev.error && resolveTraceErrorText(ev)"
                class="wf-error-message"
              >
                <a-alert
                  type="error"
                  show-icon
                  :message="resolveTraceErrorText(ev)"
                />
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
      </div>
    </template>
  </a-drawer>
</template>

<script lang="ts" setup>
import type { TraceGroup } from './composables/useDeviceTraceLog'
import {
  computeGroupWallElapsedMs,
  createTraceOperationLabel,
  formatDisplayEventTime,
  formatTraceDurationParen,
  formatWallElapsedLabel,
} from './traceOperationLabels'
import { antTagColorForLogLevel, normalizeLogLevel } from './traceLogLevel'
import { sortedEvents, summarizeTraceGroup } from './traceListUtils'
import TracePayloadViewer from './TracePayloadViewer.vue'
import {
  countPropertyEntriesFromDeviceInfo,
  getFirstSectionPayloadMeta,
  isEventRelatedMessage,
  isPropertyRelatedMessage,
  parseFirstSectionDevicePayload,
} from './tracePayloadFormat'
import type { TracePayloadFormat } from './tracePayloadFormat'
import { useInstanceStore } from '../../../../../store/instance'
import { QuestionCircleOutlined } from '@ant-design/icons-vue'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()

const thingMetadata = computed(() => {
  try {
    return JSON.parse(instanceStore.current?.metadata || '{}') as {
      events?: { id: string; name: string }[]
    }
  } catch {
    return {}
  }
})

function eventDisplayName(id: string): string {
  const e = thingMetadata.value.events?.find((x) => x.id === id)
  return e?.name || id
}

const props = defineProps<{
  open: boolean
  group: TraceGroup | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()

const drawerWidth = computed(() => {
  if (typeof window === 'undefined') return 720
  return Math.min(720, window.innerWidth - 48)
})

const labelOp = createTraceOperationLabel($t)

const summary = computed(() => {
  if (!props.group) {
    return {
      hasError: false,
      isUpstream: null as boolean | null,
      spanCount: 0,
      logCount: 0,
    }
  }
  return summarizeTraceGroup(props.group, labelOp)
})

/** 链路墙钟总耗时：全步骤最早开始 ~ 最晚结束 */
const groupWallElapsedLabel = computed(() => {
  if (!props.group?.events?.length) return ''
  const ms = computeGroupWallElapsedMs(props.group.events)
  if (ms == null) return ''
  return formatWallElapsedLabel(ms)
})

const eventsSorted = computed(() =>
  props.group ? sortedEvents(props.group) : [],
)

/** 每条事件卡片展开状态（Ant Collapse 的 activeKey） */
const panelActiveKeys = reactive<Record<string, string[]>>({})

/** 步骤过多时默认全部折叠，避免一次性挂载大量 TracePayloadViewer */
const LAZY_STEP_THRESHOLD = 20

function stepPanelExpanded(evKey: string): boolean {
  return panelActiveKeys[evKey]?.includes(evKey) === true
}

watch(
  () => props.group,
  (g) => {
    Object.keys(panelActiveKeys).forEach((k) => {
      delete panelActiveKeys[k]
    })
    if (g) {
      const evs = sortedEvents(g)
      const collapseDefault = evs.length > LAZY_STEP_THRESHOLD
      evs.forEach((e) => {
        panelActiveKeys[e.key] = collapseDefault ? [] : [e.key]
      })
    }
  },
  { immediate: true },
)

function payloadTagColor(detail: string): string {
  const { format } = getFirstSectionPayloadMeta(detail)
  const map: Partial<Record<TracePayloadFormat, string>> = {
    hex_dump: 'purple',
    hex_plain: 'purple',
    json: 'geekblue',
    json_device: 'blue',
    http: 'orange',
    mqtt_like: 'cyan',
    text: 'default',
  }
  return map[format] || 'default'
}

function payloadFormatLabel(detail: string): string {
  const { format } = getFirstSectionPayloadMeta(detail)
  return $t(`InstanceDeviceAccess.payloadFormat.${format}`)
}

/** 「处理解析结果」(handle) 步骤中设备消息已有弱化标题，不重复展示「设备消息」格式 Tag */
function showPayloadFormatTag(detail: string | undefined, operation?: string): boolean {
  if (!detail) return false
  const { format } = getFirstSectionPayloadMeta(detail)
  if (operation === 'handle' && format === 'json_device') return false
  return true
}

/** 主标题 + 弱化后缀（n 个属性、事件名(id)） */
function deviceHintParts(detail: string | undefined): { primary: string; suffix: string } {
  if (!detail) return { primary: '', suffix: '' }
  const hit = parseFirstSectionDevicePayload(detail)
  if (!hit) {
    const { format, messageType } = getFirstSectionPayloadMeta(detail)
    if (format !== 'json_device' || !messageType) return { primary: '', suffix: '' }
    const mtKey = `InstanceDeviceAccess.msgType.${messageType}`
    const mtTr = $t(mtKey)
    const primary = mtTr !== mtKey ? mtTr : messageType
    return { primary, suffix: '' }
  }
  const { info } = hit
  const mtKey = `InstanceDeviceAccess.msgType.${info.messageType}`
  const mtTr = $t(mtKey)
  const mtLabel = mtTr !== mtKey ? mtTr : info.messageType

  if (isPropertyRelatedMessage(info)) {
    const n = countPropertyEntriesFromDeviceInfo(info)
    if (n > 0) {
      return {
        primary: mtLabel,
        suffix: $t('InstanceDeviceAccess.traceTitle.propertyCount', { n }),
      }
    }
    return { primary: mtLabel, suffix: '' }
  }

  if (isEventRelatedMessage(info) && info.event) {
    const name = eventDisplayName(info.event)
    return {
      primary: mtLabel,
      suffix: `${name}(${info.event})`,
    }
  }

  return { primary: mtLabel, suffix: '' }
}

/** 标签文案：仅使用 logLevel；无则回退「日志」 */
function logLevelTagText(ev: { logLevel?: string }): string {
  const lv = normalizeLogLevel(ev.logLevel)
  return lv || $t('InstanceDeviceAccess.952800-10')
}

function logLevelTagColor(ev: { logLevel?: string }): string {
  const lv = normalizeLogLevel(ev.logLevel)
  return lv ? antTagColorForLogLevel(lv) : 'default'
}

function resolveTraceErrorText(ev: Record<string, any>): string {
  if (!ev?.error) return ''
  const direct = [
    ev.errorMessage,
    ev.message,
    ev.reason,
    ev.cause,
    ev.exception,
    ev.stackTrace,
  ].find((v) => typeof v === 'string' && v.trim())
  if (direct) return String(direct).trim()

  const d = ev.detail
  if (typeof d === 'string' && d.trim()) {
    const t = d.trim()
    try {
      const parsed = JSON.parse(t) as Record<string, unknown>
      const fromJson = [
        parsed.errorMessage,
        parsed.message,
        parsed.reason,
        parsed.cause,
        parsed.exception,
      ].find((v) => typeof v === 'string' && String(v).trim())
      if (fromJson) return String(fromJson).trim()
    } catch {
      // detail 不是 JSON 时忽略
    }
  }
  return ''
}
</script>

<style lang="less" scoped>
.trace-detail-drawer {
  :deep(.ant-drawer-body) {
    padding-top: 8px;
    padding-bottom: 12px;
  }
}

.drawer-head {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.drawer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  .label {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
  }

  .trace-id {
    margin: 0 !important;
    font-family: monospace;
    font-size: 13px;
  }
}

.muted {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.trace-wall-elapsed-help {
  margin-left: 2px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
  cursor: help;
  vertical-align: -0.1em;
  transition: color 0.15s ease;

  &:hover {
    color: rgba(24, 144, 255, 0.85);
  }
}

.waterfall {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.waterfall::before {
  content: '';
  position: absolute;
  z-index: 0;
  left: 6px;
  top: 0;
  bottom: 0;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(
    180deg,
    rgba(24, 144, 255, 0.45),
    rgba(24, 144, 255, 0.12)
  );
  transform: translateX(-50%);
}

.wf-row {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 0 8px;
  align-items: stretch;
  padding-bottom: 6px;

  &--log .wf-body-collapse {
    background: rgba(0, 0, 0, 0.02);
    border-color: rgba(0, 0, 0, 0.05);
    opacity: 0.92;
  }

  &--log .wf-rail-dot {
    background: rgba(0, 0, 0, 0.22);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95);
  }

  &--log .wf-head-inline {
    opacity: 0.88;
  }

  &--log .wf-head-right {
    .wf-time-inline,
    .wf-duration {
      color: rgba(0, 0, 0, 0.35);
    }
  }

  &--error .wf-body-collapse {
    border-color: rgba(255, 77, 79, 0.35);
  }
}

.wf-rail-cell {
  position: relative;
  width: 12px;
  flex-shrink: 0;
}

.wf-rail-dot {
  position: absolute;
  left: 50%;
  top: 10px;
  z-index: 2;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: #1890ff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.95);
}

.wf-body-collapse {
  min-width: 0;
  background: #fafafa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 4px;
}

.wf-body-collapse :deep(.ant-collapse-item) {
  border: none;
}

.wf-body-collapse :deep(.ant-collapse-header) {
  align-items: flex-start !important;
  padding: 5px 8px !important;
  line-height: 1.35;
}

.wf-body-collapse :deep(.ant-collapse-expand-icon) {
  padding-top: 2px;
}

.wf-body-collapse :deep(.ant-collapse-content-box) {
  padding: 0 8px 8px !important;
}

.wf-head-main {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}

.wf-head-right {
  display: inline-flex;
  flex-shrink: 0;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-left: auto;
  padding-left: 8px;
  text-align: right;
}

.wf-time-inline {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.wf-msg-type {
  flex: 1;
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 6px;
  min-width: 0;
  overflow: hidden;
  line-height: 1.25;
}

.wf-msg-type__primary {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.88);
}

.wf-msg-type__suffix {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-weight: 400;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.38);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.wf-head-inline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  width: 100%;
  margin-bottom: 2px;
}

.wf-fmt-tag {
  margin-inline-end: 0 !important;
  font-size: 11px;
  line-height: 1.2;
  padding: 0 5px;
}

.wf-log-tag {
  margin-inline-end: 0 !important;
  font-size: 11px;
  line-height: 1.2;
  padding: 0 5px;
}

.wf-dot {
  margin-right: 0;
}

.wf-op {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
}

.wf-op--weak {
  font-weight: 400;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.38);
}

.wf-duration {
  flex-shrink: 0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
}

.wf-detail {
  margin-top: 2px;
  min-width: 0;
}

.wf-error-message {
  margin-top: 6px;

  :deep(.ant-alert) {
    padding: 6px 8px;
  }

  :deep(.ant-alert-message) {
    font-size: 12px;
    line-height: 1.45;
    word-break: break-word;
  }
}
</style>
