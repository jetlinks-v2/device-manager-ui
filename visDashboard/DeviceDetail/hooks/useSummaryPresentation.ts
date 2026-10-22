import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMessageTrendOption, createStatCard, formatBytes, formatCount, formatDuration } from '../../../views/device/list/components/device-detail/iotDeviceOverviewCharts'
import { formatMessageTrendAxisLabels } from '../../../views/device/list/components/device-detail/iotDeviceOverviewTime'
import type { OverviewSummary, SummaryPoint } from '../shared'

/** 数值格式与曲线统一由现有详情工具生成，避免四张指标卡各维护一份口径。 */
export function useSummaryPresentation(summary: Readonly<Ref<OverviewSummary | undefined>>) {
  const { t } = useI18n()
  const values = (points?: SummaryPoint[]) => (points ?? []).map(item => item.value)
  const labels = (points?: SummaryPoint[]) => formatMessageTrendAxisLabels((points ?? []).map(item => item.time))
  const series = computed(() => ({ up: values(summary.value?.upstream.buckets), down: values(summary.value?.downstream.buckets) }))
  const axis = computed(() => labels(summary.value?.upstream.buckets))
  const totals = computed(() => ({ up: summary.value?.upstream.total ?? 0, down: summary.value?.downstream.total ?? 0 }))
  const traffic = computed(() => ({ up: formatBytes(summary.value?.traffic.upstreamBytes ?? 0), down: formatBytes(summary.value?.traffic.downstreamBytes ?? 0) }))
  const cards = computed(() => {
    const data = summary.value
    return {
      ActiveDuration: createStatCard('active', t('IotDeviceDetail.overview.stat.activeDuration'), formatDuration(data?.activeDuration.total ?? 0), '', t('IotDeviceDetail.overview.stat.activeDurationHint'), 'purple', values(data?.activeDuration.buckets), labels(data?.activeDuration.buckets)),
      Upstream: createStatCard('up', t('IotDeviceDetail.overview.stat.todayUpstream'), formatCount(totals.value.up), t('IotDeviceDetail.overview.unit.message'), t('IotDeviceDetail.overview.stat.peakPerHour', { value: formatCount(Math.max(...series.value.up, 0)) }), 'violet', series.value.up, axis.value),
      Downstream: createStatCard('down', t('IotDeviceDetail.overview.stat.todayDownstream'), formatCount(totals.value.down), t('IotDeviceDetail.overview.unit.message'), t('IotDeviceDetail.overview.stat.peakPerHour', { value: formatCount(Math.max(...series.value.down, 0)) }), 'orange', series.value.down, axis.value),
      Traffic: createStatCard('traffic', t('IotDeviceDetail.overview.stat.todayTraffic'), formatBytes(data?.traffic.total ?? 0), '', t('IotDeviceDetail.overview.trafficSummary', { upstream: traffic.value.up, downstream: traffic.value.down }), 'cyan', values(data?.traffic.buckets), labels(data?.traffic.buckets)),
    }
  })
  const option = computed(() => createMessageTrendOption(axis.value, series.value, Math.max(...series.value.up, ...series.value.down, 1)))
  return { cards, totals, traffic, option }
}
