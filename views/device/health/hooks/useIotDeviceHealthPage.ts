import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'

import { IOT_MOCK_PROJECT_ID, iotDeviceService } from '@device-manager-ui/services/iotDevice.service'
import {
  getIotDeviceBusinessStatuses,
  getIotDeviceConnectionStatus,
  getIotDeviceRiskKinds,
} from '@device-manager-ui/hooks/useIotDeviceStatus'
import type { IotDevice } from '@device-manager-ui/types'
import { resolveIotProjectId } from '../../list/hooks/useIotDeviceRouting'

export type HealthWindowKey = '7d' | '30d' | '90d'
export type HealthTone = 'good' | 'brand' | 'warn' | 'danger' | 'muted'

export interface HealthDimensionItem {
  key: string
  label: string
  score: number
  weight: number
  delta: number
  tone: HealthTone
}

export interface HealthTreeNode {
  id: string
  label: string
  count: number
  tone: HealthTone
  children?: HealthTreeNode[]
  deviceId?: string
  score?: number
  device?: IotDevice
}

export interface HealthInfoItem {
  key: string
  label: string
  value: string
  mono?: boolean
}

export interface HealthEventItem {
  id: string
  title: string
  desc: string
  meta: string
  time: string
  tone: HealthTone
}

export interface HealthAlarmItem {
  id: string
  level: string
  title: string
  time: string
  status: string
  tone: HealthTone
}

interface ScoredDevice {
  device: IotDevice
  score: number
  delta: number
}

const $t = i18n.global.t

const windowOptions: Array<{ labelKey: string; value: HealthWindowKey }> = [
  { labelKey: 'IotWorkbench.option.time.7d', value: '7d' },
  { labelKey: 'IotWorkbench.option.time.30d', value: '30d' },
  { labelKey: 'IotWorkbench.option.time.90d', value: '90d' },
]

function clampScore(value: number) {
  return Math.max(18, Math.min(98, Math.round(value)))
}

function scoreDevice(device: IotDevice) {
  let score = 96
  const connectionStatus = getIotDeviceConnectionStatus(device)
  const businessStatuses = getIotDeviceBusinessStatuses(device)

  if (connectionStatus === 'offline') score -= 36
  if (connectionStatus === 'disabled') score -= 18
  if (businessStatuses.includes('alarm')) score -= 18
  if (businessStatuses.includes('no-data')) score -= 16
  if (businessStatuses.includes('maintenance')) score -= 10
  if (device.risk === 'watch') score -= 14
  if (device.risk === 'urgent') score -= 32
  score -= Math.min(device.alarms.length * 4, 16)
  score -= Math.min(device.currentFaultCodes?.length ?? 0, 2) * 8

  return clampScore(score)
}

function scoreTone(score: number): HealthTone {
  if (score < 60) return 'danger'
  if (score < 80) return 'warn'
  if (score < 90) return 'brand'
  return 'good'
}

function deviceDelta(device: IotDevice, score: number, window: HealthWindowKey) {
  const riskKinds = getIotDeviceRiskKinds(device)
  const windowWeight = window === '7d' ? 0.72 : window === '90d' ? 1.18 : 1
  const base =
    riskKinds.length * 8 +
    (device.risk === 'urgent' ? 14 : device.risk === 'watch' ? 7 : -4) +
    Math.min(device.alarms.length * 3, 12) +
    Math.min(device.currentFaultCodes?.length ?? 0, 2) * 6

  if (score >= 88 && !riskKinds.length) return Math.round((2 + (device.id.length % 3)) * windowWeight)
  return -Math.round(Math.max(4, base) * windowWeight)
}

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, item) => sum + item, 0) / values.length)
}

function buildTrend(score: number, delta: number, window: HealthWindowKey) {
  const points = window === '7d' ? 7 : 15
  const startValue = clampScore(score - delta)
  return Array.from({ length: points }, (_, index) => {
    const progress = index / Math.max(points - 1, 1)
    const wave = Math.sin(index * 0.9) * (window === '90d' ? 5 : 3)
    return clampScore(startValue + (score - startValue) * progress + wave)
  })
}

function buildTrendLabels(window: HealthWindowKey) {
  if (window === '7d') return ['5/15', '5/16', '5/17', '5/18', '5/19', '5/20', '5/21']
  if (window === '90d') return ['2/21', '3/7', '3/21', '4/4', '4/18', '5/2', '5/16']
  return ['4/22', '4/27', '5/2', '5/7', '5/12', '5/17', '5/21']
}

function deviceAreaPath(device: IotDevice) {
  return [device.area, device.location].filter(Boolean).join(' / ')
}

function healthLevel(score: number) {
  if (score < 60) return $t('IotHealthPage.detail.level.danger')
  if (score < 80) return $t('IotHealthPage.detail.level.watch')
  return $t('IotHealthPage.detail.level.good')
}

function connectionLabel(device: IotDevice) {
  const status = getIotDeviceConnectionStatus(device)
  if (status === 'offline') return $t('IotWorkbench.option.connection.offline')
  if (status === 'disabled') return $t('IotWorkbench.option.connection.disabled')
  return $t('IotWorkbench.option.connection.online')
}

function connectionTone(device: IotDevice): HealthTone {
  const status = getIotDeviceConnectionStatus(device)
  if (status === 'offline') return 'danger'
  if (status === 'disabled') return 'muted'
  return 'good'
}

function alarmLevelLabel(level: IotDevice['alarms'][number]['payload']['level']) {
  if (level === '紧急') return $t('IotDeviceDetail.common.level.critical')
  if (level === '重要') return $t('IotDeviceDetail.common.level.major')
  return $t('IotDeviceDetail.common.level.info')
}

function buildDimensions(item: ScoredDevice, window: HealthWindowKey): HealthDimensionItem[] {
  const { device, score, delta } = item
  const connectionStatus = getIotDeviceConnectionStatus(device)
  const stale = device.telemetry.filter((point) => point.status === 'stale').length
  const abnormal = device.telemetry.filter((point) => point.status === 'warning' || point.status === 'critical').length
  const link = clampScore(94 - (connectionStatus === 'offline' ? 42 : 0) - (getIotDeviceBusinessStatuses(device).includes('no-data') ? 24 : 0))
  const data = clampScore(92 - stale * 12 - abnormal * 10 - (getIotDeviceBusinessStatuses(device).includes('no-data') ? 24 : 0))
  const latency = clampScore(86 - Math.min(device.logs.length, 8) * 3 - (device.alarms.length ? 10 : 0))
  const power = clampScore(score + 4 - (device.risk === 'urgent' ? 16 : 0) - (device.currentFaultCodes?.length ? 10 : 0))
  const deltaWeight = window === '7d' ? 1 : window === '90d' ? 1.2 : 0.9
  const rows = [
    { key: 'link', label: $t('IotHealthPage.dimension.link'), score: link, weight: 30, delta: Math.round((delta + 4) * deltaWeight), tone: scoreTone(link) },
    { key: 'data', label: $t('IotHealthPage.dimension.data'), score: data, weight: 25, delta: Math.round((delta - 6) * deltaWeight), tone: scoreTone(data) },
    { key: 'latency', label: $t('IotHealthPage.dimension.latency'), score: latency, weight: 25, delta: Math.round((delta - 2) * deltaWeight), tone: scoreTone(latency) },
    { key: 'power', label: $t('IotHealthPage.dimension.power'), score: power, weight: 20, delta: Math.round((delta - 4) * deltaWeight), tone: scoreTone(power) },
  ]
  return rows
}

function buildInfoItems(device: IotDevice): HealthInfoItem[] {
  return [
    { key: 'id', label: $t('IotHealthPage.detail.field.id'), value: device.identifier, mono: true },
    { key: 'type', label: $t('IotHealthPage.detail.field.type'), value: device.productName },
    { key: 'protocol', label: $t('IotHealthPage.detail.field.protocol'), value: device.accessMode || 'MQTT' },
    { key: 'area', label: $t('IotHealthPage.detail.field.area'), value: deviceAreaPath(device) },
    { key: 'group', label: $t('IotHealthPage.detail.field.group'), value: device.deviceType },
    { key: 'owner', label: $t('IotHealthPage.detail.field.owner'), value: device.owner },
    { key: 'lastSeen', label: $t('IotHealthPage.detail.field.lastSeen'), value: device.lastSeen, mono: true },
    { key: 'gateway', label: $t('IotHealthPage.detail.field.gateway'), value: device.gatewayName || '-' },
  ]
}

function buildEvents(item: ScoredDevice): HealthEventItem[] {
  const { device, score, delta } = item
  const abnormalPoints = device.telemetry.filter((point) => point.status === 'warning' || point.status === 'critical' || point.status === 'stale')
  const rows: HealthEventItem[] = [
    ...abnormalPoints.slice(0, 3).map((point, index) => ({
      id: `telemetry-${point.key}`,
      title: $t('IotHealthPage.detail.event.telemetry', { name: point.name }),
      desc: point.hint || $t('IotHealthPage.detail.event.telemetryDesc'),
      meta: `${point.value}${point.unit || ''} · ${point.updatedAt}`,
      time: index === 0 ? $t('IotHealthPage.detail.time.now') : point.updatedAt,
      tone: point.status === 'critical' ? 'danger' : 'warn' as HealthTone,
    })),
    ...device.alarms.slice(0, 3).map((alarm) => ({
      id: `alarm-${alarm.id}`,
      title: alarm.payload.summary || $t('IotHealthPage.detail.event.alarm'),
      desc: alarm.payload.faultCode || $t('IotHealthPage.detail.event.alarmDesc'),
      meta: alarmLevelLabel(alarm.payload.level),
      time: alarm.timestamp,
      tone: alarm.payload.level === '紧急' ? 'danger' : 'warn' as HealthTone,
    })),
  ]
  if (rows.length) return rows.slice(0, 5)
  return [{
    id: 'score',
    title: $t('IotHealthPage.detail.event.score', { score }),
    desc: delta < 0 ? $t('IotHealthPage.detail.event.scoreDown') : $t('IotHealthPage.detail.event.scoreStable'),
    meta: $t('IotHealthPage.detail.event.derived'),
    time: device.lastSeen,
    tone: scoreTone(score),
  }]
}

function buildAlarms(device: IotDevice): HealthAlarmItem[] {
  return device.alarms.slice(0, 4).map((alarm, index) => ({
    id: alarm.id,
    level: alarm.payload.level === '紧急' ? 'P1' : alarm.payload.level === '重要' ? 'P2' : 'P3',
    title: alarm.payload.summary,
    time: alarm.timestamp,
    status: index === 0 ? $t('IotHealthPage.detail.alarm.open') : $t('IotHealthPage.detail.alarm.acked'),
    tone: alarm.payload.level === '紧急' ? 'danger' : alarm.payload.level === '重要' ? 'warn' : 'brand',
  }))
}

function filterDevices(scored: ScoredDevice[], predicate: (item: ScoredDevice) => boolean) {
  return scored.filter(predicate).sort((a, b) => a.score - b.score)
}

function toDeviceNodes(items: ScoredDevice[]): HealthTreeNode[] {
  return items.slice(0, 8).map((item) => ({
    id: `device-${item.device.id}`,
    label: item.device.name,
    count: 0,
    tone: scoreTone(item.score),
    deviceId: item.device.id,
    score: item.score,
    device: item.device,
  }))
}

function buildTree(scored: ScoredDevice[]): HealthTreeNode[] {
  const danger = filterDevices(scored, (item) => item.score < 60)
  const watch = filterDevices(scored, (item) => item.score >= 60 && item.score < 80)
  const healthy = filterDevices(scored, (item) => item.score >= 80)
  const dataDeviation = filterDevices(scored, (item) => item.device.telemetry.some((point) => point.status === 'warning' || point.status === 'critical' || point.status === 'stale'))
  const connection = filterDevices(scored, (item) => getIotDeviceConnectionStatus(item.device) === 'offline' || getIotDeviceBusinessStatuses(item.device).includes('no-data'))
  const latency = filterDevices(scored, (item) => item.device.logs.length > 2 || item.device.alarms.length > 0)
  const power = filterDevices(scored, (item) => item.device.risk === 'urgent' || Boolean(item.device.currentFaultCodes?.length))

  return [
    { id: 'all', label: $t('IotHealthPage.tree.all'), count: scored.length, tone: 'muted', children: toDeviceNodes(scored) },
    {
      id: 'danger',
      label: $t('IotHealthPage.tree.danger'),
      count: danger.length,
      tone: 'danger',
      children: [
        { id: 'data-deviation', label: $t('IotHealthPage.tree.dataDeviation'), count: dataDeviation.length, tone: 'danger', children: toDeviceNodes(dataDeviation) },
        { id: 'connection', label: $t('IotHealthPage.tree.connection'), count: connection.length, tone: 'danger', children: toDeviceNodes(connection) },
        { id: 'latency', label: $t('IotHealthPage.tree.latency'), count: latency.length, tone: 'warn', children: toDeviceNodes(latency) },
        { id: 'power', label: $t('IotHealthPage.tree.power'), count: power.length, tone: 'danger', children: toDeviceNodes(power) },
      ],
    },
    {
      id: 'watch',
      label: $t('IotHealthPage.tree.watch'),
      count: watch.length,
      tone: 'warn',
      children: [
        { id: 'jitter', label: $t('IotHealthPage.tree.jitter'), count: watch.length, tone: 'warn', children: toDeviceNodes(watch) },
      ],
    },
    { id: 'healthy', label: $t('IotHealthPage.tree.healthy'), count: healthy.length, tone: 'good', children: toDeviceNodes(healthy) },
  ]
}

export function useIotDeviceHealthPage() {
  const route = useRoute()
  const projectId = computed(() => resolveIotProjectId(route, IOT_MOCK_PROJECT_ID))
  const activeWindow = ref<HealthWindowKey>('30d')
  const loading = ref(false)
  const error = ref('')
  const devices = ref<IotDevice[]>([])
  const selectedDeviceId = ref('')
  const hasDevices = computed(() => devices.value.length > 0)

  const scoredDevices = computed<ScoredDevice[]>(() =>
    devices.value.map((device) => {
      const score = scoreDevice(device)
      return { device, score, delta: deviceDelta(device, score, activeWindow.value) }
    }),
  )

  const averageScore = computed(() => average(scoredDevices.value.map((item) => item.score)))
  const previousAverageScore = computed(() => average(scoredDevices.value.map((item) => clampScore(item.score - item.delta))))
  const averageDelta = computed(() => averageScore.value - previousAverageScore.value)
  const treeNodes = computed(() => buildTree(scoredDevices.value))
  const selected = computed(() => scoredDevices.value.find((item) => item.device.id === selectedDeviceId.value) ?? scoredDevices.value[0])
  const selectedTone = computed(() => selected.value ? scoreTone(selected.value.score) : 'muted')
  const dimensions = computed(() => selected.value ? buildDimensions(selected.value, activeWindow.value) : [])
  const trend = computed(() => selected.value ? buildTrend(selected.value.score, selected.value.delta, activeWindow.value) : [])
  const trendLabels = computed(() => buildTrendLabels(activeWindow.value))
  const infoItems = computed(() => selected.value ? buildInfoItems(selected.value.device) : [])
  const events = computed(() => selected.value ? buildEvents(selected.value) : [])
  const alarms = computed(() => selected.value ? buildAlarms(selected.value.device) : [])
  const averageSummary = computed(() => ({
    score: averageScore.value,
    delta: averageDelta.value,
    total: scoredDevices.value.length,
  }))

  const currentWindowLabel = computed(() => {
    const option = windowOptions.find((item) => item.value === activeWindow.value)
    return option ? $t(option.labelKey) : $t('IotWorkbench.option.time.30d')
  })

  async function load() {
    loading.value = true
    error.value = ''
    const result = await iotDeviceService.getWorkbench({ projectId: projectId.value })
    if (result.ok) {
      devices.value = result.data.devices
      selectedDeviceId.value = [...result.data.devices]
        .map((device) => ({ id: device.id, score: scoreDevice(device) }))
        .sort((a, b) => a.score - b.score)[0]?.id ?? ''
    } else {
      error.value = $t('IotHealthPage.error.load')
    }
    loading.value = false
  }

  function selectDevice(id: string) {
    selectedDeviceId.value = id
  }

  // 项目态路由切换会改变数据权限上下文，健康统计需要重新拉取同一口径设备集合。
  watch(projectId, () => {
    void load()
  })

  onMounted(() => {
    void load()
  })

  return {
    activeWindow,
    alarms,
    averageSummary,
    currentWindowLabel,
    events,
    dimensions,
    error,
    hasDevices,
    infoItems,
    loading,
    selected,
    selectedDeviceId,
    selectedTone,
    selectDevice,
    treeNodes,
    trend,
    trendLabels,
    windowOptions: computed(() => windowOptions.map((item) => ({ label: $t(item.labelKey), value: item.value }))),
    connectionLabel,
    connectionTone,
    deviceAreaPath,
    healthLevel,
  }
}
