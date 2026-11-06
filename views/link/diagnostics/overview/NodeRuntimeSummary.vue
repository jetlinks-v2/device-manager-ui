<template>
  <section v-if="metric" class="node-runtime-summary" :data-summary-metric="metric" :aria-label="heading">
    <header>
      <h3 :title="observed(sampledAt)">{{ heading }}</h3>
      <a-tooltip v-if="retained" :title="[t('RuntimeMonitor.runtimeSummary.retained'), observed(sampledAt)].filter(Boolean).join(' · ')">
        <span class="summary-retained" tabindex="0" :aria-label="t('RuntimeMonitor.runtimeSummary.retained')"><ClockCircleOutlined aria-hidden="true" /><span>{{ t('RuntimeMonitor.runtimeSummary.retained') }}</span></span>
      </a-tooltip>
    </header>
    <div class="summary-main"><strong :title="reading">{{ reading }}</strong><span>{{ unit }}</span></div>
    <div class="summary-details">
      <a-progress v-if="percent !== undefined" :percent="percent" :show-info="false" :stroke-width="3" :stroke-color="token.colorPrimary" :aria-label="heading" />
      <div v-if="metric === 'messages'" class="summary-caption">
        <span v-if="communication?.supported" :title="observed(session?.state.sampledAt)">{{ t('RuntimeMonitor.runtimeSummary.sessions', { count: count(sessionValue) }) }}<template v-if="sessionRetained"> · {{ t('RuntimeMonitor.runtimeSummary.retained') }}</template></span>
        <span v-else>{{ t('RuntimeMonitor.overviewSessionPurpose') }}</span>
      </div>
      <div v-else-if="metric === 'backlog'" class="summary-caption">
        <span>{{ t('RuntimeMonitor.runtimeSummary.queueCount', { count: buffer?.queues.length ?? '—' }) }}</span>
        <span :class="{ 'summary-attention': (buffer?.dead ?? 0) > 0 }">{{ t('RuntimeMonitor.runtimeSummary.retainedFailures', { count: number(buffer?.dead) }) }}</span>
      </div>
      <div v-else-if="metric === 'cpu'" class="summary-caption">{{ t('RuntimeMonitor.runtimeSummary.hostCpu', { value: number(live?.cpuSystem) }) }}</div>
      <div v-else class="summary-caption">{{ size(live?.memoryJvmUsed) }} / {{ size(live?.memoryJvmTotal) }}</div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { ClockCircleOutlined } from '@ant-design/icons-vue'
import type { RealtimeNode } from '../../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { formatMemorySize } from '../../../../visDashboard/SystemMonitor/utils/monitorData'
import type { ClusterBufferSnapshot } from '../../RuntimeMonitor/useClusterBuffers'
import type { NodeDeviceMessageSnapshot } from '../../RuntimeMonitor/device-runtime/deviceMessageHistory'
import { latestDeviceRuntimeRates, type DeviceRecordingView } from '../../RuntimeMonitor/device-runtime/deviceMessageRecording'
import type { OverviewTrend } from './useOverviewTrends'
import type { NodeSummaryMetric } from './nodeOverviewDashboard'

const props = defineProps<{ metric?: NodeSummaryMetric; communication?: NodeDeviceMessageSnapshot; recording?: DeviceRecordingView; session?: OverviewTrend; buffer?: ClusterBufferSnapshot; live?: RealtimeNode; stale?: boolean }>()
const { t } = useI18n(), { token } = theme.useToken()
// 只在消息卡读取最新完整窗口；不建立额外历史投影、采集或图表实例。
const message = computed(() => latestDeviceRuntimeRates(props.communication?.history ?? [], props.recording))
const sessionValue = computed(() => props.session?.history.at(-1)?.value ?? props.session?.retainedValue)
const sessionRetained = computed(() => props.session?.state.status === 'stale' || !!props.session && props.session.history.at(-1)?.value === undefined)
const messageRetained = computed(() => props.communication?.supported
  ? props.recording?.data ? props.recording.state === 'stale' : props.communication.state.status !== 'ready' || props.communication.history.at(-1)?.startTime === undefined
  : sessionRetained.value)
const heading = computed(() => t(props.metric === 'messages' ? props.communication?.supported ? 'RuntimeMonitor.deviceRuntimeSeries.upstreamMessages' : 'RuntimeMonitor.overviewSessionRecords'
  : `RuntimeMonitor.runtimeSummary.${props.metric === 'backlog' ? 'pending' : props.metric === 'cpu' ? 'jvmCpu' : 'heap'}`))
const number = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
const count = (value?: string) => value === undefined ? '—' : BigInt(value).toLocaleString()
const size = (value?: number) => value === undefined ? '—' : formatMemorySize(value)
const observed = (timestamp?: number) => timestamp === undefined ? '' : t('RuntimeMonitor.overviewObservedAt', { time: new Date(timestamp).toLocaleString() })
const reading = computed(() => props.metric === 'messages' ? props.communication?.supported ? number(message.value?.upstreamMessages) : count(sessionValue.value)
  : number(props.metric === 'backlog' ? props.buffer?.pending : props.metric === 'cpu' ? props.live?.cpuJvm : props.live?.memoryJvm))
const unit = computed(() => props.metric === 'cpu' || props.metric === 'heap' ? '%' : t(props.metric === 'messages' && props.communication?.supported ? 'RuntimeMonitor.deviceRuntimeMessagesUnit' : 'RuntimeMonitor.runtimeSummary.items'))
const percent = computed(() => props.metric === 'cpu' ? props.live?.cpuJvm : props.metric === 'heap' ? props.live?.memoryJvm : undefined)
const sampledAt = computed(() => props.metric === 'messages' ? message.value?.timestamp ?? props.session?.state.sampledAt : props.metric === 'backlog' ? props.buffer?.state.sampledAt : undefined)
const retained = computed(() => props.metric === 'messages' ? messageRetained.value : props.metric === 'backlog'
  ? props.buffer?.state.status !== 'ready' && props.buffer?.state.sampledAt !== undefined : props.stale && !!props.live)
</script>
<style scoped>
.node-runtime-summary { display:flex; flex-direction:column; box-sizing:border-box; height:100%; min-width:0; padding:24px 14px 12px; border:1px solid var(--line); border-radius:var(--radius-sm,4px); background:var(--ant-color-bg-container,transparent); container:node-summary / inline-size; font-variant-numeric:tabular-nums; }
header { display:flex; align-items:center; gap:6px; min-height:18px; }h3 { flex:1; min-width:0; margin:0; color:var(--ink-2); font-size:12px; font-weight:500; line-height:18px; }
.summary-retained { display:inline-flex; align-items:center; gap:4px; color:var(--ant-color-warning-text,#ad6800); font-size:11px; white-space:nowrap; }
.summary-main { display:flex; flex:1; align-items:baseline; gap:6px; padding-block:4px; min-width:0; }.summary-main strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink-1); font-size:32px; font-weight:600; line-height:1.2; letter-spacing:-.5px; }.summary-main > span { flex:none; color:var(--ink-3); font-size:12px; }
.summary-details { margin-top:auto; }.summary-details > :deep(.ant-progress) { display:block; margin:0 0 8px; line-height:3px; }
.summary-caption { display:flex; flex-wrap:wrap; align-items:baseline; gap:0 12px; min-height:18px; color:var(--ink-3); font-size:12px; line-height:18px; overflow-wrap:anywhere; }.summary-attention { color:var(--ant-color-warning-text,#ad6800); }
@container node-summary (width < 180px) { .summary-main strong { font-size:28px; }.summary-retained > span { display:none; } }
</style>
