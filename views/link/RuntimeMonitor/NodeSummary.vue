<template>
  <a-popover :open="open" :trigger="['hover']" placement="rightTop" :mouse-enter-delay="0.3" :auto-adjust-overflow="true" @open-change="onOpenChange">
    <template #content>
      <div ref="popoverContent" class="node-popover" tabindex="-1" @focusout="onFocusOut" @keydown.esc.stop.prevent="closeDetails" @click.stop>
        <div class="node-popover-heading"><strong>{{ nodeId }}</strong><span class="node-popover-status" :title="statusDescription">{{ statusLabel }}</span></div>
        <div v-if="hasData" class="node-popover-resources">
          <div v-for="resource in resourceRows" :key="resource.label" class="node-popover-resource"><strong>{{ resource.label }}</strong><span v-if="available(resource.cpu)">CPU <b>{{ resource.cpu!.toFixed(1) }}%</b></span><NodeResourceMeter v-if="available(resource.used, resource.total)" :label="t('runtimeDiagnostics.memory')" :percent="resource.percent" :used="resource.used" :total="resource.total" capacity dense /></div>
        </div>
        <div v-if="hasData" class="node-popover-io"><span v-if="available(live?.diskUsed, live?.diskTotal)">{{ t('components.RealtimeResource.disk') }} {{ capacity(live?.diskUsed, live?.diskTotal) }}</span><span v-if="available(live?.networkReceiveBytesPerSecond)">{{ t('components.RealtimeResource.networkDownload') }} {{ networkRate(live!.networkReceiveBytesPerSecond!) }}</span><span v-if="available(live?.networkSendBytesPerSecond)">{{ t('components.RealtimeResource.networkUpload') }} {{ networkRate(live!.networkSendBytesPerSecond!) }}</span></div>
        <div v-for="item in hasData ? live?.health.evidence ?? [] : []" :key="item.signal" class="node-evidence" :style="{ color: item.level === 'critical' ? token.colorError : token.colorWarning }">{{ t(`components.RealtimeResource.health.signal.${item.signal}`, item.values) }}</div>
        <div v-if="popoverSessionVisible" class="node-popover-sessions"><strong>{{ t(upstream !== undefined ? 'RuntimeMonitor.deviceRuntime' : 'RuntimeMonitor.sessionOverview') }}</strong><a-tooltip :title="t(session?.supported === true ? 'RuntimeMonitor.sessionInfo' : 'RuntimeMonitor.deviceRuntimeHelp')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t('RuntimeMonitor.deviceRuntimeHelp')" /></a-tooltip><span v-if="sessionCount">{{ t('RuntimeMonitor.sessionLocal') }} <b>{{ sessionCount }}</b></span><span v-if="keepOnlineCount">{{ t('RuntimeMonitor.sessionKeepOnline') }} <b>{{ keepOnlineCount }}</b></span><span v-if="upstreamText">{{ upstreamText }}</span><small v-if="devicePreviewStale">{{ t('runtimeDiagnostics.nodeStale') }}</small></div>
        <NodeBufferDetails v-if="buffer" :snapshot="buffer" :can-open="canOpenBuffer" @open-queue="openQueue" @open-buffers="openBuffers" />
      </div>
    </template>
    <div ref="trigger" class="node-summary" tabindex="0" :aria-expanded="open" @focus="onFocus" @blur="onFocusOut" @keydown.enter.stop.prevent="openDetails" @keydown.space.stop.prevent="openDetails" @keydown.esc.stop.prevent="closeDetails" :aria-label="`${label} · ${statusLabel}`" :style="{ '--node-warning': token.colorWarning, '--node-error': token.colorError }">
      <div class="node-summary-title"><strong :title="nodeId">{{ label }}</strong><a-badge :status="status" :aria-label="statusLabel" /></div>
      <template v-if="hasData">
        <div v-if="available(live?.cpuJvm, live?.memoryJvm, live?.memoryJvmUsed, live?.memoryJvmTotal)" class="node-summary-row"><span>JVM</span><NodeResourceMeter v-if="available(live?.cpuJvm)" class="node-summary-cpu" label="CPU" :percent="live?.cpuJvm" dense /><NodeResourceMeter v-if="available(live?.memoryJvm, live?.memoryJvmUsed, live?.memoryJvmTotal)" class="node-summary-memory" :label="t('runtimeDiagnostics.heap')" :percent="live?.memoryJvm" :used="live?.memoryJvmUsed" :total="live?.memoryJvmTotal" capacity dense /></div>
        <div v-if="available(live?.cpuSystem, live?.memorySystem, live?.memorySystemUsed, live?.memorySystemTotal)" class="node-summary-row"><span>{{ t('components.RealtimeResource.system') }}</span><NodeResourceMeter v-if="available(live?.cpuSystem)" class="node-summary-cpu" label="CPU" :percent="live?.cpuSystem" dense /><NodeResourceMeter v-if="available(live?.memorySystem, live?.memorySystemUsed, live?.memorySystemTotal)" class="node-summary-memory" :label="t('runtimeDiagnostics.memory')" :percent="live?.memorySystem" :used="live?.memorySystemUsed" :total="live?.memorySystemTotal" capacity dense /></div>
      </template>
      <div v-else class="node-summary-empty">{{ t(waiting ? 'runtimeDiagnostics.waitingMonitoringData' : 'runtimeDiagnostics.noMonitoringData') }}</div>
      <span v-if="devicePreview" class="node-summary-session" :class="{ 'node-summary-session--stale': devicePreviewStale }" :title="devicePreviewTitle" :aria-label="devicePreview"><span v-if="sessionVisible"><LinkOutlined aria-hidden="true" />{{ sessionCount }}</span><span v-if="upstream !== undefined"><UploadOutlined aria-hidden="true" />{{ upstream.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}/s</span><span v-if="communicationQps !== undefined"><ApiOutlined aria-hidden="true" />{{ communicationQps.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}/s</span></span>
      <div v-if="buffer?.hasBacklog" class="node-summary-buffer" :class="{ 'node-summary-buffer--failed': buffer.queues.some(queue => (queue.dead ?? 0) > 0) }"><span>Buffer</span><span v-if="buffer.pending !== undefined && buffer.pending > 0">{{ t('runtimeDiagnostics.queue.pending') }} {{ quantity(buffer.pending) }}</span><span v-if="buffer.dead !== undefined && buffer.dead > 0">{{ t('runtimeDiagnostics.queue.dead') }} {{ quantity(buffer.dead) }}</span><span v-if="buffer.pending === undefined || buffer.dead === undefined">{{ t('RuntimeMonitor.bufferBacklogQueues', { count: buffer.queues.filter(queue => (queue.pending ?? 0) > 0 || (queue.dead ?? 0) > 0).length }) }}</span><small v-if="buffer.state.status === 'stale'">{{ t('runtimeDiagnostics.nodeStale') }}</small></div>
    </div>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { InfoCircleOutlined, LinkOutlined, UploadOutlined, ApiOutlined } from '@ant-design/icons-vue'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import NodeResourceMeter from '../diagnostics/NodeResourceMeter.vue'
import { hasNodeMonitoringData } from './nodeSummary'
import type { ClusterBufferSnapshot } from './useClusterBuffers'
import NodeBufferDetails from './NodeBufferDetails.vue'
import { bufferQuantity as quantity } from './nodeBufferOverview'
import { formatMemorySize } from '../../../visDashboard/SystemMonitor/utils/monitorData'
import { formatNetworkSize } from '../../../visDashboard/SystemMonitor/utils/networkData'
import type { NodeSessionSnapshot } from './useClusterSessions'
import { latestDeviceMessageRates, type DeviceMessageSample } from './device-runtime/deviceMessageHistory'
import { deviceQpsSummary } from './device-runtime/deviceQps'
const props = defineProps({ nodeId: { type: String, required: true }, label: { type: String, required: true }, live: { type: Object as PropType<RealtimeNode>, default: undefined }, stale: { type: Boolean, default: false }, waiting: { type: Boolean, default: false }, buffer: { type: Object as PropType<ClusterBufferSnapshot>, default: undefined }, session: { type: Object as PropType<NodeSessionSnapshot>, default: undefined }, canOpenBuffer: { type: Boolean, default: false } })
const { t } = useI18n(), { token } = theme.useToken()
const emit = defineEmits<{ openQueue: [target: { nodeId: string; objectName: string }]; openBuffers: [nodeId: string] }>()
const open = ref(false), trigger = ref<HTMLElement>(), popoverContent = ref<HTMLElement>(), keyboardFocus = ref(false)
let restoringFocus = false
const focusInside = () => [trigger.value, popoverContent.value].some(element => element?.contains(document.activeElement))
// 鼠标离开触发器时，已经进入浮层的键盘焦点仍可操作，不由hover关闭。
function onOpenChange(value: boolean) { if (value) open.value = true; else void nextTick(() => { if (!focusInside()) open.value = false }) }
function onFocus() { if (!restoringFocus) open.value = true }
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || ![trigger.value, popoverContent.value].some(element => element?.contains(next))) open.value = false
}
function openDetails() { keyboardFocus.value = true; open.value = true }
// Escape恢复触发器焦点但不立即重开；Tab仍按原生顺序进出浮层。
function closeDetails() { open.value = false; keyboardFocus.value = false; restoringFocus = true; trigger.value?.focus(); void nextTick(() => { restoringFocus = false }) }
watch([open, popoverContent, keyboardFocus], () => {
  if (open.value && popoverContent.value && keyboardFocus.value) void nextTick(() => {
    if (!open.value || !keyboardFocus.value) return
    keyboardFocus.value = false
    const content = popoverContent.value
    ;(content?.querySelector<HTMLElement>('button, summary') ?? content)?.focus()
  })
})
function openQueue(objectName: string) { emit('openQueue', { nodeId: props.nodeId, objectName }); closeDetails() }
function openBuffers() { emit('openBuffers', props.nodeId); closeDetails() }
const available = (...values: Array<number | undefined>) => values.some(value => value !== undefined && Number.isFinite(value) && value >= 0)
const resourceRows = computed(() => [
  { label: 'JVM', cpu: props.live?.cpuJvm, percent: props.live?.memoryJvm, used: props.live?.memoryJvmUsed, total: props.live?.memoryJvmTotal },
  { label: t('components.RealtimeResource.system'), cpu: props.live?.cpuSystem, percent: props.live?.memorySystem, used: props.live?.memorySystemUsed, total: props.live?.memorySystemTotal },
].filter(resource => available(resource.cpu, resource.used, resource.total)))
const capacity = (used?: number, total?: number) => [used, total].filter((value): value is number => value !== undefined && Number.isFinite(value) && value >= 0).map(value => formatMemorySize(value)).join(' / ')
const networkRate = (value: number) => `${formatNetworkSize(value)}/s`
const hasData = computed(() => hasNodeMonitoringData(props.live))
const session = computed(() => props.session)
function sessionQuantity(value: string | undefined) { return value && /^\d+$/.test(value) ? BigInt(value).toLocaleString() : undefined }
const sessionCount = computed(() => sessionQuantity(session.value?.sessions))
const keepOnlineCount = computed(() => sessionQuantity(session.value?.keepOnline))
const sessionVisible = computed(() => session.value?.supported === true && !!sessionCount.value)
const popoverSessionVisible = computed(() => session.value?.supported === true && !!(sessionCount.value || keepOnlineCount.value) || upstream.value !== undefined)
const emptyHistory: readonly DeviceMessageSample[] = []
// 会话计数与通信分别到达；计数变化不能使同一份通信历史的投影失效。
const communicationHistory = computed(() => props.session?.communication?.supported === true ? props.session.communication.history : emptyHistory)
const communicationRates = computed(() => latestDeviceMessageRates(communicationHistory.value))
const upstream = computed(() => communicationRates.value?.upstreamMessages)
const qps = computed(() => deviceQpsSummary(communicationHistory.value))
const communicationQps = computed(() => qps.value.values?.communicationQps)
const upstreamText = computed(() => upstream.value === undefined ? undefined : t('RuntimeMonitor.deviceRuntimePreview', { rate: upstream.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) }))
const qpsText = computed(() => communicationQps.value === undefined ? undefined : t('RuntimeMonitor.deviceRuntimeQpsPreview', { rate: communicationQps.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) }))
const devicePreview = computed(() => [sessionVisible.value ? t('RuntimeMonitor.sessionPreview', { count: sessionCount.value }) : undefined, upstreamText.value, qpsText.value].filter(Boolean).join(' · '))
const devicePreviewStale = computed(() => sessionVisible.value && (session.value?.state.status === 'stale' || session.value?.history?.at(-1)?.value === undefined) || (upstream.value !== undefined || communicationQps.value !== undefined) && (props.session?.communication?.state.status === 'stale' || props.session?.communication?.history.at(-1)?.startTime === undefined) || communicationQps.value !== undefined && qps.value.stale)
const devicePreviewTitle = computed(() => [devicePreview.value, devicePreviewStale.value ? t('RuntimeMonitor.deviceRuntimeStale') : undefined, sessionVisible.value ? t('RuntimeMonitor.sessionInfo') : undefined, communicationQps.value === undefined ? undefined : [t('RuntimeMonitor.deviceRuntimeQpsHelp'), t('RuntimeMonitor.deviceRuntimeQpsWindow', { seconds: (qps.value.windowMillis ?? 0) / 1000 }), qps.value.timestamp === undefined ? undefined : new Date(qps.value.timestamp).toLocaleString()].filter(Boolean).join(' · '), props.session?.communication?.state.sampledAt === undefined ? undefined : t('RuntimeMonitor.overviewObservedAt', { time: new Date(props.session.communication.state.sampledAt).toLocaleString() })].filter(Boolean).join('\n'))
const level = computed(() => props.stale || !hasData.value ? 'unavailable' : props.live!.health.level)
const status = computed(() => ({ normal: 'success', warning: 'warning', critical: 'error', unavailable: 'default' } as const)[level.value])
const statusLabel = computed(() => t(level.value === 'normal' ? 'runtimeDiagnostics.normal' : level.value === 'unavailable' ? hasData.value && props.stale ? 'runtimeDiagnostics.nodeStale' : props.waiting ? 'runtimeDiagnostics.waitingMonitoringData' : 'runtimeDiagnostics.nodeUnavailable' : `components.RealtimeResource.health.${level.value}`))
const statusDescription = computed(() => hasData.value ? statusLabel.value : t(props.waiting ? 'runtimeDiagnostics.waitingMonitoringDescription' : 'runtimeDiagnostics.noMonitoringDescription'))
</script>
<style scoped>
.node-summary { width:100%; min-width:0; padding:7px 0; outline-offset:2px; }.node-summary-title { display:flex; align-items:center; gap:5px; min-width:0; line-height:22px; }.node-summary-title > strong { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-body,14px); font-weight:600; }.node-summary-session { display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:4px; color:var(--ink-2); font-size:var(--fs-caption,12px); font-weight:400; font-variant-numeric:tabular-nums; }.node-summary-session > span { display:inline-flex; align-items:center; gap:6px; }.node-summary-session :deep(.anticon) { font-size:14px; }.node-summary-session--stale { text-decoration:underline dotted; }
.node-summary-row { display:grid; grid-template-columns:24px 42px minmax(0,1fr); align-items:center; gap:5px; margin-top:4px; }.node-summary-row > span { color:var(--ink-3); font-size:var(--fs-caption,12px); }.node-summary-cpu { grid-column:2; }.node-summary-memory { grid-column:3; }.node-summary-memory:first-of-type { grid-column:2/-1; }.node-summary-empty { margin-top:4px; color:var(--ink-3); font-size:var(--fs-caption,12px); line-height:18px; }
.node-popover { width:480px; max-width:calc(100vw - 80px); max-height:calc(100vh - 96px); overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; }.node-popover-heading { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px; margin-bottom:7px; }.node-popover-heading > strong { min-width:0; overflow-wrap:anywhere; font-size:var(--fs-body,14px); font-weight:600; }.node-popover-status { color:var(--ink-3); font-size:var(--fs-caption,12px); }.node-evidence { font-size:var(--fs-caption,12px); line-height:18px; }
.node-popover-resources { display:grid; gap:5px; }.node-popover-resource { display:grid; grid-template-columns:32px 86px minmax(0,1fr); align-items:center; gap:8px; min-height:19px; font-size:var(--fs-caption,12px); }.node-popover-resource > strong { color:var(--ink-2); font-weight:500; }.node-popover-resource > span { color:var(--ink-3); }.node-popover-resource b { color:var(--ink-1); font-weight:500; font-variant-numeric:tabular-nums; }.node-popover-resource :deep(.node-resource-meter) { grid-column:3; }.node-popover-io { display:flex; flex-wrap:wrap; gap:2px 12px; margin-top:5px; color:var(--ink-3); font-size:var(--fs-caption,12px); line-height:17px; }
.node-popover-sessions { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 8px; margin-top:6px; color:var(--ink-3); font-size:var(--fs-caption,12px); line-height:17px; }.node-popover-sessions strong,.node-popover-sessions b { color:var(--ink-1); font-weight:500; }.node-popover-sessions b { font-variant-numeric:tabular-nums; }.node-popover-sessions small { color:var(--ink-3); font-size:var(--fs-caption,12px); }
.node-summary-buffer { display:flex; flex-wrap:wrap; align-items:center; gap:3px 6px; margin-top:5px; color:var(--node-warning); font-size:var(--fs-caption,12px); line-height:17px; }.node-summary-buffer--failed { color:var(--node-error); }.node-summary-buffer > span:first-child { font-weight:600; }.node-summary-buffer small { color:var(--ink-3); font-size:var(--fs-caption,12px); }
</style>
