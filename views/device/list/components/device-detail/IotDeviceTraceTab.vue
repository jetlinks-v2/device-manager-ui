<template>
  <section class="trace-tab" :aria-label="$t('IotDeviceDetail.trace.aria')">
    <section v-if="!hideSession" class="trace-session" :data-online="isOnline">
      <a-alert :type="isOnline ? 'success' : 'warning'" show-icon>
        <template #message>
          <div v-if="isOnline" class="trace-session__detail">
            <span>{{ $t('IotDeviceDetail.trace.online') }}</span>
            <a-spin :spinning="sessionsLoading" size="small" />
            <template v-if="connectionCountHint">
              <span>{{ connectionCountHint }}</span>
            </template>
            <template v-if="displaySession">
              <span>{{ $t('IotDeviceDetail.trace.connectionAddress', { address: displayAddress || '-' }) }}</span>
              <span>{{ $t('IotDeviceDetail.trace.transport', { transport: displaySession.transport || '-' }) }}</span>
              <span>{{ $t('IotDeviceDetail.trace.connectTime', { time: formatTime(displayConnectTime) }) }}</span>
              <span>{{ $t('IotDeviceDetail.trace.lastCommTime', { time: formatTime(displayLastCommTime) }) }}</span>
              <span v-if="displayPendingMessages != null">{{ $t('IotDeviceDetail.trace.pendingMessages', { count: displayPendingMessages }) }}</span>
            </template>
            <a-tooltip :title="$t('IotDeviceDetail.trace.refreshConnection')">
              <a-button type="text" size="small" class="trace-session__refresh" @click="loadSessions(true)">
                <AIcon type="ReloadOutlined" aria-hidden="true" />
              </a-button>
            </a-tooltip>
          </div>
          <span v-else>{{ $t('IotDeviceDetail.trace.offlineTip') }}</span>
        </template>
      </a-alert>
      <div v-if="isOnline && connectionList.length > 1" class="trace-session__connections">
        <div
          v-for="(conn, index) in connectionList"
          :key="`${conn.address || 'conn'}-${index}`"
          :class="{ 'is-active': index === selectedConnectionIndex }"
          @click="selectedConnectionIndex = index"
        >
          <span>{{ $t('IotDeviceDetail.trace.connectionIndex', { index: index + 1 }) }}</span>
          <span>{{ $t('IotDeviceDetail.trace.address', { address: conn.address || '-' }) }}</span>
          <span>{{ $t('IotDeviceDetail.trace.pending', { count: conn.pendingMessages ?? conn.metrics?.pendingMessages ?? '-' }) }}</span>
          <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.readBytes', { value: formatBytes(conn.metrics.readBytes) }) }}</span>
          <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.writeBytes', { value: formatBytes(conn.metrics.writeBytes) }) }}</span>
          <span v-if="conn.metrics">{{ $t('IotDeviceDetail.trace.droppedMessages', { count: conn.metrics.droppedMessages ?? '-' }) }}</span>
        </div>
      </div>
    </section>

    <aside class="trace-debug">
      <header class="trace-debug__head">
        <AIcon type="SendOutlined" aria-hidden="true" />
        <div>
          <strong>{{ $t('IotDeviceDetail.trace.remoteDebug') }}</strong>
          <span>{{ $t('IotDeviceDetail.trace.remoteDebugDesc') }}</span>
        </div>
      </header>

      <a-alert
        v-if="!isOnline"
        class="trace-debug__alert"
        type="warning"
        show-icon
        :message="$t('IotDeviceDetail.trace.commandOfflineWarning')"
      />

      <a-segmented
        v-model:value="mode"
        class="trace-debug__mode"
        block
        size="small"
        :options="modeOptions"
      />

      <div class="trace-debug__body">
        <div v-if="!isOnline" class="trace-debug__offline">
          {{ $t('IotDeviceDetail.trace.offlineCommandTip') }}
        </div>

        <CloudEmpty
          v-else-if="!hasAnyCapability"
          :description="$t('IotDeviceDetail.trace.emptyCapability')"
        />

        <a-form v-else layout="vertical" class="trace-debug-form">
          <template v-if="mode === 'read'">
            <a-form-item :label="$t('IotDeviceDetail.trace.property')">
              <a-select
                v-model:value="readPropertyIds"
                mode="multiple"
                allow-clear
                :options="readPropertyOptions"
                :placeholder="$t('IotDeviceDetail.trace.selectReadProperty')"
              />
            </a-form-item>
          </template>

          <template v-else-if="mode === 'write'">
            <a-form-item :label="$t('IotDeviceDetail.trace.property')">
              <a-select
                v-model:value="writePropertyId"
                allow-clear
                :options="writePropertyOptions"
                :placeholder="$t('IotDeviceDetail.trace.selectWriteProperty')"
                @change="onWritePropertyChange"
              />
            </a-form-item>
            <a-form-item :label="$t('IotDeviceDetail.trace.value')">
              <a-select
                v-if="writeValueOptions?.length"
                v-model:value="writeValue"
                :options="writeValueOptions"
                :placeholder="$t('IotDeviceDetail.trace.selectPropertyValue')"
              />
              <a-switch
                v-else-if="writeValueType === 'boolean'"
                v-model:checked="writeValue"
              />
              <a-input-number
                v-else-if="isNumberType(writeValueType)"
                v-model:value="writeValue"
                style="width: 100%"
              />
              <a-textarea
                v-else-if="writeValueType === 'object' || writeValueType === 'array'"
                v-model:value="writeValue"
                :rows="4"
                :placeholder="$t('IotDeviceDetail.trace.inputJson')"
              />
              <a-input
                v-else
                v-model:value="writeValue"
                :placeholder="$t('IotDeviceDetail.trace.inputPropertyValue')"
              />
            </a-form-item>
          </template>

          <template v-else>
            <a-form-item :label="$t('IotDeviceDetail.trace.function')">
              <a-select
                v-model:value="functionId"
                allow-clear
                :options="functionOptions"
                :placeholder="$t('IotDeviceDetail.trace.selectFunction')"
                @change="onFunctionChange"
              />
            </a-form-item>
            <a-segmented
              v-if="selectedFunction"
              v-model:value="invokeInputMode"
              class="trace-debug__invoke-mode"
              size="small"
              :options="invokeModeOptions"
            />
            <template v-if="selectedFunction && invokeInputMode === 'form'">
              <a-form-item
                v-for="input in invokeInputDefs"
                :key="input.id"
                :label="input.name || input.id"
                :required="Boolean(input.expands?.required)"
              >
                <a-select
                  v-if="getValueOptions(input.valueType)?.length"
                  v-model:value="invokeFormValues[input.id]"
                  :options="getValueOptions(input.valueType)"
                  allow-clear
                />
                <a-switch
                  v-else-if="input.valueType?.type === 'boolean'"
                  v-model:checked="invokeFormValues[input.id]"
                />
                <a-input-number
                  v-else-if="isNumberType(input.valueType?.type)"
                  v-model:value="invokeFormValues[input.id]"
                  style="width: 100%"
                />
                <a-textarea
                  v-else-if="input.valueType?.type === 'object' || input.valueType?.type === 'array'"
                  v-model:value="invokeFormValues[input.id]"
                  :rows="3"
                  :placeholder="$t('IotDeviceDetail.trace.inputJson')"
                />
                <a-input
                  v-else
                  v-model:value="invokeFormValues[input.id]"
                />
              </a-form-item>
            </template>
            <a-form-item v-else-if="selectedFunction" :label="$t('IotDeviceDetail.trace.inputParamsJson')">
              <a-textarea
                v-model:value="invokeJsonText"
                :rows="8"
                spellcheck="false"
              />
            </a-form-item>
          </template>
        </a-form>
      </div>

      <footer class="trace-debug__foot">
        <a-button
          type="primary"
          block
          :loading="loading"
          :disabled="!canSend"
          @click="send"
        >
          {{ $t('IotDeviceDetail.trace.sendCommand') }}
        </a-button>
        <div v-if="invokeResult" class="trace-debug-result" :data-success="invokeResult.success">
          <strong>{{ invokeResult.success ? $t('IotDeviceDetail.trace.sendSuccess') : $t('IotDeviceDetail.trace.sendFailed') }}</strong>
          <span>{{ invokeResult.time }}</span>
          <a-button
            v-if="invokeResult.traceId"
            type="link"
            size="small"
            @click="focusTrace(invokeResult.traceId)"
          >
            {{ $t('IotDeviceDetail.trace.viewTrace') }}
          </a-button>
          <pre>{{ invokeResult.payload }}</pre>
        </div>
      </footer>
    </aside>

    <section class="trace-list-panel">
      <header class="trace-list-panel__head">
        <div>
          <AIcon type="BranchesOutlined" aria-hidden="true" />
          <span>{{ $t('IotDeviceDetail.trace.communicationTrace') }}</span>
          <em>{{ $t('IotDeviceDetail.trace.receivedCount', { count: traceReceivedTotal }) }}</em>
        </div>
        <a-space size="small">
          <a-popconfirm :title="$t('IotDeviceDetail.trace.clearConfirm')" @confirm="clearTraces">
            <a-button size="small" :disabled="!traceGroups.length">
              {{ $t('IotDeviceDetail.trace.clear') }}
            </a-button>
          </a-popconfirm>
          <a-button size="small" type="primary" @click="toggleSubscribe">
	          {{ subscribed ? $t('IotDeviceDetail.trace.pause') : $t('IotDeviceDetail.trace.resume') }}
          </a-button>
        </a-space>
      </header>

      <div class="trace-list">
        <div
          v-for="group in sortedGroups"
          :key="group.key"
          class="trace-row"
          :class="{ 'is-active': detailGroup?.key === group.key, 'is-matched': matchedTraceKey === group.key }"
          @click="openDetail(group)"
        >
          <span class="trace-row__dir" :data-direction="group.direction">
            <AIcon :type="group.direction === 'downlink' ? 'ArrowDownOutlined' : 'ArrowUpOutlined'" aria-hidden="true" />
          </span>
          <strong :title="group.title">{{ group.title }}</strong>
          <span :title="group.preview">{{ group.preview }}</span>
          <em :data-error="group.hasError">{{ group.hasError ? $t('IotDeviceDetail.trace.failed') : $t('IotDeviceDetail.trace.success') }}</em>
          <time>{{ formatShortTime(group.lastTime) }}</time>
        </div>
        <CloudEmpty
          v-if="!sortedGroups.length"
          class="trace-empty"
          :description="$t('IotDeviceDetail.trace.emptyTrace')"
        />
      </div>
    </section>

    <JlDrawerShell
      :open="detailOpen"
      :width="760"
      icon="BranchesOutlined"
      :title="$t('IotDeviceDetail.trace.detailTitle')"
      :sub="detailGroup?.traceId || ''"
      @update:open="detailOpen = $event"
    >
      <section v-if="detailGroup" class="trace-detail">
        <div class="trace-detail__meta">
          <span>traceId</span>
          <code>{{ detailGroup.traceId === '_no_trace_' ? '-' : detailGroup.traceId }}</code>
        </div>
        <div class="trace-detail__summary">
          <span>{{ detailGroup.direction === 'downlink' ? $t('IotDeviceDetail.trace.downlink') : $t('IotDeviceDetail.trace.uplink') }}</span>
          <em :data-error="detailGroup.hasError">{{ detailGroup.hasError ? $t('IotDeviceDetail.trace.failed') : $t('IotDeviceDetail.trace.success') }}</em>
          <span>{{ $t('IotDeviceDetail.trace.stepCount', { count: detailGroup.spanCount }) }}</span>
          <span>{{ $t('IotDeviceDetail.trace.logCount', { count: detailGroup.logCount }) }}</span>
          <span v-if="detailGroup.elapsed">{{ $t('IotDeviceDetail.trace.elapsed', { time: detailGroup.elapsed }) }}</span>
        </div>
        <ol class="trace-event-list">
          <li v-for="event in detailGroup.events" :key="event.key" :data-error="event.error">
            <span />
            <article>
              <header>
                <strong>
                  <template v-if="deviceHintParts(event).primary">
                    <span>{{ deviceHintParts(event).primary }}</span>
                    <small v-if="deviceHintParts(event).suffix">{{ deviceHintParts(event).suffix }}</small>
                    <small v-if="event.operation" class="trace-event__op">{{ operationLabel(event.operation) }}</small>
                  </template>
                  <template v-else>
                    {{ operationLabel(event.operation || event.type) }}
                  </template>
                </strong>
                <time>{{ formatEventTime(event) }}{{ formatEventDuration(event) ? ` · ${formatEventDuration(event)}` : '' }}</time>
              </header>
              <p v-if="event.message">{{ event.message }}</p>
              <div v-if="propertyRows(event).length" class="trace-property-block">
                <div class="trace-property-block__head">
                  <strong>{{ $t('IotDeviceDetail.trace.property') }}</strong>
                  <span>{{ $t('IotDeviceDetail.trace.propertyCount', { count: propertyRows(event).length }) }}</span>
                </div>
                <div class="trace-property-list">
                  <div v-for="row in propertyRows(event)" :key="row.id" class="trace-property-item">
                    <strong>{{ row.name }}</strong>
                    <code>{{ row.id }}</code>
                    <span>{{ row.value }}</span>
                  </div>
                </div>
              </div>
              <div v-if="event.detail" class="trace-payload-sections">
                <div
                  v-for="(section, index) in payloadSectionRows(event.detail)"
                  :key="index"
                  class="trace-payload-section"
                  :data-format="section.format"
                >
                  <div class="trace-payload-section__head">
                    <span>{{ section.label }}</span>
                    <em v-if="section.format === 'json'">{{ $t('IotDeviceDetail.trace.formatted') }}</em>
                  </div>
                  <pre>{{ section.text }}</pre>
                </div>
              </div>
            </article>
          </li>
        </ol>
      </section>
    </JlDrawerShell>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, type PropType, reactive, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'

import JlDrawerShell from '../common/JlDrawerShell.vue'
import { formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { IotDevice, IotDeviceCommandDefinition } from '../../types'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import {
  compareIotTraceEvents,
  formatIotTraceEventDuration,
  formatIotTraceEventTime,
  iotTraceGroupLastTime,
  type IotTraceEventItem,
  type IotTraceGroup,
  useIotDeviceTraceLog,
} from './useIotDeviceTraceLog'

type Mode = 'read' | 'write' | 'invoke'
type TraceGroupView = {
  key: string
  traceId: string
  direction: 'uplink' | 'downlink'
  title: string
  preview: string
  hasError: boolean
  lastTime: number
  spanCount: number
  logCount: number
  elapsed: string
  events: IotTraceEventItem[]
  source: IotTraceGroup
}
type DeviceMessageInfo = {
  messageType: string
  deviceId?: string
  properties?: Record<string, unknown>
  propertyIds?: string[]
  functionId?: string
  inputs?: unknown
  event?: string
}
type TracePropertyRow = {
  id: string
  name: string
  value: string
}
type PayloadSectionRow = {
  text: string
  format: 'json' | 'text'
  label: string
}
type DeviceConnectionInfo = {
  address?: string
  pendingMessages?: number | string
  metrics?: {
    readBytes?: number | string
    writeBytes?: number | string
    connectTime?: number | string
    lastCommTime?: number | string
    pendingMessages?: number | string
    droppedMessages?: number | string
  }
}
type DeviceSessionInfo = {
  deviceId?: string
  serverId?: string
  address?: string
  connectTime?: number | string
  lastCommTime?: number | string
  transport?: string
  connections?: DeviceConnectionInfo[] | null
}
type MergedConnectionInfo = DeviceConnectionInfo & {
  serverId?: string
  session: DeviceSessionInfo
}

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  properties: { type: Array as PropType<RealtimePropertyRow[]>, required: true },
  commands: { type: Array as PropType<IotDeviceCommandDefinition[]>, required: true },
  hideSession: { type: Boolean, default: false },
})

const { t: $t } = useI18n()

const mode = ref<Mode>('read')
const loading = ref(false)
const subscribed = ref(true)
const traceReceivedTotal = ref(0)
const seenTraceKeys = new Set<string>()
const matchedTraceKey = ref('')
const detailOpen = ref(false)
const detailGroup = ref<TraceGroupView | null>(null)
const readPropertyIds = ref<string[]>([])
const writePropertyId = ref<string>()
const writeValue = ref<any>()
const functionId = ref<string>()
const invokeInputMode = ref<'form' | 'json'>('form')
const invokeFormValues = reactive<Record<string, any>>({})
const invokeJsonText = ref('{}')
const invokeResult = ref<{ success: boolean; time: string; traceId?: string; payload: string } | null>(null)
const TRACE_DEBUG_MEMORY_KEY = 'jetlinks:iot-device-trace-debug-memory:v1'
const deviceIdRef = computed(() => props.device.id || undefined)
const { traceGroups, subscribe, unsubscribe, clear } = useIotDeviceTraceLog(deviceIdRef)
const sessions = ref<DeviceSessionInfo[]>([])
const sessionsLoading = ref(false)
const sessionsRequesting = ref(false)
const selectedConnectionIndex = ref(0)
let matchedTimer: ReturnType<typeof setTimeout> | undefined
let sessionAutoRefreshTimer: ReturnType<typeof setTimeout> | null = null
let lastSessionAutoRefreshAt = 0

const modeOptions = [
  { label: $t('IotDeviceDetail.trace.mode.read'), value: 'read' },
  { label: $t('IotDeviceDetail.trace.mode.write'), value: 'write' },
  { label: $t('IotDeviceDetail.trace.mode.invoke'), value: 'invoke' },
]
const invokeModeOptions = [
  { label: $t('IotDeviceDetail.trace.mode.form'), value: 'form' },
  { label: 'JSON', value: 'json' },
]
const OPERATION_LABELS: Record<string, string> = {
  connection: $t('IotDeviceDetail.trace.operation.connection'),
  disconnect: $t('IotDeviceDetail.trace.operation.disconnect'),
  sessionCreated: $t('IotDeviceDetail.trace.operation.sessionCreated'),
  sessionClosed: $t('IotDeviceDetail.trace.operation.sessionClosed'),
  auth: $t('IotDeviceDetail.trace.operation.auth'),
  principal: $t('IotDeviceDetail.trace.operation.principal'),
  decode: $t('IotDeviceDetail.trace.operation.decode'),
  encode: $t('IotDeviceDetail.trace.operation.encode'),
  request: $t('IotDeviceDetail.trace.operation.request'),
  response: $t('IotDeviceDetail.trace.operation.response'),
  downstream: $t('IotDeviceDetail.trace.operation.downstream'),
  upstream: $t('IotDeviceDetail.trace.operation.upstream'),
  handle: $t('IotDeviceDetail.trace.operation.handle'),
  log: $t('IotDeviceDetail.trace.operation.log'),
}
const MESSAGE_TYPE_LABELS: Record<string, string> = {
  REPORT_PROPERTY: $t('IotDeviceDetail.trace.messageType.reportProperty'),
  READ_PROPERTY: $t('IotDeviceDetail.trace.messageType.readProperty'),
  READ_PROPERTY_REPLY: $t('IotDeviceDetail.trace.messageType.readPropertyReply'),
  WRITE_PROPERTY: $t('IotDeviceDetail.trace.messageType.writeProperty'),
  WRITE_PROPERTY_REPLY: $t('IotDeviceDetail.trace.messageType.writePropertyReply'),
  INVOKE_FUNCTION: $t('IotDeviceDetail.trace.messageType.invokeFunction'),
  INVOKE_FUNCTION_REPLY: $t('IotDeviceDetail.trace.messageType.invokeFunctionReply'),
  EVENT: $t('IotDeviceDetail.trace.messageType.event'),
  EVENT_REPORT: $t('IotDeviceDetail.trace.messageType.event'),
  ONLINE: $t('IotDeviceDetail.trace.messageType.online'),
  OFFLINE: $t('IotDeviceDetail.trace.messageType.offline'),
  REGISTER: $t('IotDeviceDetail.trace.messageType.register'),
  CHILD: $t('IotDeviceDetail.trace.messageType.child'),
  CHILD_DEVICE_MESSAGE: $t('IotDeviceDetail.trace.messageType.child'),
}
const MESSAGE_TYPE_NORMALIZE: Record<string, string> = {
  EVENT_REPORT: 'EVENT',
  CHILD_DEVICE_MESSAGE: 'CHILD',
}

const isOnline = computed(() => props.device.status === 'online')
const readPropsList = computed(() => props.properties.filter((item) => item.accessMode === 'read' || item.accessMode === 'readwrite'))
const writePropsList = computed(() => props.properties.filter((item) => item.writable || item.accessMode === 'write' || item.accessMode === 'readwrite'))
const readPropertyOptions = computed(() => readPropsList.value.map((item) => ({ label: `${item.name} (${item.identifier})`, value: item.identifier })))
const writePropertyOptions = computed(() => writePropsList.value.map((item) => ({ label: `${item.name} (${item.identifier})`, value: item.identifier })))
const functionOptions = computed(() => props.commands.map((item) => ({ label: `${item.name} (${item.identifier})`, value: item.identifier })))
const selectedFunction = computed(() => props.commands.find((item) => item.identifier === functionId.value || item.id === functionId.value))
const invokeInputDefs = computed(() => selectedFunction.value?.inputParams.map((item) => ({
  id: item.key,
  name: item.name,
  valueType: { type: item.type, elements: item.options },
  expands: { required: item.required },
})) ?? [])
const selectedWriteProperty = computed(() => writePropsList.value.find((item) => item.identifier === writePropertyId.value))
const writeValueType = computed(() => selectedWriteProperty.value?.valueType?.type || selectedWriteProperty.value?.dataType || 'string')
const writeValueOptions = computed(() => getValueOptions(selectedWriteProperty.value?.valueType))
const hasAnyCapability = computed(() => readPropsList.value.length > 0 || writePropsList.value.length > 0 || props.commands.length > 0)
const canSend = computed(() => {
  if (!isOnline.value) return false
  if (loading.value) return false
  if (mode.value === 'read') return readPropertyIds.value.length > 0
  if (mode.value === 'write') return Boolean(writePropertyId.value)
  return Boolean(functionId.value)
})
const connectionList = computed<MergedConnectionInfo[]>(() => {
  const list: MergedConnectionInfo[] = []
  for (const session of sessions.value) {
    if (Array.isArray(session.connections) && session.connections.length) {
      for (const conn of session.connections) {
        list.push({
          ...conn,
          serverId: session.serverId,
          session,
        })
      }
    }
  }
  return list
})
const activeSession = computed<DeviceSessionInfo | null>(() => sessions.value[0] ?? null)
const currentConnection = computed<MergedConnectionInfo | null>(() => {
  const list = connectionList.value
  if (!list.length) return null
  const idx = Math.min(Math.max(0, selectedConnectionIndex.value), list.length - 1)
  return list[idx] || null
})
const displaySession = computed(() => currentConnection.value?.session || activeSession.value)
const displayAddress = computed(() => currentConnection.value?.address || activeSession.value?.address || '')
const displayPendingMessages = computed<number | string | null>(() => {
  const fromConn = currentConnection.value?.pendingMessages
  if (fromConn !== undefined && fromConn !== null && fromConn !== '') return fromConn
  const fromMetric = currentConnection.value?.metrics?.pendingMessages
  if (fromMetric !== undefined && fromMetric !== null && fromMetric !== '') return fromMetric
  return null
})
const displayConnectTime = computed(() => currentConnection.value?.metrics?.connectTime || activeSession.value?.connectTime)
const displayLastCommTime = computed(() => currentConnection.value?.metrics?.lastCommTime || activeSession.value?.lastCommTime)
const connectionCountHint = computed(() => {
  if (connectionList.value.length > 1) return $t('IotDeviceDetail.trace.connectionCount', { count: connectionList.value.length })
  if (sessions.value.length > 1) return $t('IotDeviceDetail.trace.sessionCount', { count: sessions.value.length })
  return ''
})
const sortedGroups = computed<TraceGroupView[]>(() =>
  traceGroups.value
    .map(buildTraceGroupView)
    .sort((a, b) => b.lastTime - a.lastTime),
)

function startSubscribe() {
  if (!subscribed.value || !props.device.id) return
  subscribe()
}

function stopSubscribe() {
  unsubscribe()
}

function toggleSubscribe() {
  subscribed.value = !subscribed.value
  if (subscribed.value) startSubscribe()
  else stopSubscribe()
}

function clearTraces() {
  clear()
  traceReceivedTotal.value = 0
  seenTraceKeys.clear()
  detailOpen.value = false
  detailGroup.value = null
}

function normalizeTraceId(value: unknown) {
  const text = String(value ?? '').replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  return text.length === 32 ? text : ''
}

function firstText(values: unknown[]) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function operationLabel(operation?: string) {
  if (!operation) return $t('IotDeviceDetail.trace.operation.traceEvent')
  return OPERATION_LABELS[operation] || operation
}

function normalizeMessageType(raw?: string) {
  if (!raw) return ''
  const key = String(raw).trim().replace(/[\s-]+/g, '_').toUpperCase()
  return MESSAGE_TYPE_NORMALIZE[key] || key
}

function messageTypeLabel(raw?: string) {
  const key = normalizeMessageType(raw)
  return key ? MESSAGE_TYPE_LABELS[key] || key : ''
}

function tryParseJson(text: string) {
  const value = text.trim()
  if (!value || (value[0] !== '{' && value[0] !== '[')) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function payloadSections(detail?: string) {
  if (!detail) return []
  const sections = String(detail)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
  return sections.length ? sections : [String(detail)]
}

function formatPayloadSection(section: string): PayloadSectionRow {
  const text = String(section)
  const parsed = tryParseJson(text)
  if (parsed !== undefined) {
    return {
      text: JSON.stringify(parsed, null, 2),
      format: 'json',
      label: 'JSON',
    }
  }
  return {
    text,
    format: 'text',
    label: $t('IotDeviceDetail.trace.text'),
  }
}

function payloadSectionRows(detail?: string): PayloadSectionRow[] {
  return payloadSections(detail).map(formatPayloadSection)
}

function parseDeviceMessageFromDetail(detail?: string): DeviceMessageInfo | undefined {
  if (!detail) return undefined
  for (const section of payloadSections(detail)) {
    const parsed = tryParseJson(section)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const messageType = normalizeMessageType(parsed.messageType || parsed.message_type || parsed.message?.messageType)
    if (!messageType) continue
    return {
      messageType,
      deviceId: parsed.deviceId,
      properties: parsed.properties && typeof parsed.properties === 'object' && !Array.isArray(parsed.properties)
        ? parsed.properties
        : undefined,
      propertyIds: Array.isArray(parsed.properties)
        ? parsed.properties.filter((item: unknown) => typeof item === 'string')
        : Array.isArray(parsed.propertyIds)
          ? parsed.propertyIds.filter((item: unknown) => typeof item === 'string')
          : undefined,
      functionId: parsed.functionId,
      inputs: parsed.inputs,
      event: parsed.event,
    }
  }
  return undefined
}

function eventMessageInfo(event: IotTraceEventItem): DeviceMessageInfo | undefined {
  const fromFields = normalizeMessageType((event as Record<string, any>).messageType || (event as Record<string, any>).message_type)
  if (fromFields) return { messageType: fromFields }
  return parseDeviceMessageFromDetail(event.detail)
}

function pickMessageType(events: IotTraceEventItem[]) {
  for (const event of events) {
    const info = eventMessageInfo(event)
    if (info?.messageType) return info.messageType
  }
  return ''
}

function propertyName(id: string) {
  return props.properties.find((item) => item.identifier === id)?.name || id
}

function formatPayloadValue(value: unknown) {
  if (value == null) return '-'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function propertyRows(event: IotTraceEventItem): TracePropertyRow[] {
  const info = eventMessageInfo(event)
  if (!info?.properties) return []
  return Object.entries(info.properties).map(([id, value]) => ({
    id,
    name: propertyName(id),
    value: formatPayloadValue(value),
  }))
}

function deviceHintParts(event: IotTraceEventItem) {
  const info = eventMessageInfo(event)
  if (!info) return { primary: '', suffix: '' }
  const primary = messageTypeLabel(info.messageType)
  if (info.properties) {
    const count = Object.keys(info.properties).length
    return { primary, suffix: count ? $t('IotDeviceDetail.trace.propertyCount', { count }) : '' }
  }
  if (info.propertyIds?.length) return { primary, suffix: $t('IotDeviceDetail.trace.propertyCount', { count: info.propertyIds.length }) }
  if (info.functionId) return { primary, suffix: info.functionId }
  if (info.event) return { primary, suffix: info.event }
  return { primary, suffix: '' }
}

function rawPayloadPreview(events: IotTraceEventItem[]) {
  const preferred = [...events].reverse().find((event) => {
    if (!event.detail) return false
    return ['decode', 'encode', 'request', 'response'].includes(String(event.operation))
  })
  const raw = preferred?.detail || [...events].reverse().find((event) => event.detail)?.detail
  if (!raw) return '-'
  const firstLine = String(raw).split(/\r?\n/).find((line) => line.trim())
  return firstLine?.trim() || '-'
}

function groupElapsed(events: IotTraceEventItem[]) {
  const starts = events.map((event) => Number(event.startTime || 0)).filter((item) => item > 0)
  const ends = events.map((event) => Number(event.endTime || event.startTime || 0)).filter((item) => item > 0)
  if (!starts.length || !ends.length) return ''
  const elapsed = Math.max(...ends) - Math.min(...starts)
  if (!Number.isFinite(elapsed) || elapsed < 0) return ''
  if (elapsed >= 1000) return `${(elapsed / 1000).toFixed(3).replace(/\.?0+$/, '')}s`
  return `${Math.round(elapsed)}ms`
}

function resolveDirection(group: IotTraceGroup): 'uplink' | 'downlink' {
  if (typeof group.upstream === 'boolean') return group.upstream ? 'uplink' : 'downlink'
  if (typeof group.downstream === 'boolean') return group.downstream ? 'downlink' : 'uplink'
  const sorted = [...group.events].sort(compareIotTraceEvents)
  const first = sorted.find((event) => event.type !== 'log') || sorted[0]
  if (first?.operation === 'request' || first?.operation === 'encode' || first?.downstream) return 'downlink'
  return 'uplink'
}

function resolveTraceTitle(events: IotTraceEventItem[]) {
  const chain = events
    .filter((event) => event.type !== 'log')
    .map((event) => operationLabel(event.operation || event.type))
    .filter(Boolean)
    .join(' → ')
  const type = messageTypeLabel(pickMessageType(events))
  if (chain && type) return `${chain} · ${type}`
  return chain || type || $t('IotDeviceDetail.trace.message')
}

function buildTraceGroupView(group: IotTraceGroup): TraceGroupView {
  const events = [...group.events].sort(compareIotTraceEvents)
  const spanCount = events.filter((event) => event.type !== 'log').length
  const logCount = events.filter((event) => event.type === 'log').length
  return {
    key: group.key,
    traceId: group.traceId,
    direction: resolveDirection(group),
    title: resolveTraceTitle(events),
    preview: rawPayloadPreview(events),
    hasError: events.some((event) => event.error),
    lastTime: iotTraceGroupLastTime(group),
    spanCount,
    logCount,
    elapsed: groupElapsed(events),
    events,
    source: group,
  }
}

function openDetail(group: TraceGroupView) {
  detailGroup.value = group
  detailOpen.value = true
}

function focusTrace(traceId: string) {
  const normalized = normalizeTraceId(traceId) || traceId
  const group = sortedGroups.value.find((item) => item.traceId === normalized || normalizeTraceId(item.traceId) === normalized)
  if (!group) return
  matchedTraceKey.value = group.key
  openDetail(group)
  if (matchedTimer) clearTimeout(matchedTimer)
  matchedTimer = setTimeout(() => {
    matchedTraceKey.value = ''
  }, 1800)
}

function getValueOptions(valueType: any) {
  const type = valueType?.type
  if (type === 'enum') {
    return (valueType?.elements || []).map((item: any) => ({ label: item?.text || item?.label, value: item?.value }))
  }
  if (type === 'boolean') {
    return [
      { label: valueType?.falseText || $t('IotDeviceDetail.common.no'), value: valueType?.falseValue ?? false },
      { label: valueType?.trueText || $t('IotDeviceDetail.common.yes'), value: valueType?.trueValue ?? true },
    ]
  }
  return undefined
}

function isNumberType(type?: string) {
  return ['int', 'long', 'float', 'double', 'number'].includes(String(type))
}

function onWritePropertyChange() {
  const type = writeValueType.value
  if (type === 'boolean') writeValue.value = writeValueOptions.value?.[0]?.value ?? false
  else if (isNumberType(type)) writeValue.value = 0
  else if (type === 'array') writeValue.value = '[]'
  else if (type === 'object') writeValue.value = '{}'
  else writeValue.value = undefined
}

function onFunctionChange() {
  Object.keys(invokeFormValues).forEach((key) => delete invokeFormValues[key])
  for (const input of invokeInputDefs.value) {
    invokeFormValues[input.id] = defaultValueForInput(input)
  }
  syncInvokeJson()
}

function defaultValueForInput(input: any) {
  const type = input?.valueType?.type
  if (type === 'boolean') return getValueOptions(input.valueType)?.[0]?.value ?? false
  if (type === 'enum') return getValueOptions(input.valueType)?.[0]?.value ?? ''
  if (isNumberType(type)) return 0
  if (type === 'array') return []
  if (type === 'object') return {}
  return ''
}

function buildInvokePayloadFromForm() {
  const payload: Record<string, any> = {}
  for (const input of invokeInputDefs.value) {
    const value = invokeFormValues[input.id]
    if (value === undefined || value === null || value === '') continue
    if ((input.valueType?.type === 'object' || input.valueType?.type === 'array') && typeof value === 'string') {
      payload[input.id] = JSON.parse(value)
    } else {
      payload[input.id] = value
    }
  }
  return payload
}

function syncInvokeJson() {
  invokeJsonText.value = JSON.stringify(buildInvokePayloadFromForm(), null, 2)
}

function normalizeByCurrentMetadata() {
  const readSet = new Set(readPropsList.value.map((item) => String(item.identifier)))
  const writeSet = new Set(writePropsList.value.map((item) => String(item.identifier)))
  const functionSet = new Set(props.commands.flatMap((item) => [String(item.identifier), String(item.id)]))

  readPropertyIds.value = readPropertyIds.value.filter((id) => readSet.has(String(id)))
  if (!writePropertyId.value || !writeSet.has(String(writePropertyId.value))) {
    writePropertyId.value = undefined
    writeValue.value = undefined
  }
  if (!functionId.value || !functionSet.has(String(functionId.value))) {
    functionId.value = undefined
    Object.keys(invokeFormValues).forEach((key) => delete invokeFormValues[key])
    invokeJsonText.value = '{}'
    invokeInputMode.value = 'form'
  }
}

function loadMemoryForCurrentDevice() {
  if (!props.device.id) return
  try {
    const raw = localStorage.getItem(TRACE_DEBUG_MEMORY_KEY)
    if (!raw) return
    const entry = JSON.parse(raw)?.[props.device.id]
    if (!entry) return
    mode.value = ['read', 'write', 'invoke'].includes(entry.mode) ? entry.mode : 'read'
    readPropertyIds.value = Array.isArray(entry.readPropertyIds) ? entry.readPropertyIds : []
    writePropertyId.value = entry.writePropertyId || undefined
    writeValue.value = entry.writeValue
    functionId.value = entry.functionId || undefined
    invokeInputMode.value = entry.invokeInputMode === 'json' ? 'json' : 'form'
    invokeJsonText.value = typeof entry.invokeJsonText === 'string' ? entry.invokeJsonText : '{}'
    Object.keys(invokeFormValues).forEach((key) => delete invokeFormValues[key])
    if (entry.invokeFormValues && typeof entry.invokeFormValues === 'object') {
      Object.assign(invokeFormValues, entry.invokeFormValues)
    }
    normalizeByCurrentMetadata()
  } catch {
    // ignore corrupted local memory
  }
}

function saveMemoryForCurrentDevice() {
  if (!props.device.id) return
  try {
    const raw = localStorage.getItem(TRACE_DEBUG_MEMORY_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[props.device.id] = {
      mode: mode.value,
      readPropertyIds: [...readPropertyIds.value],
      writePropertyId: writePropertyId.value,
      writeValue: toRaw(writeValue.value),
      functionId: functionId.value,
      invokeInputMode: invokeInputMode.value,
      invokeFormValues: toRaw(invokeFormValues),
      invokeJsonText: invokeJsonText.value,
      updatedAt: Date.now(),
    }
    localStorage.setItem(TRACE_DEBUG_MEMORY_KEY, JSON.stringify(all))
  } catch {
    // ignore localStorage write errors
  }
}

function extractTraceId(resp: any) {
  const text = safePayloadText(resp)
  const traceparent = /([0-9a-fA-F]{2}-[0-9a-fA-F]{32}-[0-9a-fA-F]{16}-[0-9a-fA-F]{2})/.exec(text)?.[1]
  if (traceparent) return traceparent.split('-')[1]?.toLowerCase()
  return normalizeTraceId(resp?.result?.traceId || resp?.traceId || resp?.headers?.traceparent)
}

function safePayloadText(resp: any) {
  const payload = resp?.result ?? resp?.data ?? resp
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

async function send() {
  let data: Record<string, any>
  try {
    if (mode.value === 'read') {
      data = {
        deviceId: props.device.id,
        messageType: 'READ_PROPERTY',
        properties: [...readPropertyIds.value],
      }
    } else if (mode.value === 'write') {
      if (!writePropertyId.value) return
      let nextValue = toRaw(writeValue.value)
      if ((writeValueType.value === 'object' || writeValueType.value === 'array') && typeof nextValue === 'string') {
        nextValue = JSON.parse(nextValue)
      }
      data = {
        deviceId: props.device.id,
        messageType: 'WRITE_PROPERTY',
        properties: {
          [writePropertyId.value]: nextValue,
        },
      }
    } else {
      if (!functionId.value) return
      const inputs = invokeInputMode.value === 'json'
        ? JSON.parse(invokeJsonText.value.trim() || '{}')
        : buildInvokePayloadFromForm()
      data = {
        deviceId: props.device.id,
        messageType: 'INVOKE_FUNCTION',
        functionId: functionId.value,
        inputs,
      }
    }
  } catch {
    message.error($t('IotDeviceDetail.trace.invalidJson'))
    return
  }

  loading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.sendDeviceMessage(props.device.id, data)
    const success = resp?.success === true || resp?.status === 200
    if (success) message.success($t('IotDeviceDetail.trace.sendSuccess'))
    invokeResult.value = {
      success,
      time: formatTime(Date.now()),
      traceId: extractTraceId(resp),
      payload: safePayloadText(resp),
    }
    if (invokeResult.value.traceId) focusTrace(invokeResult.value.traceId)
  } finally {
    loading.value = false
  }
}

function formatTime(value: unknown) {
  return formatApiTime(value, '-')
}

function formatEventTime(event: IotTraceEventItem) {
  return formatIotTraceEventTime(event)
}

function formatEventDuration(event: IotTraceEventItem) {
  return formatIotTraceEventDuration(event)
}

function formatShortTime(value: unknown) {
  const full = formatTime(value)
  return full.length > 8 ? full.slice(-8) : full
}

function formatBytes(value?: string | number) {
  if (value === undefined || value === null || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return String(value)
  if (num < 1024) return `${Math.round(num)} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(2)} KB`
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB`
  return `${(num / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

async function loadSessions(showTip = false, showLoadingMask = true) {
  if (!props.device.id || sessionsRequesting.value) return
  sessionsRequesting.value = true
  if (showLoadingMask) sessionsLoading.value = true
  try {
    const resp: any = await iotDeviceDetailRealApi.getDeviceSessions(props.device.id)
    if (resp?.status === 200 || resp?.success === true) {
      sessions.value = resp.result || []
      selectedConnectionIndex.value = 0
      if (showTip) message.success($t('IotDeviceDetail.trace.connectionRefreshed'))
    } else {
      sessions.value = []
      if (showTip) message.error($t('IotDeviceDetail.trace.connectionRefreshFailed'))
    }
  } catch {
    if (showTip) message.error($t('IotDeviceDetail.trace.connectionRefreshFailed'))
  } finally {
    sessionsRequesting.value = false
    if (showLoadingMask) sessionsLoading.value = false
  }
}

function scheduleSessionAutoRefresh() {
  if (!isOnline.value || !props.device.id) return
  const now = Date.now()
  const remain = 1000 - (now - lastSessionAutoRefreshAt)
  const run = () => {
    if (sessionsRequesting.value) return
    lastSessionAutoRefreshAt = Date.now()
    loadSessions(false, false)
  }
  if (remain <= 0) {
    run()
    return
  }
  if (!sessionAutoRefreshTimer) {
    sessionAutoRefreshTimer = setTimeout(() => {
      sessionAutoRefreshTimer = null
      run()
    }, remain)
  }
}

function ingestNewTraceKeys() {
  for (const group of traceGroups.value) {
    if (seenTraceKeys.has(group.key)) continue
    seenTraceKeys.add(group.key)
    traceReceivedTotal.value += 1
  }
}

watch(
  () => props.device.id,
  () => {
    clearTraces()
    startSubscribe()
    loadMemoryForCurrentDevice()
    if (isOnline.value) loadSessions()
  },
  { immediate: true },
)

watch(
  () => props.device.status,
  (value, oldValue) => {
    if (value === oldValue) return
    if (value === 'online') {
      loadSessions()
    } else {
      sessions.value = []
      if (sessionAutoRefreshTimer) {
        clearTimeout(sessionAutoRefreshTimer)
        sessionAutoRefreshTimer = null
      }
    }
  },
)

watch(
  () => traceGroups.value.map((group) => `${group.key}:${group.version ?? 0}`).join('|'),
  () => {
    ingestNewTraceKeys()
    if (traceGroups.value.length) scheduleSessionAutoRefresh()
  },
  { immediate: true },
)

watch(invokeInputMode, (value, oldValue) => {
  if (value === 'json' && oldValue !== 'json') syncInvokeJson()
})

watch(
  [
    mode,
    readPropertyIds,
    writePropertyId,
    writeValue,
    functionId,
    invokeInputMode,
    invokeFormValues,
    invokeJsonText,
  ],
  () => saveMemoryForCurrentDevice(),
  { deep: true },
)

watch(
  () => [props.properties, props.commands],
  () => normalizeByCurrentMetadata(),
  { deep: true },
)

onMounted(() => {
  if (isOnline.value) loadSessions()
})

onUnmounted(() => {
  stopSubscribe()
  if (sessionAutoRefreshTimer) clearTimeout(sessionAutoRefreshTimer)
  if (matchedTimer) clearTimeout(matchedTimer)
})
</script>

<style scoped src="./IotDeviceTraceTab.css"></style>
