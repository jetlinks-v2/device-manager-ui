<template>
  <span v-if="view.data" ref="controls" class="device-peak-controls" @keydown.esc.stop.prevent="close">
    <a-popover v-model:open="open" trigger="click" placement="bottomRight" :overlay-style="{ maxWidth: 'calc(100vw - 32px)' }">
      <a-button type="text" size="small" class="device-peak-trigger" :class="{ 'device-peak-retained': view.state === 'stale' }" :title="t('RuntimeMonitor.devicePeakHelp')"><LineChartOutlined /><span>{{ view.focus ? t('RuntimeMonitor.devicePeakFocused', { metric: t(`RuntimeMonitor.devicePeakMetric.${view.focus.peak.metric}`) }) : t('RuntimeMonitor.devicePeakHourShort') }}</span><b v-if="main">{{ format(main) }}</b><time v-if="main">{{ time(main.timestamp) }}</time><LoadingOutlined v-if="view.busy" spin /><DownOutlined v-else /></a-button>
      <template #content>
        <div class="device-peak-menu" @keydown.esc.stop.prevent="close">
          <div class="device-peak-period"><a-button v-for="value in periods" :key="value" :type="period === value ? 'link' : 'text'" size="small" @click="period = value">{{ t(`RuntimeMonitor.devicePeakPeriod.${value}`) }}</a-button><a-tooltip :title="t('RuntimeMonitor.devicePeakHelp')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t('RuntimeMonitor.devicePeakHelp')" /></a-tooltip></div>
          <div v-if="!rows.length" class="device-peak-empty">{{ t('RuntimeMonitor.devicePeakWaiting') }}</div>
          <a-button v-for="peak in rows" :key="peak.metric" type="text" class="device-peak-row" :title="t('RuntimeMonitor.devicePeakLocate')" @click="select(peak)"><span>{{ t(`RuntimeMonitor.devicePeakMetric.${peak.metric}`) }}</span><b>{{ format(peak) }}</b><time>{{ time(peak.timestamp) }}</time><AimOutlined /></a-button>
          <small class="device-peak-coverage">{{ t('RuntimeMonitor.devicePeakCoverage', { time: fullTime(Math.max(view.data.statisticsStartTime, period === 'today' ? view.data.todayStartTime : view.data.sampledAt - 3600000)), zone: view.data.zoneId }) }}</small>
          <small v-if="view.state === 'stale'" class="device-peak-coverage">{{ t('RuntimeMonitor.devicePeakStale') }}</small>
        </div>
      </template>
    </a-popover>
    <a-button v-if="view.focus" type="link" size="small" class="device-peak-live" @click="emit('live')"><RollbackOutlined />{{ t('RuntimeMonitor.devicePeakLive') }}</a-button>
  </span>
  <a-tooltip v-else-if="view.state === 'error'" :title="t('RuntimeMonitor.devicePeakLoadFailed')"><a-button type="text" size="small" class="device-peak-trigger" @click="emit('retry')"><WarningOutlined />{{ t('RuntimeMonitor.devicePeakRetry') }}</a-button></a-tooltip>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChartOutlined, DownOutlined, LoadingOutlined, RollbackOutlined, InfoCircleOutlined, AimOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { recordingMetrics, type DeviceRecordingView, type DevicePeak, type DevicePeakSelection } from '../../RuntimeMonitor/device-runtime/deviceMessageRecording'
const props = defineProps({ view: { type: Object as PropType<DeviceRecordingView>, required: true } })
const emit = defineEmits<{ select: [selection: DevicePeakSelection]; live: []; retry: [] }>()
const { t, locale } = useI18n(), controls = ref<HTMLElement>(), open = ref(false), period = ref<'hour' | 'today'>('hour'), periods = ['hour', 'today'] as const
const main = computed(() => props.view.focus?.peak ?? props.view.data?.hourPeaks.find(peak => peak.metric === 'Communication'))
const rows = computed(() => [...(period.value === 'hour' ? props.view.data?.hourPeaks ?? [] : props.view.data?.todayPeaks ?? [])].sort((a, b) => recordingMetrics.indexOf(a.metric) - recordingMetrics.indexOf(b.metric)))
const time = (value: number) => new Intl.DateTimeFormat(locale.value, { timeZone: props.view.data?.zoneId, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(value)
const fullTime = (value: number) => new Intl.DateTimeFormat(locale.value, { timeZone: props.view.data?.zoneId, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(value)
/** 数量、字节采用各自单位；峰值时刻始终按节点统计时区显示。 */
function format(peak: DevicePeak) {
  const bytes = peak.metric.endsWith('Bytes'), divisor = bytes ? peak.value >= 1048576 ? 1048576 : peak.value >= 1024 ? 1024 : 1 : 1
  const value = (peak.value / divisor).toLocaleString(locale.value, { maximumFractionDigits: 1 })
  return `${value} ${bytes ? divisor === 1048576 ? 'MB/s' : divisor === 1024 ? 'KB/s' : 'B/s' : t(peak.metric === 'PropertyValues' ? 'RuntimeMonitor.devicePeakPointsUnit' : ['UpstreamMessages', 'PropertyReports', 'EventReports'].includes(peak.metric) ? 'RuntimeMonitor.deviceRuntimeMessagesUnit' : 'RuntimeMonitor.deviceRuntimeQpsUnit')}`
}
function close() { open.value = false; controls.value?.querySelector('button')?.focus() }
function select(peak: DevicePeak) { close(); emit('select', { peak, scope: period.value }) }
watch(() => props.view.active, active => { if (!active) open.value = false })
</script>
<style scoped>
.device-peak-controls { display:inline-flex; flex-wrap:wrap; align-items:center; gap:4px; margin-inline-start:auto; min-width:0; }
.device-peak-trigger { display:inline-flex; align-items:center; gap:6px; height:auto; padding:0 4px; color:var(--ink-2); font-size:var(--fs-12,12px); line-height:24px; }.device-peak-trigger b { color:var(--ink-1); font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; }.device-peak-trigger time { font-variant-numeric:tabular-nums; }.device-peak-trigger :deep(.anticon) { font-size:12px; }.device-peak-retained { opacity:.65; }.device-peak-live { height:auto; padding:0 4px; font-size:var(--fs-12,12px); }
.device-peak-menu { width:360px; max-width:calc(100vw - 64px); }.device-peak-period { display:flex; align-items:center; gap:4px; padding-bottom:6px; border-bottom:1px solid var(--line); }.device-peak-period > :deep(.anticon) { margin-inline-start:auto; color:var(--ink-2); font-size:14px; }
.device-peak-row { display:grid; grid-template-columns:minmax(90px,1fr) auto 64px 14px; align-items:center; gap:10px; width:100%; height:32px; padding:0 4px; text-align:start; font-size:var(--fs-12,12px); }.device-peak-row span { min-width:0; overflow:hidden; text-overflow:ellipsis; }.device-peak-row b { font-weight:500; font-variant-numeric:tabular-nums; }.device-peak-row time { color:var(--ink-2); font-variant-numeric:tabular-nums; }.device-peak-row :deep(.anticon) { color:var(--ink-2); font-size:12px; }.device-peak-coverage { display:block; margin-top:8px; color:var(--ink-2); font-size:var(--fs-12,12px); line-height:18px; }.device-peak-empty { padding:16px 4px; color:var(--ink-2); font-size:var(--fs-12,12px); }
</style>
