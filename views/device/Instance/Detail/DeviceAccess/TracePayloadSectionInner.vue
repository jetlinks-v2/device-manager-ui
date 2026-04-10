<template>
  <div class="payload-section-inner">
    <!-- 设备消息 + 物模型：只读分块，避免表格 / Descriptions 表单感 -->
    <div
      v-if="
        section.deviceInfo &&
          (sectionModes[sIdx] ?? 'structured') === 'structured' &&
          canStructured(section)
      "
      class="payload-structured"
    >
      <template v-if="isPropertyRelatedMessage(section.deviceInfo)">
        <div class="sect-hd">{{ t('InstanceDeviceAccess.payloadView.properties') }}</div>
        <div
          v-if="structuredSummary"
          class="trace-structured-lede"
        >{{ structuredSummary }}</div>
        <ul
          v-if="propertyTableRows(section.deviceInfo).length"
          class="trace-kv-list trace-kv-list--props"
        >
          <li
            v-for="row in propertyTableRows(section.deviceInfo)"
            :key="row.key"
            class="trace-kv-item"
            :class="{ 'trace-kv-item--extra': !row.inModel }"
          >
            <div class="trace-kv-item__meta">
              <template v-if="row.inModel">
                <template v-if="row.name !== row.id">
                  <span class="trace-kv-item__name">{{ row.name }}</span>
                  <code class="trace-kv-item__id">{{ row.id }}</code>
                </template>
                <code
                  v-else
                  class="trace-kv-item__id trace-kv-item__id--solo"
                >{{ row.id }}</code>
              </template>
              <template v-else>
                <code class="trace-kv-item__id trace-kv-item__id--solo">{{ row.id }}</code>
                <a-tag
                  color="warning"
                  class="trace-kv-item__badge"
                  :title="t('InstanceDeviceAccess.payloadView.propertyNotInModelTip')"
                >
                  {{ t('InstanceDeviceAccess.payloadView.propertyNotInModel') }}
                </a-tag>
              </template>
            </div>
            <div class="trace-kv-item__val">{{ row.value }}</div>
          </li>
        </ul>
        <div
          v-else-if="section.deviceInfo.propertyIds?.length"
          class="property-ids"
        >
          <a-tag
            v-for="pid in section.deviceInfo.propertyIds"
            :key="pid"
            :color="isPropertyDefinedInModel(pid) ? 'default' : 'warning'"
            :title="
              isPropertyDefinedInModel(pid)
                ? undefined
                : t('InstanceDeviceAccess.payloadView.propertyNotInModelTip')
            "
          >
            {{ propertyDisplayName(pid) }}
            <span class="id-sub">({{ pid }})</span>
          </a-tag>
        </div>
      </template>

      <template v-else-if="isFunctionRelatedMessage(section.deviceInfo)">
        <div class="sect-hd">{{ t('InstanceDeviceAccess.payloadView.function') }}</div>
        <div
          v-if="structuredSummary"
          class="trace-structured-lede"
        >{{ structuredSummary }}</div>
        <section class="trace-read-block">
          <div
            v-if="section.deviceInfo.functionId"
            class="trace-read-line"
          >
            <span class="trace-read-line__k">{{ t('InstanceDeviceAccess.payloadView.functionId') }}</span>
            <span class="trace-read-line__v">
              {{ functionDisplayName(section.deviceInfo.functionId) }}
              <code class="id-inline">({{ section.deviceInfo.functionId }})</code>
            </span>
          </div>
          <div
            v-if="section.deviceInfo.inputs != null"
            class="trace-read-chunk"
          >
            <div class="trace-read-chunk__lbl">{{ t('InstanceDeviceAccess.payloadView.inputs') }}</div>
            <pre class="trace-read-chunk__pre">{{ formatValue(section.deviceInfo.inputs) }}</pre>
          </div>
          <div
            v-if="section.deviceInfo.output != null"
            class="trace-read-chunk"
          >
            <div class="trace-read-chunk__lbl">{{ t('InstanceDeviceAccess.payloadView.output') }}</div>
            <pre class="trace-read-chunk__pre">{{ formatValue(section.deviceInfo.output) }}</pre>
          </div>
        </section>
      </template>

      <template v-else-if="isEventRelatedMessage(section.deviceInfo)">
        <div class="sect-hd">{{ t('InstanceDeviceAccess.payloadView.event') }}</div>
        <div
          v-if="structuredSummary"
          class="trace-structured-lede"
        >{{ structuredSummary }}</div>
        <section class="trace-read-block">
          <div
            v-if="section.deviceInfo.event"
            class="trace-read-line"
          >
            <span class="trace-read-line__k">{{ t('InstanceDeviceAccess.payloadView.eventId') }}</span>
            <span class="trace-read-line__v">
              {{ eventDisplayName(section.deviceInfo.event) }}
              <code class="id-inline">({{ section.deviceInfo.event }})</code>
            </span>
          </div>
          <div
            v-if="section.deviceInfo.data != null"
            class="trace-read-chunk"
          >
            <div class="trace-read-chunk__lbl">{{ t('InstanceDeviceAccess.payloadView.eventData') }}</div>
            <pre class="trace-read-chunk__pre">{{ formatValue(section.deviceInfo.data) }}</pre>
          </div>
        </section>
      </template>

      <div v-else class="fallback-json">
        <pre class="wf-pre json-pre">{{ prettyJson(section.parsed) }}</pre>
      </div>
    </div>

    <!-- Hex: dump 原样 vs 字节流 -->
    <div
      v-else-if="section.format === 'hex_dump' && (hexModes[sIdx] ?? 'dump') === 'stream'"
      class="payload-hex-stream"
    >
      <pre class="wf-pre hex-stream-pre">{{ hexStreamText(section.raw) }}</pre>
    </div>

    <!-- JSON 非设备消息 -->
    <div v-else-if="section.format === 'json' && section.parsed != null" class="payload-json">
      <pre class="wf-pre json-pre">{{ prettyJson(section.parsed) }}</pre>
    </div>

    <!-- 默认：原始文本；可解析为 JSON 时做 pretty -->
    <div v-else class="payload-raw">
      <pre class="wf-pre">{{ displayRawPretty(section.raw) }}</pre>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TracePayloadSectionCtx, TraceSection } from './tracePayloadSectionContext'
import {
  countPropertyEntriesFromDeviceInfo,
  extractTimestampMsFromDevicePayload,
  formatDevicePayloadTimestamp,
} from './tracePayloadFormat'

const { t } = useI18n()

const props = defineProps<{
  section: TraceSection
  sIdx: number
}>()

const ctx = inject<TracePayloadSectionCtx>('tracePayloadSection')
if (!ctx) {
  throw new Error('TracePayloadSectionInner: missing tracePayloadSection provide')
}

const {
  sectionModes,
  hexModes,
  propertyTableRows,
  propertyDisplayName,
  isPropertyDefinedInModel,
  functionDisplayName,
  eventDisplayName,
  formatValue,
  prettyJson,
  displayRawPretty,
  hexStreamText,
  canStructured,
  isPropertyRelatedMessage,
  isFunctionRelatedMessage,
  isEventRelatedMessage,
} = ctx

function buildStructuredSummary(section: TraceSection): string {
  const info = section.deviceInfo
  const parsed = section.parsed
  if (!info || parsed == null || typeof parsed !== 'object') return ''

  const tsMs = extractTimestampMsFromDevicePayload(parsed)
  const timeStr = tsMs != null ? formatDevicePayloadTimestamp(tsMs) : ''

  if (isPropertyRelatedMessage(info)) {
    const n = countPropertyEntriesFromDeviceInfo(info)
    if (n > 0 && timeStr) {
      return t('InstanceDeviceAccess.payloadHint.propertyWithTime', { count: n, time: timeStr })
    }
    if (n > 0) {
      return t('InstanceDeviceAccess.payloadHint.propertyOnly', { count: n })
    }
    if (timeStr) {
      return t('InstanceDeviceAccess.payloadHint.labelWithTime', {
        label: t('InstanceDeviceAccess.payloadView.properties'),
        time: timeStr,
      })
    }
    return ''
  }

  if (isFunctionRelatedMessage(info) || isEventRelatedMessage(info)) {
    return timeStr ? t('InstanceDeviceAccess.payloadHint.structuredTime', { time: timeStr }) : ''
  }

  return ''
}

const structuredSummary = computed(() => {
  const sec = props.section
  if (!sec.deviceInfo || !canStructured(sec)) return ''
  const mode = sectionModes.value[props.sIdx] ?? 'structured'
  if (mode !== 'structured') return ''
  return buildStructuredSummary(sec)
})
</script>

<style lang="less" scoped>
.payload-section-inner {
  min-width: 0;
}

.payload-structured {
  min-width: 0;
}

.sect-hd {
  margin: 0 0 6px;
  font-weight: 600;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.75);
  letter-spacing: 0.02em;
}

.trace-structured-lede {
  margin: -2px 0 8px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.5);
  font-variant-numeric: tabular-nums;
}

.trace-kv-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.trace-kv-list--props {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trace-kv-item {
  margin: 0;
  padding: 4px 6px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.trace-kv-item--extra {
  border-left: 3px solid rgba(250, 173, 20, 0.85);
  background: rgba(250, 173, 20, 0.04);
  border-color: rgba(250, 173, 20, 0.22);
}

.trace-kv-item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-bottom: 2px;
}

.trace-kv-item__name {
  font-weight: 600;
  font-size: 11px;
  line-height: 1.25;
  color: rgba(0, 0, 0, 0.85);
}

.trace-kv-item__id {
  padding: 0 3px;
  font-size: 10px;
  line-height: 1.3;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.04);
  border-radius: 2px;
}

.trace-kv-item__id--solo {
  font-weight: 500;
  color: rgba(0, 0, 0, 0.78);
}

.trace-kv-item__badge {
  margin-inline-end: 0 !important;
  padding: 0 4px !important;
  font-size: 10px !important;
  line-height: 1.35 !important;
  border-radius: 2px !important;
}

.trace-kv-item__val {
  padding-left: 1px;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-word;
  white-space: pre-wrap;
}

.trace-read-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trace-read-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  padding: 6px 0;
  font-size: 12px;
  line-height: 1.45;
}

.trace-read-line__k {
  flex-shrink: 0;
  min-width: 4em;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
  font-weight: 500;
}

.trace-read-line__v {
  flex: 1;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
}

.id-inline {
  margin-left: 4px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
}

.trace-read-chunk__lbl {
  margin-bottom: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
  font-weight: 500;
}

.trace-read-chunk__pre {
  margin: 0;
  padding: 8px 10px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: rgba(0, 0, 0, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 6px;
}

.id-sub {
  margin-left: 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
}

.property-ids {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.fallback-json {
  margin-top: 4px;
}

.payload-hex-stream {
  min-width: 0;
}

.wf-pre {
  margin: 0;
  padding: 6px 8px;
  overflow-x: auto;
  color: rgba(0, 0, 0, 0.85);
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 4px;
}

.hex-stream-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
}

.json-pre {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}

.payload-raw .wf-pre {
  white-space: pre-wrap;
}
</style>
