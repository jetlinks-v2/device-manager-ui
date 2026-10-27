import { useI18n } from 'vue-i18n'
import { formatMemorySize } from '../utils/monitorData'
import { formatNetworkSize } from '../utils/networkData'
import { calculateCpuLoadPressure, getCpuLoadPressureLevel, type RealtimeNode } from '../utils/realtimeResourceData'

/** 资源摘要的统一展示口径，表格与实例概览共享；不创建请求或实时订阅。 */
export function useRealtimeResourcePresentation() {
  const { t } = useI18n()
  interface RealtimeMetricItem { label: string; value: string }
  const numberText = (value: number | undefined, digits = 0) => value === undefined ? '--' : value.toFixed(digits)
  const percentText = (value: number | undefined) => value === undefined ? '--' : `${value.toFixed(2)}%`
  const rateText = (value: number | undefined) => value === undefined ? '--' : `${formatNetworkSize(value)}/s`
  const capacityText = (used: number | undefined, total: number | undefined) => total === undefined
    ? '--'
    : `${formatMemorySize(used)} / ${formatMemorySize(total)}`
  const jvmMemoryDetail = (node: RealtimeNode) => [
    capacityText(node.memoryJvmUsed, node.memoryJvmTotal),
    t('components.RealtimeResource.nonHeapSize', [formatMemorySize(node.memoryJvmNonHeapUsed)]),
  ].join(' · ')
  const loadText = (node: RealtimeNode) => [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
    .map(value => numberText(value, 2)).join('/')
  const loadPercentText = (value: number | undefined) => value === undefined ? '--' : `${value.toFixed(1)}%`
  const loadStatusText = (node: RealtimeNode) => {
    const level = getCpuLoadPressureLevel(node.cpuLoadPressure)
    return level ? t(`components.RealtimeResource.loadStatus.${level}`) : ''
  }
  const loadSummary = (node: RealtimeNode) => node.cpuLoadPressure === undefined || !node.cpuLogicalProcessors
    ? `${t('components.RealtimeResource.loadAverage')} ${loadText(node)}`
    : t('components.RealtimeResource.loadPressureSummary', [
      loadPercentText(node.cpuLoadPressure),
      numberText(node.cpuLogicalProcessors),
      loadStatusText(node),
    ])
  const loadTooltip = (node: RealtimeNode) => {
    if (node.cpuLoadPressure === undefined || !node.cpuLogicalProcessors) return `${t('components.RealtimeResource.loadAverage')} ${loadText(node)}`
    const averages = [node.cpuLoadAverage1m, node.cpuLoadAverage5m, node.cpuLoadAverage15m]
    const pressures = averages.map(value => calculateCpuLoadPressure(value, node.cpuLogicalProcessors))
    return t('components.RealtimeResource.loadPressureTooltip', [
      ...averages.map(value => numberText(value, 2)),
      numberText(node.cpuLogicalProcessors),
      ...pressures.map(loadPercentText),
    ])
  }
  const loadStatusClass = (node: RealtimeNode) => {
    const level = getCpuLoadPressureLevel(node.cpuLoadPressure)
    return ['realtime-resource__load-status', level && `realtime-resource__load-status--${level}`]
  }
  const diskItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.diskRead'), value: rateText(node.diskReadBytesPerSecond) },
    { label: t('components.RealtimeResource.diskWrite'), value: rateText(node.diskWriteBytesPerSecond) },
  ]
  const networkTrafficItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.networkDownload'), value: rateText(node.networkReceiveBytesPerSecond) },
    { label: t('components.RealtimeResource.networkUpload'), value: rateText(node.networkSendBytesPerSecond) },
  ]
  const networkConnectionItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.tcpConnections'), value: numberText(node.tcpConnectionsEstablished) },
  ]
  const networkQualityItems = (node: RealtimeNode): RealtimeMetricItem[] => [
    { label: t('components.RealtimeResource.packetLoss'), value: percentText(node.receivePacketLossRate) },
    { label: t('components.RealtimeResource.retransmission'), value: percentText(node.tcpRetransmissionRate) },
  ]
  return { loadTooltip, loadStatusClass, loadSummary, jvmMemoryDetail, diskItems, networkTrafficItems, networkConnectionItems, networkQualityItems }
}
