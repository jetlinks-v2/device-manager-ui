<template>
  <section v-if="session || communication?.supported === true" class="device-runtime-trend" :aria-label="t('RuntimeMonitor.deviceRuntime')">
    <header class="device-runtime-heading">
      <div class="device-runtime-title"><strong>{{ t('RuntimeMonitor.deviceRuntime') }}</strong><a-tooltip :title="t('RuntimeMonitor.deviceRuntimeHelp')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t('RuntimeMonitor.deviceRuntimeHelp')" /></a-tooltip></div>
      <component v-if="sessionValue !== undefined" :is="session?.details ? AButton : 'span'" :type="session?.details ? 'link' : undefined" class="device-runtime-reading" :class="{ 'device-runtime-retained': sessionRetained, 'device-runtime-reading--action': !!session?.details }" :title="[t('RuntimeMonitor.deviceRuntimeSessions'), observed(session?.state.sampledAt), session?.details ? t('RuntimeMonitor.overviewViewConnections') : undefined].filter(Boolean).join(' · ')" @click="session?.details && emit('details', session.details)"><LinkOutlined aria-hidden="true" />{{ t('RuntimeMonitor.deviceRuntimeSessionsShort') }} <b>{{ exact(sessionValue) }}</b><small v-if="sessionRetained">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small></component>
      <template v-if="communication?.supported === true">
        <a-tooltip v-if="qps.supported" :title="qpsDescription" :trigger="['hover', 'focus']"><span class="device-runtime-reading" :class="{ 'device-runtime-retained': qps.stale || communicationRetained }" tabindex="0" :aria-label="qpsDescription"><ApiOutlined aria-hidden="true" />{{ t('RuntimeMonitor.deviceRuntimeCommunication') }} <b>{{ rate(qps.values?.communicationQps) }}</b><small v-if="qps.values?.communicationQps !== undefined">{{ t('RuntimeMonitor.deviceRuntimeQpsUnit') }}</small><small v-else>{{ t(qps.invalid ? 'RuntimeMonitor.deviceRuntimeQpsUnavailable' : 'RuntimeMonitor.deviceRuntimeQpsWaiting') }}</small><small v-if="qps.stale">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small></span></a-tooltip>
        <span class="device-runtime-reading" :class="{ 'device-runtime-retained': communicationRetained }" :title="[t('RuntimeMonitor.deviceRuntimeUpstream'), observed(communication.state.sampledAt)].join(' · ')"><UploadOutlined aria-hidden="true" />{{ t('RuntimeMonitor.deviceRuntimeUpstreamShort') }} <b>{{ rate(latest?.upstreamMessages) }}</b><small v-if="latest?.upstreamMessages !== undefined">{{ t('RuntimeMonitor.deviceRuntimeMessagesUnit') }}</small></span>
        <small v-if="communicationRetained">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small>
        <small v-else-if="waitingRate">{{ t('RuntimeMonitor.deviceRuntimeWaitingRate') }}</small>
      </template>
    </header>
    <div class="device-runtime-chart"><Echarts :option="option" :library="library" :events="events" renderer="svg" /><div v-if="!hasVisibleValues" class="device-runtime-empty"><span>{{ t(emptyMessage) }}</span><a-button v-if="!hasSelectedSeries" type="link" size="small" @click="restoreDefaults">{{ t('RuntimeMonitor.deviceRuntimeRestoreSeries') }}</a-button></div></div>
    <small v-if="incomparableClocks" class="device-runtime-clock-note">{{ t('RuntimeMonitor.deviceRuntimeClockMismatch') }}</small>
    <div v-if="session && cache" class="device-runtime-cache" :class="{ 'device-runtime-retained': cache.state.status === 'stale' }">
      <DatabaseOutlined aria-hidden="true" />
      <component :is="cache.details ? AButton : 'span'" :type="cache.details ? 'link' : undefined" class="device-runtime-cache-link" @click="cache.details && emit('details', cache.details)">{{ t('RuntimeMonitor.deviceRuntimeCacheShort') }}</component>
      <span v-if="cache.retainedValue !== undefined" class="device-runtime-cache-value"><b>{{ exact(cache.retainedValue) }}</b> {{ t('RuntimeMonitor.deviceRuntimeCacheUnit') }}</span>
      <span v-if="cache.dirtyCount !== undefined" class="device-runtime-cache-value">· {{ t('RuntimeMonitor.deviceRuntimeCachePending') }} <b>{{ exact(cache.dirtyCount) }}</b> {{ t('RuntimeMonitor.deviceRuntimeCacheUnit') }}</span>
      <a-tooltip :trigger="['hover', 'focus']" :overlay-style="{ maxWidth: 'min(360px, calc(100vw - 24px))' }"><template #title><div>{{ t('RuntimeMonitor.deviceRuntimeCacheHelp') }}</div><div v-for="fact in cache.facts" :key="fact.label">{{ t(fact.label) }}：{{ fact.value }}</div><div>{{ observed(cache.state.sampledAt) }}</div></template><InfoCircleOutlined tabindex="0" :aria-label="cacheDescription" /></a-tooltip>
      <small v-if="cache.state.status === 'stale'">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button as AButton, theme } from 'ant-design-vue'
import { InfoCircleOutlined, LinkOutlined, UploadOutlined, DatabaseOutlined, ApiOutlined } from '@ant-design/icons-vue'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import Echarts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { deviceMessageRates, latestDeviceMessageRates, type NodeDeviceMessageSnapshot, type DeviceMessageRates } from '../../RuntimeMonitor/device-runtime/deviceMessageHistory'
import { deviceQpsView } from '../../RuntimeMonitor/device-runtime/deviceQps'
import type { DiagnosticNodePreference } from '../preferences'
import type { OverviewTrend } from './useOverviewTrends'

const props = defineProps({
  session: { type: Object as PropType<OverviewTrend>, default: undefined }, cache: { type: Object as PropType<OverviewTrend>, default: undefined },
  communication: { type: Object as PropType<NodeDeviceMessageSnapshot>, default: undefined },
  config: { type: Object as PropType<DiagnosticNodePreference>, default: () => ({}) },
})
const emit = defineEmits<{ details: [value: string]; configure: [value: Partial<DiagnosticNodePreference>] }>()
const { t } = useI18n(), { token } = theme.useToken(), library = [LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent]
const seriesIds = ['sessions', 'upstreamMessages', 'communicationQps', 'propertyReports', 'eventReports', 'receivedBytes', 'sentBytes'] as const
type SeriesId = typeof seriesIds[number]
const label = (id: SeriesId) => t(`RuntimeMonitor.deviceRuntimeSeries.${id}`)
const mode = computed(() => props.config.deviceRuntimeMode ?? 'messages')
const history = computed(() => props.communication?.history ?? [])
const qps = computed(() => deviceQpsView(history.value))
const rates = computed(() => deviceMessageRates(history.value)), latest = computed(() => latestDeviceMessageRates(history.value))
const sessionValue = computed(() => props.session?.history[props.session.history.length - 1]?.value ?? props.session?.retainedValue)
const sessionRetained = computed(() => props.session?.state.status === 'stale' || props.session?.history.at(-1)?.value === undefined)
const communicationRetained = computed(() => props.communication?.state.status === 'stale' || history.value.at(-1)?.startTime === undefined)
const waitingRate = computed(() => latest.value?.upstreamMessages === undefined)
const exact = (value: string) => BigInt(value).toLocaleString()
const rate = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const compactCount = (value: number) => value >= 1000000 ? `${rate(value / 1000000)}M` : value >= 1000 ? `${rate(value / 1000)}k` : rate(value)
const bytes = (value?: number) => {
  if (value === undefined) return '—'
  const unit = value >= 1048576 ? 1048576 : value >= 1024 ? 1024 : 1
  return `${rate(value / unit)} ${unit === 1048576 ? 'MB' : unit === 1024 ? 'KB' : 'B'}/s`
}
const observed = (time?: number) => time === undefined ? '' : t('RuntimeMonitor.overviewObservedAt', { time: new Date(time).toLocaleString() })
const cacheDescription = computed(() => [t('RuntimeMonitor.deviceRuntimeCacheHelp'), ...(props.cache?.facts ?? []).map(fact => `${t(fact.label)}: ${fact.value}`), observed(props.cache?.state.sampledAt)].filter(Boolean).join('\n'))
const windowDescription = (millis?: number) => millis === undefined ? '' : t('RuntimeMonitor.deviceRuntimeQpsWindow', { seconds: rate(millis / 1000) })
const qpsDescription = computed(() => [t('RuntimeMonitor.deviceRuntimeQpsHelp'), qps.value.values ? `${t('RuntimeMonitor.deviceRuntimeReceived')} ${rate(qps.value.values.receivedQps)} ${t('RuntimeMonitor.deviceRuntimeQpsUnit')} · ${t('RuntimeMonitor.deviceRuntimeSent')} ${rate(qps.value.values.sentQps)} ${t('RuntimeMonitor.deviceRuntimeQpsUnit')}` : t(qps.value.invalid ? 'RuntimeMonitor.deviceRuntimeQpsUnavailable' : 'RuntimeMonitor.deviceRuntimeQpsWaiting'), windowDescription(qps.value.windowMillis), observed(qps.value.timestamp)].filter(Boolean).join('\n'))
const legendIds = computed<SeriesId[]>(() => [...(props.session ? ['sessions' as const] : []), ...(props.communication?.supported === true ? ['upstreamMessages' as const, ...(qps.value.supported ? ['communicationQps' as const] : []), 'propertyReports' as const, 'eventReports' as const, 'receivedBytes' as const, 'sentBytes' as const] : [])])
const activeIds = computed<SeriesId[]>(() => [...(props.session ? ['sessions' as const] : []), ...(props.communication?.supported === true ? mode.value === 'traffic' ? ['receivedBytes', 'sentBytes'] as const : ['upstreamMessages' as const, ...(qps.value.supported ? ['communicationQps' as const] : []), 'propertyReports' as const, 'eventReports' as const] : [])])
const selectedIds = computed(() => props.config.deviceRuntimeSeries ?? ['sessions', 'upstreamMessages', 'communicationQps', 'receivedBytes', 'sentBytes'])
const selectedActiveIds = computed(() => activeIds.value.filter(id => selectedIds.value.includes(id)))
const hasSelectedSeries = computed(() => selectedActiveIds.value.length > 0)
function restoreDefaults() { emit('configure', { deviceRuntimeMode: 'messages', deviceRuntimeSeries: ['sessions', 'upstreamMessages', 'communicationQps', 'receivedBytes', 'sentBytes'] }) }
interface PlotPoint { value: [number, number | null]; exact?: string; timestamp: number; propertyValues?: number; receivedQps?: number; sentQps?: number; windowMillis?: number }
const sourcePlots = computed(() => Object.fromEntries(seriesIds.map(id => [id, !activeIds.value.includes(id) ? [] : id === 'sessions'
  ? (props.session?.history ?? []).map(point => ({ value: [point.timestamp, point.value === undefined ? null : Number(point.value)], timestamp: point.timestamp, exact: point.value }))
  : id === 'communicationQps' ? qps.value.history.map(point => ({ value: [point.timestamp, point.values?.communicationQps ?? null], timestamp: point.timestamp, receivedQps: point.values?.receivedQps, sentQps: point.values?.sentQps, windowMillis: point.windowMillis }))
  : rates.value.map(point => ({ value: [point.timestamp, point[id as Exclude<keyof DeviceMessageRates, 'timestamp'>] ?? null], timestamp: point.timestamp, propertyValues: point.propertyValues }))])) as Record<SeriesId, PlotPoint[]>)
/** 独立服务器校时后不能把浏览器时钟的会话线硬并到跨天坐标；读数与源历史保持不变。 */
const incomparableClocks = computed(() => {
  const communicationSelected = selectedActiveIds.value.some(id => id !== 'sessions')
  const end = communicationSelected ? history.value.at(-1)?.timestamp : undefined
  const sessionEnd = sourcePlots.value.sessions.at(-1)?.timestamp
  return end !== undefined && sessionEnd !== undefined && Math.abs(end - sessionEnd) > 600000
})
const plotted = computed(() => incomparableClocks.value ? { ...sourcePlots.value, sessions: [] } : sourcePlots.value)
const hasVisibleValues = computed(() => selectedActiveIds.value.some(id => plotted.value[id].some((point, index, points) => point.value[1] !== null && index > 0 && points[index - 1].value[1] !== null && point.timestamp !== points[index - 1].timestamp)))
const emptyMessage = computed(() => {
  if (!hasSelectedSeries.value) return 'RuntimeMonitor.deviceRuntimeNoSeries'
  if (communicationRetained.value || selectedActiveIds.value.includes('communicationQps') && qps.value.invalid) return 'RuntimeMonitor.deviceRuntimeNoValidSample'
  if (!hasVisibleValues.value && selectedActiveIds.value.some(id => plotted.value[id].some(point => point.value[1] !== null))) return 'RuntimeMonitor.deviceRuntimeWaitingRate'
  const waiting = selectedActiveIds.value.some(id => id === 'communicationQps' ? qps.value.supported && !qps.value.ready : id === 'sessions' ? props.session?.state.status === 'loading' : history.value.some(point => point.counters?.[id as Exclude<keyof DeviceMessageRates, 'timestamp'>] !== undefined))
  return waiting ? 'RuntimeMonitor.overviewWaitingSamples' : 'RuntimeMonitor.deviceRuntimeNoValidSample'
})
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))
/** 每条线保留自己的真实时间；会话取样时间与服务端通信快照不能伪装成同一时刻。 */
function tooltip(parameters: unknown) {
  const items = Array.isArray(parameters) ? parameters : [parameters]
  return items.flatMap(parameter => {
    const item = parameter as { seriesId?: SeriesId; data?: PlotPoint; marker?: string }, point = item.data, id = item.seriesId
    if (!point || !id || point.value[1] === null) return []
    const value = id === 'sessions' ? point.exact === undefined ? '' : exact(point.exact) : id.endsWith('Bytes') ? bytes(point.value[1]) : `${rate(point.value[1])} ${t(id === 'communicationQps' ? 'RuntimeMonitor.deviceRuntimeQpsUnit' : 'RuntimeMonitor.deviceRuntimeMessagesUnit')}`
    const extra = id === 'propertyReports' && point.propertyValues !== undefined ? `<br/>${escape(t('RuntimeMonitor.deviceRuntimePropertyValues'))} ${rate(point.propertyValues)} /s` : id === 'communicationQps' ? `<br/>${escape(t('RuntimeMonitor.deviceRuntimeReceived'))} ${rate(point.receivedQps)} · ${escape(t('RuntimeMonitor.deviceRuntimeSent'))} ${rate(point.sentQps)} ${escape(t('RuntimeMonitor.deviceRuntimeQpsUnit'))}<br/>${escape(windowDescription(point.windowMillis))}` : ''
    const retained = id === 'sessions' ? sessionRetained.value : id === 'communicationQps' ? qps.value.stale || communicationRetained.value : communicationRetained.value
    return [`${item.marker ?? ''}${escape(label(id))} <b>${escape(value)}</b><small style="margin-left:8px;color:#888">${escape(new Date(point.timestamp).toLocaleTimeString())}${retained ? ` · ${escape(t('RuntimeMonitor.deviceRuntimeStale'))}` : ''}</small>${extra}`]
  }).join('<br/>')
}
const events = {
  legendselectchanged: (event: unknown) => {
    const { selected, name } = event as { selected?: Record<string, boolean>; name?: string }
    if (!selected) return
    const next = new Set(selectedIds.value)
    for (const id of activeIds.value) if (selected[label(id)]) next.add(id); else next.delete(id)
    const clicked = legendIds.value.find(id => label(id) === name)
    let nextMode = mode.value
    if (clicked && selected[label(clicked)]) {
      next.add(clicked)
      if (clicked === 'receivedBytes' || clicked === 'sentBytes') nextMode = 'traffic'
      else if (clicked !== 'sessions') nextMode = 'messages'
    }
    emit('configure', { deviceRuntimeSeries: [...next], deviceRuntimeMode: nextMode })
  },
  datazoom: (event: unknown) => {
    const value = event as { start?: number; end?: number; batch?: Array<{ start?: number; end?: number }> }, zoom = value.batch?.[0] ?? value
    if (typeof zoom.start === 'number' && typeof zoom.end === 'number' && zoom.start < zoom.end) emit('configure', { deviceRuntimeZoom: { start: zoom.start, end: zoom.end } })
  },
}
/** 固定series身份，切换模式以空数据清除旧线，避免ECharts合并残留。 */
const option = computed(() => {
  const colors = [token.value.colorPrimary, token.value.colorSuccess, '#d46b08', '#8f69d3', '#d9933d', '#13a8a8', '#7b83cf']
  const times = selectedActiveIds.value.flatMap(id => plotted.value[id].map(point => point.timestamp)), start = times.length ? Math.min(...times) : undefined, end = times.length ? Math.max(...times) : undefined
  const communication = props.communication?.supported === true
  const zoom = props.config.deviceRuntimeZoom ?? { start: 0, end: 100 }
  return { animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12 }, grid: { top: 48, left: 50, right: communication ? 64 : 16, bottom: 40 },
    legend: { top: 0, left: 0, type: 'scroll', icon: 'rect', data: legendIds.value.map(label), selected: Object.fromEntries(seriesIds.map(id => [label(id), activeIds.value.includes(id) && selectedIds.value.includes(id)])), itemWidth: 16, itemHeight: 2, textStyle: { color: token.value.colorTextSecondary } },
    tooltip: { trigger: 'axis', confine: true, formatter: tooltip },
    xAxis: { type: 'time', min: start, max: start === end && end !== undefined ? end + 30000 : end, splitNumber: 4, axisLabel: { hideOverlap: true, color: token.value.colorTextTertiary, formatter: '{HH}:{mm}:{ss}' }, splitLine: { show: false } },
    media: [{ query: { maxWidth: 480 }, option: { xAxis: { splitNumber: 2 } } }, { option: { xAxis: { splitNumber: 4 } } }],
    yAxis: [
      { type: 'value', show: !!props.session, name: t('RuntimeMonitor.deviceRuntimeRecordsUnit'), min: 0, minInterval: 1, axisLabel: { color: token.value.colorTextTertiary, formatter: compactCount }, splitLine: { lineStyle: { color: token.value.colorSplit } } },
      { type: 'value', show: communication, name: mode.value === 'traffic' ? 'B/s' : '/s', min: 0, axisLabel: { color: token.value.colorTextTertiary, formatter: (value: number) => mode.value === 'traffic' ? bytes(value).replace('/s', '') : compactCount(value) }, splitLine: { show: !props.session, lineStyle: { color: token.value.colorSplit } } },
    ],
    dataZoom: [{ id: 'device-runtime-inside', type: 'inside', filterMode: 'none', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, ...zoom }, { id: 'device-runtime-slider', type: 'slider', height: 14, bottom: 0, showDetail: false, brushSelect: false, borderColor: 'transparent', ...zoom }],
    series: seriesIds.map((id, index) => ({ id, name: label(id), type: 'line', yAxisIndex: id === 'sessions' ? 0 : 1, data: plotted.value[id], connectNulls: false, showSymbol: false, symbolSize: 4, lineStyle: { width: 1.8 }, itemStyle: { color: colors[index] }, emphasis: { focus: 'series' } })),
  }
})
</script>
<style scoped>
.device-runtime-trend { min-width:0; padding:var(--space-3,12px) 0; }
.device-runtime-heading { display:flex; flex-wrap:wrap; align-items:center; gap:6px 20px; min-height:26px; margin-bottom:8px; color:var(--ink-2); font-size:var(--fs-12,12px); font-weight:400; }
.device-runtime-title { display:inline-flex; align-items:center; gap:6px; }.device-runtime-title > strong { color:var(--ink-1); font-size:var(--fs-body,14px); font-weight:600; }.device-runtime-title > :deep(.anticon) { font-size:14px; }
.device-runtime-reading { display:inline-flex; align-items:baseline; gap:6px; white-space:nowrap; }.device-runtime-reading--action { height:auto; padding:0; color:var(--ink-2); font-size:inherit; line-height:inherit; }.device-runtime-heading .device-runtime-reading--action b { color:var(--brand-5,#1677ff); }.device-runtime-reading > :deep(.anticon) { align-self:center; font-size:14px; }.device-runtime-reading b { color:var(--ink-1); font-size:var(--fs-16,16px); font-weight:600; font-variant-numeric:tabular-nums; }.device-runtime-heading small { font-size:var(--fs-12,12px); font-weight:400; }.device-runtime-retained { opacity:.65; }.device-runtime-chart { position:relative; height:240px; min-width:0; }.device-runtime-empty { position:absolute; inset:48px 20px 40px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:var(--ink-2); font-size:var(--fs-12,12px); pointer-events:none; }.device-runtime-empty :deep(.ant-btn) { height:auto; padding:0; font-size:inherit; pointer-events:auto; }
.device-runtime-cache { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin-top:8px; color:var(--ink-2); font-size:var(--fs-sm,13px); }.device-runtime-cache b { color:var(--ink-2); font-weight:500; font-variant-numeric:tabular-nums; }.device-runtime-cache :deep(.ant-btn) { height:auto; padding:0; font-size:inherit; line-height:inherit; }.device-runtime-cache small { font-size:var(--fs-12,12px); }.device-runtime-cache > :deep(.anticon) { font-size:14px; }.device-runtime-cache-value { white-space:nowrap; }
.device-runtime-clock-note { display:block; margin-top:6px; color:var(--ink-2); font-size:var(--fs-12,12px); font-weight:400; }
@media (max-width:560px) { .device-runtime-heading { gap:6px 14px; } }
</style>
