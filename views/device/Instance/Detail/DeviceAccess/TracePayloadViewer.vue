<template>
  <div class="trace-payload-viewer">
    <div
      v-for="(section, sIdx) in sections"
      :key="sIdx"
      class="payload-section"
    >
      <!-- full：工具栏在框外 -->
      <template v-if="toolbarMode === 'full'">
        <div class="payload-toolbar">
          <a-space wrap size="small">
            <a-tag :color="formatTagColor(section.format)">{{ formatLabel(section.format) }}</a-tag>
            <template v-if="section.deviceInfo && canStructured(section)">
              <a-tag v-if="showErrorHint" color="error">{{ $t('InstanceDeviceAccess.952800-22') }}</a-tag>
              <a-tooltip v-if="showErrorHint && errorText" :title="errorText">
                <span class="payload-error-text">{{ errorText }}</span>
              </a-tooltip>
              <span v-if="showErrorHint" class="payload-sep">|</span>
              <a-segmented
                size="small"
                :value="sectionModes[sIdx] ?? 'structured'"
                :options="segmentOptions"
                @update:value="(v: string) => setSectionMode(sIdx, v as 'structured' | 'raw')"
              />
            </template>
            <template v-else-if="section.format === 'hex_dump'">
              <a-segmented
                size="small"
                :value="hexModes[sIdx] ?? 'dump'"
                :options="hexSegmentOptions"
                @update:value="(v: string) => setHexMode(sIdx, v as 'dump' | 'stream')"
              />
            </template>
            <a-button
              type="text"
              size="small"
              class="copy-btn"
              @click="copySection(section.raw)"
            >
              <CopyOutlined />
              {{ $t('InstanceDeviceAccess.payloadView.copy') }}
            </a-button>
          </a-space>
        </div>
        <div v-if="section.truncated" class="payload-truncated-hint">
          {{ $t('InstanceDeviceAccess.payloadView.truncated') }}
        </div>
        <PayloadSectionInner
          :section="section"
          :s-idx="sIdx"
        />
      </template>

      <!-- minimal：顶栏仅切换；复制在正文区右上角悬浮 -->
      <div v-else class="payload-text-frame">
        <div v-if="section.truncated" class="payload-truncated-hint">
          {{ $t('InstanceDeviceAccess.payloadView.truncated') }}
        </div>
        <div
          v-if="sectionNeedsChrome(section)"
          class="payload-text-frame__head"
        >
          <a-space wrap size="small">
            <template v-if="section.deviceInfo && canStructured(section)">
              <a-tag v-if="showErrorHint" color="error">{{ $t('InstanceDeviceAccess.952800-22') }}</a-tag>
              <a-tooltip v-if="showErrorHint && errorText" :title="errorText">
                <span class="payload-error-text">{{ errorText }}</span>
              </a-tooltip>
              <span v-if="showErrorHint" class="payload-sep">|</span>
              <a-segmented
                size="small"
                :value="sectionModes[sIdx] ?? 'structured'"
                :options="segmentOptions"
                @update:value="(v: string) => setSectionMode(sIdx, v as 'structured' | 'raw')"
              />
            </template>
            <template v-else-if="section.format === 'hex_dump'">
              <a-segmented
                size="small"
                :value="hexModes[sIdx] ?? 'dump'"
                :options="hexSegmentOptions"
                @update:value="(v: string) => setHexMode(sIdx, v as 'dump' | 'stream')"
              />
            </template>
          </a-space>
        </div>
        <div class="payload-text-frame__body">
          <a-button
            type="text"
            size="small"
            class="payload-text-frame__copy-float"
            :title="$t('InstanceDeviceAccess.payloadView.copy')"
            :aria-label="$t('InstanceDeviceAccess.payloadView.copy')"
            @click="copySection(section.raw)"
          >
            <CopyOutlined />
          </a-button>
          <PayloadSectionInner
            :section="section"
            :s-idx="sIdx"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, provide, ref, watch } from 'vue'
import PayloadSectionInner from './TracePayloadSectionInner.vue'
import { useInstanceStore } from '../../../../../store/instance'
import { CopyOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { TracePayloadSectionCtx } from './tracePayloadSectionContext'
import type { TracePayloadFormat } from './tracePayloadFormat'
import {
  MAX_TRACE_PAYLOAD_CHARS,
  detectPayloadFormat,
  extractDeviceMessageInfo,
  formatHexByteLines,
  isEventRelatedMessage,
  isFunctionRelatedMessage,
  isPropertyRelatedMessage,
  parseNettyHexDumpBytes,
  parseHexPlain,
  prettyJsonString,
  splitTracePayloadSections,
  truncatePayload,
  tryParseJson,
  type DeviceMessageInfo,
} from './tracePayloadFormat'

const { t: $t } = useI18n()
const instanceStore = useInstanceStore()

/** 结构化属性行数上限，避免超大 properties 对象拖垮渲染 */
const MAX_PROPERTY_ROWS = 200

const props = withDefaults(
  defineProps<{
    content: string
    maxChars?: number
    hasError?: boolean
    errorText?: string
    /** full：类型+复制+切换；minimal：顶栏仅切换，复制悬浮在正文区右上角 */
    toolbarMode?: 'full' | 'minimal'
  }>(),
  { maxChars: MAX_TRACE_PAYLOAD_CHARS, toolbarMode: 'full', hasError: false, errorText: '' },
)

type Section = {
  raw: string
  format: TracePayloadFormat
  parsed: unknown | null
  deviceInfo: DeviceMessageInfo | null
  truncated: boolean
}

const metadata = computed(() => {
  try {
    return JSON.parse(instanceStore.current?.metadata || '{}') as {
      properties?: { id: string; name: string }[]
      functions?: { id: string; name: string; inputs?: unknown[] }[]
      events?: { id: string; name: string }[]
    }
  } catch {
    return {}
  }
})

const sections = computed<Section[]>(() => {
  const rawContent = props.content ?? ''
  const split = splitTracePayloadSections(rawContent)
  const parts = split.length > 0 ? split : [rawContent]
  return parts.map((part) => {
    const { text, truncated } = truncatePayload(part, props.maxChars)
    const format = detectPayloadFormat(text)
    const trimmed = text.trim()
    const parsed = format === 'json' || format === 'json_device' ? tryParseJson(trimmed) : null
    const deviceInfo =
      parsed != null && format === 'json_device' ? extractDeviceMessageInfo(parsed) : null
    return {
      raw: text,
      format: deviceInfo ? 'json_device' : format,
      parsed,
      deviceInfo,
      truncated,
    }
  })
})

const sectionModes = ref<Record<number, 'structured' | 'raw'>>({})
const hexModes = ref<Record<number, 'dump' | 'stream'>>({})

function setSectionMode(idx: number, v: 'structured' | 'raw') {
  sectionModes.value = { ...sectionModes.value, [idx]: v }
}

function setHexMode(idx: number, v: 'dump' | 'stream') {
  hexModes.value = { ...hexModes.value, [idx]: v }
}

watch(
  sections,
  (list) => {
    const nextS = { ...sectionModes.value }
    const nextH = { ...hexModes.value }
    list.forEach((_, i) => {
      if (nextS[i] == null) nextS[i] = 'structured'
      if (nextH[i] == null) nextH[i] = 'dump'
    })
    sectionModes.value = nextS
    hexModes.value = nextH
  },
  { immediate: true, deep: true },
)

const segmentOptions = computed(() => [
  { label: $t('InstanceDeviceAccess.payloadView.structured'), value: 'structured' },
  { label: $t('InstanceDeviceAccess.payloadView.raw'), value: 'raw' },
])

const hexSegmentOptions = computed(() => [
  { label: $t('InstanceDeviceAccess.payloadView.hexDump'), value: 'dump' },
  { label: $t('InstanceDeviceAccess.payloadView.hexStream'), value: 'stream' },
])

const showErrorHint = computed(() => !!props.hasError)

function formatTagColor(fmt: TracePayloadFormat): string {
  const map: Partial<Record<TracePayloadFormat, string>> = {
    hex_dump: 'purple',
    hex_plain: 'purple',
    json: 'geekblue',
    json_device: 'blue',
    http: 'orange',
    mqtt_like: 'cyan',
    text: 'default',
  }
  return map[fmt] || 'default'
}

function formatLabel(fmt: TracePayloadFormat): string {
  return $t(`InstanceDeviceAccess.payloadFormat.${fmt}`)
}

function canStructured(section: Section): boolean {
  return section.format === 'json_device' && !!section.deviceInfo
}

function sectionNeedsChrome(section: Section): boolean {
  return (
    (section.deviceInfo != null && canStructured(section)) || section.format === 'hex_dump'
  )
}

function propertyDisplayName(id: string): string {
  const p = metadata.value.properties?.find((x) => x.id === id)
  return p?.name || id
}

function isPropertyDefinedInModel(id: string): boolean {
  return !!metadata.value.properties?.some((x) => x.id === id)
}

function functionDisplayName(id: string): string {
  const f = metadata.value.functions?.find((x) => x.id === id)
  return f?.name || id
}

function eventDisplayName(id: string): string {
  const e = metadata.value.events?.find((x) => x.id === id)
  return e?.name || id
}

function propertyTableRows(info: DeviceMessageInfo) {
  const props = info.properties
  if (!props || typeof props !== 'object') return []
  const rows = Object.entries(props).map(([id, value]) => ({
    key: id,
    id,
    name: propertyDisplayName(id),
    value: formatValue(value),
    inModel: isPropertyDefinedInModel(id),
  }))
  return rows.length > MAX_PROPERTY_ROWS ? rows.slice(0, MAX_PROPERTY_ROWS) : rows
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return prettyJsonString(v)
  return String(v)
}

function prettyJson(obj: unknown): string {
  return prettyJsonString(obj)
}

/** 原始报文：若为 JSON 则格式化展示 */
function displayRawPretty(raw: string): string {
  const t = raw.trim()
  if (!t) return raw
  if (t[0] === '{' || t[0] === '[') {
    try {
      return prettyJsonString(JSON.parse(t))
    } catch {
      return raw
    }
  }
  return raw
}

function hexStreamText(raw: string): string {
  const fromDump = parseNettyHexDumpBytes(raw)
  if (fromDump && fromDump.length) return formatHexByteLines(fromDump, 16)
  const plain = parseHexPlain(raw.trim())
  if (plain && plain.length) return formatHexByteLines(plain, 16)
  return raw
}

const tracePayloadSectionCtx: TracePayloadSectionCtx = {
  sectionModes,
  hexModes,
  setSectionMode,
  setHexMode,
  segmentOptions,
  hexSegmentOptions,
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
}
provide('tracePayloadSection', tracePayloadSectionCtx)

async function copySection(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success($t('InstanceDeviceAccess.952800-7'))
  } catch {
    message.error('Copy failed')
  }
}
</script>

<style lang="less" scoped>
.trace-payload-viewer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.payload-section {
  min-width: 0;
}

.payload-toolbar {
  margin-bottom: 4px;
}

.copy-btn {
  padding: 0 4px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 11px;
}

.payload-error-text {
  display: inline-block;
  max-width: min(42vw, 420px);
  overflow: hidden;
  color: #e50012;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.payload-sep {
  color: rgba(0, 0, 0, 0.3);
  font-size: 11px;
}

.payload-truncated-hint {
  margin-bottom: 4px;
  color: var(--ant-color-warning, #d48806);
  font-size: 11px;
}

.payload-text-frame {
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.payload-text-frame__head {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(0, 0, 0, 0.02);

  :deep(.ant-segmented) {
    font-size: 11px;
  }
}

.payload-text-frame__body {
  position: relative;
  padding: 6px 32px 8px 8px;
  min-width: 0;

  :deep(.wf-pre) {
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
  }

  :deep(.payload-structured) {
    padding-top: 0;
  }
}

.payload-text-frame__copy-float {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  width: 26px !important;
  height: 26px !important;
  padding: 0 !important;
  margin: 0 !important;
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.payload-text-frame__copy-float:hover {
  color: var(--ant-color-primary, #1677ff);
  background: #fff;
}
</style>
