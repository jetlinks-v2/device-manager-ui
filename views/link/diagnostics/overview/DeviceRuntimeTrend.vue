<template>
  <section v-if="session || communication?.supported === true" class="device-runtime-trend" :aria-label="t('RuntimeMonitor.deviceRuntime')">
    <header class="device-runtime-heading">
      <div class="device-runtime-title"><strong>{{ t('RuntimeMonitor.deviceRuntime') }}</strong><a-tooltip :title="t(recording?.data ? 'RuntimeMonitor.deviceRuntimeRecordedHelp' : 'RuntimeMonitor.deviceRuntimeHelp')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t(recording?.data ? 'RuntimeMonitor.deviceRuntimeRecordedHelp' : 'RuntimeMonitor.deviceRuntimeHelp')" /></a-tooltip></div>
      <component v-if="sessionValue !== undefined" :is="session?.details ? AButton : 'span'" :type="session?.details ? 'link' : undefined" class="device-runtime-session" :class="{ 'device-runtime-retained': sessionRetained, 'device-runtime-reading--action': !!session?.details }" :title="[t('RuntimeMonitor.deviceRuntimeSessions'), observed(session?.state.sampledAt), session?.details ? t('RuntimeMonitor.overviewViewConnections') : undefined].filter(Boolean).join(' · ')" @click="session?.details && emit('details', session.details)"><span class="device-runtime-reading"><LinkOutlined aria-hidden="true" /><span>{{ t('RuntimeMonitor.deviceRuntimeSessionsShort') }}</span><b>{{ exact(sessionValue) }}</b><small v-if="sessionRetained">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small></span></component>
      <template v-if="communication?.supported === true">
        <a-tooltip v-if="qps.supported" :title="qpsDescription" :trigger="['hover', 'focus']"><span class="device-runtime-reading" :class="{ 'device-runtime-retained': qps.stale || realtimeRetained }" tabindex="0" :aria-label="qpsDescription"><ApiOutlined aria-hidden="true" /><span>{{ t('RuntimeMonitor.deviceRuntimeCommunication') }}</span><b>{{ rate(qps.values?.communicationQps) }}</b><small v-if="qps.values?.communicationQps !== undefined">{{ t('RuntimeMonitor.deviceRuntimeQpsUnit') }}</small><small v-else>{{ t(qps.invalid ? 'RuntimeMonitor.deviceRuntimeQpsUnavailable' : 'RuntimeMonitor.deviceRuntimeQpsWaiting') }}</small><small v-if="qps.stale">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small></span></a-tooltip>
        <span class="device-runtime-reading" :class="{ 'device-runtime-retained': communicationRetained }" :title="[t('RuntimeMonitor.deviceRuntimeUpstream'), observed(communication.state.sampledAt)].join(' · ')"><UploadOutlined aria-hidden="true" /><span>{{ t('RuntimeMonitor.deviceRuntimeUpstreamShort') }}</span><b>{{ rate(latest?.upstreamMessages) }}</b><small v-if="latest?.upstreamMessages !== undefined">{{ t('RuntimeMonitor.deviceRuntimeMessagesUnit') }}</small></span>
        <small v-if="communicationRetained">{{ t('RuntimeMonitor.deviceRuntimeStale') }}</small>
        <small v-else-if="waitingRate">{{ t('RuntimeMonitor.deviceRuntimeWaitingRate') }}</small>
      </template>
      <DeviceRuntimePeaks v-if="recording" :view="recording" @retry="emit('retry-recording')" @select="selectPeak" @live="emit('live')" />
    </header>
    <div class="device-runtime-chart"><Echarts :option="option" :library="library" :events="events" renderer="svg" /><div v-if="!hasVisibleValues" class="device-runtime-empty"><span>{{ t(emptyMessage) }}</span><a-button v-if="!hasSelectedSeries" type="link" size="small" @click="restoreDefaults">{{ t('RuntimeMonitor.deviceRuntimeRestoreSeries') }}</a-button></div></div>
    <div class="device-runtime-axes"><span v-if="sessionAxisVisible">{{ t('RuntimeMonitor.deviceRuntimeLeftAxis', { metrics: axisMetric(label('sessions'), t('RuntimeMonitor.deviceRuntimeRecordsUnit')) }) }}</span><span v-if="messageAxisVisible">{{ t('RuntimeMonitor.deviceRuntimeRightAxis', { metrics: rateAxisDescription }) }}</span><span v-if="trafficAxisVisible">{{ t(messageAxisVisible ? 'RuntimeMonitor.deviceRuntimeOuterAxis' : 'RuntimeMonitor.deviceRuntimeRightAxis', { metrics: axisMetric(t('RuntimeMonitor.deviceRuntimeTraffic'), 'B/s') }) }}</span></div>
    <small v-if="incomparableClocks" class="device-runtime-clock-note">{{ t('RuntimeMonitor.deviceRuntimeClockMismatch') }}</small>
    <small v-if="recording?.outside" class="device-runtime-clock-note">{{ t('RuntimeMonitor.devicePeakOutside') }}</small>
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
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components'
import Echarts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { deviceMessageRates, latestDeviceMessageRates, type NodeDeviceMessageSnapshot, type DeviceMessageRates } from '../../RuntimeMonitor/device-runtime/deviceMessageHistory'
import { deviceQpsView } from '../../RuntimeMonitor/device-runtime/deviceQps'
import type { DiagnosticNodePreference } from '../preferences'
import type { OverviewTrend } from './useOverviewTrends'
import DeviceRuntimePeaks from './DeviceRuntimePeaks.vue'
import { peakSeries, recordingSeriesMetric, type DeviceRecordingView, type DevicePeakSelection } from '../../RuntimeMonitor/device-runtime/deviceMessageRecording'

const props = defineProps({
  session: { type: Object as PropType<OverviewTrend>, default: undefined }, cache: { type: Object as PropType<OverviewTrend>, default: undefined },
  communication: { type: Object as PropType<NodeDeviceMessageSnapshot>, default: undefined },
  recording: { type: Object as PropType<DeviceRecordingView>, default: undefined },
  config: { type: Object as PropType<DiagnosticNodePreference>, default: () => ({}) },
})
const emit = defineEmits<{ details: [value: string]; configure: [value: Partial<DiagnosticNodePreference>]; peak: [selection: DevicePeakSelection]; live: []; 'retry-recording': [] }>()
const { t, locale } = useI18n(), { token } = theme.useToken(), library = [LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent]
const timeOptions = computed<Intl.DateTimeFormatOptions>(() => ({ timeZone: props.recording?.data?.zoneId, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const axisTime = computed(() => new Intl.DateTimeFormat(locale.value, timeOptions.value))
const tooltipTime = computed(() => new Intl.DateTimeFormat(locale.value, { ...timeOptions.value, fractionalSecondDigits: 3 }))
const seriesIds = ['sessions', 'upstreamMessages', 'communicationQps', 'propertyReports', 'eventReports', 'receivedBytes', 'sentBytes', 'propertyValues'] as const
const seriesColors = computed(() => [token.value.colorPrimary, token.value.colorSuccess, '#d46b08', '#8f69d3', '#d9933d', '#13a8a8', '#7b83cf', '#eb2f96'])
type SeriesId = typeof seriesIds[number]
const label = (id: SeriesId) => t(`RuntimeMonitor.deviceRuntimeSeries.${id}`)
const axisMetric = (metric: string, unit: string) => t('RuntimeMonitor.deviceRuntimeAxisMetric', { metric, unit })
const rateAxisDescription = computed(() => [
  ...(selectedActiveIds.value.some(id => ['upstreamMessages', 'propertyReports', 'eventReports'].includes(id)) ? [axisMetric(t('RuntimeMonitor.deviceRuntimeMessages'), t('RuntimeMonitor.deviceRuntimeMessagesUnit'))] : []),
  ...(selectedActiveIds.value.includes('communicationQps') ? [axisMetric(label('communicationQps'), t('RuntimeMonitor.deviceRuntimeQpsUnit'))] : []),
  ...(selectedActiveIds.value.includes('propertyValues') ? [axisMetric(label('propertyValues'), t('RuntimeMonitor.devicePeakPointsUnit'))] : []),
].join(' · '))
const history = computed(() => props.communication?.history ?? [])
const qps = computed(() => deviceQpsView(history.value))
const rates = computed(() => deviceMessageRates(history.value)), latest = computed(() => {
  if (!props.recording?.data) return latestDeviceMessageRates(history.value)
  const point = props.recording.data.points.at(-1)
  return point ? { timestamp: point.timestamp, upstreamMessages: point.values.UpstreamMessages, propertyReports: point.values.PropertyReports, propertyValues: point.values.PropertyValues, eventReports: point.values.EventReports, receivedBytes: point.values.ReceivedBytes, sentBytes: point.values.SentBytes } : undefined
})
const sessionValue = computed(() => props.session?.history[props.session.history.length - 1]?.value ?? props.session?.retainedValue)
const sessionRetained = computed(() => props.session?.state.status === 'stale' || props.session?.history.at(-1)?.value === undefined)
const realtimeRetained = computed(() => props.communication?.state.status === 'stale' || history.value.at(-1)?.startTime === undefined)
const communicationRetained = computed(() => props.recording?.data ? props.recording.state === 'stale' : realtimeRetained.value)
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
const legendIds = computed<SeriesId[]>(() => [...(props.session ? ['sessions' as const] : []), ...(props.communication?.supported === true ? ['upstreamMessages' as const, ...(qps.value.supported ? ['communicationQps' as const] : []), 'propertyReports' as const, 'eventReports' as const, 'receivedBytes' as const, 'sentBytes' as const, ...(props.recording?.data ? ['propertyValues' as const] : [])] : [])])
const defaultSeries: SeriesId[] = ['sessions', 'upstreamMessages', 'communicationQps']
// 旧模式仅恢复未配置系列的默认选择；显式图例选择始终允许跨单位组合。
const selectedIds = computed(() => props.config.deviceRuntimeSeries ?? (props.config.deviceRuntimeMode === 'traffic' ? ['sessions', 'receivedBytes', 'sentBytes'] : defaultSeries))
const selectedActiveIds = computed(() => legendIds.value.filter(id => selectedIds.value.includes(id)))
const messageAxisVisible = computed(() => selectedActiveIds.value.some(id => id !== 'sessions' && !id.endsWith('Bytes')))
const trafficAxisVisible = computed(() => selectedActiveIds.value.some(id => id.endsWith('Bytes')))
const hasSelectedSeries = computed(() => selectedActiveIds.value.length > 0)
function restoreDefaults() { emit('configure', { deviceRuntimeSeries: [...defaultSeries] }) }
interface PlotPoint { value: [number, number | null]; exact?: string; timestamp: number; propertyValues?: number; receivedQps?: number; sentQps?: number; windowMillis?: number }
const sampledPlots = computed(() => Object.fromEntries(seriesIds.map(id => [id, id === 'sessions'
  ? (props.session?.history ?? []).map(point => ({ value: [point.timestamp, point.value === undefined ? null : Number(point.value)], timestamp: point.timestamp, exact: point.value }))
  : id === 'communicationQps' ? qps.value.history.map(point => ({ value: [point.timestamp, point.values?.communicationQps ?? null], timestamp: point.timestamp, receivedQps: point.values?.receivedQps, sentQps: point.values?.sentQps, windowMillis: point.windowMillis }))
  : rates.value.map(point => ({ value: [point.timestamp, point[id as Exclude<keyof DeviceMessageRates, 'timestamp'>] ?? null], timestamp: point.timestamp, propertyValues: point.propertyValues }))])) as Record<SeriesId, PlotPoint[]>)
/** 后端整秒历史直接补齐首次打开页面前的曲线；会话沿用自己的真实采样，不插值补点。 */
const allPlots = computed(() => {
  if (!props.recording?.data) return sampledPlots.value
  const points = props.recording.points, from = points[0]?.timestamp, to = points.at(-1)?.timestamp
  const result = { ...sampledPlots.value }
  for (const [id, metric] of Object.entries(recordingSeriesMetric)) result[id as Exclude<SeriesId, 'sessions'>] = points.map(point => ({ value: [point.timestamp, point.values[metric]], timestamp: point.timestamp, propertyValues: point.values.PropertyValues, receivedQps: point.values.ReceivedPackets, sentQps: point.values.SentPackets, windowMillis: 1000 }))
  result.sessions = result.sessions.filter(point => from !== undefined && to !== undefined && point.timestamp >= from && point.timestamp <= to)
  return result
})
function selectPeak(selection: DevicePeakSelection) {
  const id = peakSeries(selection.peak.metric)
  emit('configure', { deviceRuntimeSeries: [...new Set([...selectedIds.value, id])] })
  emit('peak', selection)
}
const sourcePlots = computed(() => Object.fromEntries(seriesIds.map(id => [id, legendIds.value.includes(id) ? allPlots.value[id] : []])) as Record<SeriesId, PlotPoint[]>)
const sessionAxisVisible = computed(() => selectedActiveIds.value.includes('sessions') && (!props.recording?.focus || allPlots.value.sessions.length > 0))
const tooltipRadius = computed(() => {
  const intervals = [props.session?.history ?? [], history.value].flatMap(points => points.flatMap((point, index) => index && point.timestamp > points[index - 1].timestamp ? [point.timestamp - points[index - 1].timestamp] : [])).sort((left, right) => left - right)
  return (intervals[Math.floor(intervals.length / 2)] ?? 0) / 2
})
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
/** 浮层汇总全部相关指标；最近邻仅匹配半个采集周期，保留缺测及真实时间，QPS 另含自身窗口。 */
function tooltip(parameters: unknown) {
  const items = Array.isArray(parameters) ? parameters : [parameters]
  const anchor = items.flatMap(parameter => {
    if (!parameter || typeof parameter !== 'object') return []
    const item = parameter as { axisValue?: number; data?: PlotPoint }, timestamp = item.axisValue ?? item.data?.timestamp
    return typeof timestamp === 'number' && Number.isFinite(timestamp) ? [timestamp] : []
  })[0]
  if (anchor === undefined) return ''
  const groups = new Map<number, string[]>()
  const row = (name: string, value: string, marker = '', secondary = false, retained = false) => `<tr${secondary ? ' class="device-runtime-tooltip-detail"' : ''}><td>${marker}${escape(name)}${retained ? `<small>${escape(t('RuntimeMonitor.deviceRuntimeStale'))}</small>` : ''}</td><td>${escape(value)}</td></tr>`
  for (const id of legendIds.value) {
    let point = allPlots.value[id].reduce<PlotPoint | undefined>((nearest, candidate) => !nearest || Math.abs(candidate.timestamp - anchor) <= Math.abs(nearest.timestamp - anchor) ? candidate : nearest, undefined)
    if (point && (Math.abs(point.timestamp - anchor) > tooltipRadius.value + (id === 'communicationQps' ? point.windowMillis ?? 0 : 0) || id === 'sessions' && incomparableClocks.value)) point = undefined
    const value = !point || point.value[1] === null ? '—' : id === 'sessions' ? point.exact === undefined ? '—' : `${exact(point.exact)} ${t('RuntimeMonitor.deviceRuntimeRecordsUnit')}` : id.endsWith('Bytes') ? bytes(point.value[1]) : `${rate(point.value[1])} ${t(id === 'communicationQps' ? 'RuntimeMonitor.deviceRuntimeQpsUnit' : id === 'propertyValues' ? 'RuntimeMonitor.devicePeakPointsUnit' : 'RuntimeMonitor.deviceRuntimeMessagesUnit')}`
    const retained = id === 'sessions' ? sessionRetained.value : props.recording?.data ? communicationRetained.value : id === 'communicationQps' ? qps.value.stale || realtimeRetained.value : communicationRetained.value
    const timestamp = point?.timestamp ?? anchor, rows = groups.get(timestamp) ?? []
    const marker = `<span class="device-runtime-tooltip-marker" style="background:${escape(seriesColors.value[seriesIds.indexOf(id)] ?? 'currentColor')}"></span>`
    rows.push(row(label(id), value, marker, false, retained && value !== '—'))
    if (id === 'propertyReports') rows.push(row(t('RuntimeMonitor.deviceRuntimePropertyValues'), point?.propertyValues === undefined ? '—' : `${rate(point.propertyValues)} ${t('RuntimeMonitor.deviceRuntimePropertyValuesUnit')}`, '', true))
    if (id === 'communicationQps' && point && point.value[1] !== null) {
      rows.push(row(t('RuntimeMonitor.deviceRuntimeReceived'), `${rate(point.receivedQps)} ${t('RuntimeMonitor.deviceRuntimeQpsUnit')}`, '', true), row(t('RuntimeMonitor.deviceRuntimeSent'), `${rate(point.sentQps)} ${t('RuntimeMonitor.deviceRuntimeQpsUnit')}`, '', true))
      if (point.windowMillis !== undefined) rows.push(`<tr class="device-runtime-tooltip-detail"><td colspan="2">${escape(windowDescription(point.windowMillis))}</td></tr>`)
    }
    groups.set(timestamp, rows)
  }
  return groups.size ? `<div class="device-runtime-tooltip">${[...groups].map(([timestamp, rows]) => `<section><time>${escape(tooltipTime.value.format(timestamp))}</time><table><tbody>${rows.join('')}</tbody></table></section>`).join('')}</div>` : ''
}
const events = {
  legendselectchanged: (event: unknown) => {
    if (!event || typeof event !== 'object') return
    const { selected } = event as { selected?: Record<string, boolean> }
    if (!selected || typeof selected !== 'object') return
    const next = new Set(selectedIds.value)
    // ECharts 回传完整选择；只应用明确的布尔值，保留暂未提供能力的偏好。
    for (const id of legendIds.value) if (typeof selected[label(id)] === 'boolean') {
      if (selected[label(id)]) next.add(id); else next.delete(id)
    }
    emit('configure', { deviceRuntimeSeries: [...next] })
  },
  datazoom: (event: unknown) => {
    const value = event as { start?: number; end?: number; batch?: Array<{ start?: number; end?: number }> }, zoom = value.batch?.[0] ?? value
    if (typeof zoom.start === 'number' && typeof zoom.end === 'number' && zoom.start < zoom.end) emit('configure', { deviceRuntimeZoom: { start: zoom.start, end: zoom.end } })
  },
}
/** 系列与三个单位轴使用固定身份，图例自由组合，隐藏轴不挤占绘图区域。 */
const option = computed(() => {
  const times = selectedActiveIds.value.flatMap(id => plotted.value[id].map(point => point.timestamp)), start = times.length ? Math.min(...times) : undefined, end = times.length ? Math.max(...times) : undefined
  const zoom = props.recording?.focus && !props.recording.outside ? { start: 0, end: 100 } : props.config.deviceRuntimeZoom ?? { start: 0, end: 100 }
  return { animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12 }, grid: { top: 32, left: sessionAxisVisible.value ? 50 : 16, right: trafficAxisVisible.value && messageAxisVisible.value ? 120 : trafficAxisVisible.value || messageAxisVisible.value ? 64 : 16, bottom: 40 },
    legend: { top: 0, left: 0, type: 'scroll', icon: 'rect', selectedMode: true, data: legendIds.value.map(label), selected: Object.fromEntries(seriesIds.map(id => [label(id), legendIds.value.includes(id) && selectedIds.value.includes(id)])), itemWidth: 16, itemHeight: 2, textStyle: { color: token.value.colorTextSecondary } },
    tooltip: { trigger: 'axis', confine: true, enterable: true, renderMode: 'html', backgroundColor: token.value.colorBgElevated, borderColor: token.value.colorBorderSecondary, textStyle: { fontSize: 12 }, formatter: tooltip },
    xAxis: { type: 'time', min: start, max: start === end && end !== undefined ? end + 30000 : end, splitNumber: 4, axisLabel: { hideOverlap: true, color: token.value.colorTextTertiary, formatter: (value: number) => axisTime.value.format(value) }, splitLine: { show: false } },
    media: [{ query: { maxWidth: 480 }, option: { xAxis: { splitNumber: 2 } } }, { option: { xAxis: { splitNumber: 4 } } }],
    yAxis: [
      { id: 'sessions', type: 'value', position: 'left', show: sessionAxisVisible.value, name: '', min: 0, minInterval: 1, axisLabel: { color: token.value.colorTextTertiary, formatter: compactCount }, splitLine: { lineStyle: { color: token.value.colorSplit } } },
      { id: 'messages', type: 'value', position: 'right', show: messageAxisVisible.value, name: '', min: 0, axisLabel: { color: token.value.colorTextTertiary, formatter: compactCount }, splitLine: { show: !sessionAxisVisible.value, lineStyle: { color: token.value.colorSplit } } },
      { id: 'traffic', type: 'value', position: 'right', offset: messageAxisVisible.value ? 64 : 0, show: trafficAxisVisible.value, name: '', min: 0, axisLabel: { color: token.value.colorTextTertiary, formatter: (value: number) => bytes(value).replace('/s', '') }, splitLine: { show: !sessionAxisVisible.value && !messageAxisVisible.value, lineStyle: { color: token.value.colorSplit } } },
    ],
    dataZoom: [{ id: 'device-runtime-inside', type: 'inside', filterMode: 'none', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, ...zoom }, { id: 'device-runtime-slider', type: 'slider', height: 14, bottom: 0, showDetail: false, brushSelect: false, borderColor: 'transparent', ...zoom }],
    series: seriesIds.map((id, index) => ({ id, name: label(id), type: 'line', yAxisIndex: id === 'sessions' ? 0 : id.endsWith('Bytes') ? 2 : 1, data: plotted.value[id], connectNulls: false, showSymbol: false, symbolSize: 4, lineStyle: { width: 1.8 }, itemStyle: { color: seriesColors.value[index] }, emphasis: { focus: 'series' }, markLine: { symbol: 'none', silent: true, lineStyle: { color: token.value.colorWarning, type: 'dashed' }, label: { show: false }, data: props.recording?.focus && !props.recording.outside && peakSeries(props.recording.focus.peak.metric) === id ? [{ xAxis: props.recording.focus.peak.timestamp }] : [] } })),
  }
})
</script>
<style scoped>
.device-runtime-trend { min-width:0; padding:var(--space-2,8px) 0 var(--space-3,12px); }
.device-runtime-heading { display:flex; flex-wrap:wrap; align-items:center; gap:6px 20px; min-height:26px; margin-bottom:8px; color:var(--ink-2); font-size:var(--fs-12,12px); font-weight:400; }
.device-runtime-title { display:inline-flex; align-items:center; gap:6px; line-height:22px; }.device-runtime-title > strong { color:var(--ink-1); font-size:var(--fs-body,14px); font-weight:600; }.device-runtime-title > :deep(.anticon) { font-size:14px; }
.device-runtime-reading { display:inline-flex; align-items:center; gap:6px; line-height:22px; white-space:nowrap; }.device-runtime-session { display:inline-flex; height:auto; padding:0; border:0; color:var(--ink-2); font-size:inherit; line-height:inherit; }.device-runtime-heading .device-runtime-reading--action b { color:var(--brand-5,#1677ff); }.device-runtime-reading > :deep(.anticon) { font-size:14px; }.device-runtime-reading b { color:var(--ink-1); font-size:var(--fs-16,16px); line-height:inherit; font-weight:600; font-variant-numeric:tabular-nums; }.device-runtime-heading small { font-size:var(--fs-12,12px); font-weight:400; }.device-runtime-retained { opacity:.65; }.device-runtime-chart { position:relative; height:240px; min-width:0; }.device-runtime-empty { position:absolute; inset:32px 20px 40px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:var(--ink-2); font-size:var(--fs-12,12px); pointer-events:none; }.device-runtime-empty :deep(.ant-btn) { height:auto; padding:0; font-size:inherit; pointer-events:auto; }
.device-runtime-axes { display:flex; flex-wrap:wrap; gap:4px 16px; margin-top:6px; color:var(--ink-2); font-size:var(--fs-12,12px); line-height:20px; }
.device-runtime-chart :deep(.device-runtime-tooltip) { min-width:220px; max-width:min(320px,calc(100vw - 48px)); max-height:300px; overflow:auto; white-space:normal; color:var(--ink-2); }
.device-runtime-chart :deep(.device-runtime-tooltip-marker) { display:inline-block; width:8px; height:8px; margin-right:6px; border-radius:50%; vertical-align:middle; }
.device-runtime-chart :deep(.device-runtime-tooltip section + section) { margin-top:10px; padding-top:8px; border-top:1px solid var(--line); }
.device-runtime-chart :deep(.device-runtime-tooltip time) { display:block; margin-bottom:4px; color:var(--ink-2); font-size:12px; font-variant-numeric:tabular-nums; }
.device-runtime-chart :deep(.device-runtime-tooltip table) { width:100%; border-collapse:collapse; font-size:12px; line-height:20px; }
.device-runtime-chart :deep(.device-runtime-tooltip td) { padding:2px 0; vertical-align:top; }
.device-runtime-chart :deep(.device-runtime-tooltip td + td) { padding-left:16px; text-align:right; white-space:nowrap; color:var(--ink-1); font-weight:600; font-variant-numeric:tabular-nums; }
.device-runtime-chart :deep(.device-runtime-tooltip td small) { margin-left:6px; color:var(--ink-2); font-size:11px; }
.device-runtime-chart :deep(.device-runtime-tooltip .device-runtime-tooltip-detail td) { color:var(--ink-2); font-size:11px; font-weight:400; }
.device-runtime-chart :deep(.device-runtime-tooltip-detail td:first-child) { padding-left:14px; }
.device-runtime-cache { display:flex; flex-wrap:wrap; align-items:center; gap:4px 6px; margin-top:8px; color:var(--ink-2); font-size:var(--fs-sm,13px); }.device-runtime-cache b { color:var(--ink-2); font-weight:500; font-variant-numeric:tabular-nums; }.device-runtime-cache :deep(.ant-btn) { height:auto; padding:0; font-size:inherit; line-height:inherit; }.device-runtime-cache small { font-size:var(--fs-12,12px); }.device-runtime-cache > :deep(.anticon) { font-size:14px; }.device-runtime-cache-value { white-space:nowrap; }
.device-runtime-clock-note { display:block; margin-top:6px; color:var(--ink-2); font-size:var(--fs-12,12px); font-weight:400; }
@media (max-width:560px) { .device-runtime-heading { gap:6px 14px; } }
</style>
