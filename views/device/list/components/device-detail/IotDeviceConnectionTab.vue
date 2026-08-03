<template>
  <section class="connection-tab" :aria-label="$t('IotDeviceDetail.connection.aria')">
    <section class="connection-hero" :data-tone="connectionTone">
      <div class="connection-hero__icon" aria-hidden="true">
        <AIcon :type="connectionIcon" />
      </div>
      <div class="connection-hero__main">
        <div class="connection-hero__title">
          <strong>{{ connectionTitle }}</strong>
          <span>{{ connectionSubtitle }}</span>
        </div>
        <dl class="connection-facts">
          <div v-for="item in primaryFacts" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd :class="{ mono: item.mono }">{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="connection-grid">
      <article class="connection-panel">
        <header class="section-head">
          <div>
            <AIcon type="LineChartOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.connection.lifecycle') }}</h3>
          </div>
          <span>{{ $t('IotDeviceDetail.connection.last24Hours') }}</span>
        </header>
        <div class="connection-lane" aria-hidden="true">
          <span v-for="item in lifecycle" :key="`${item.id}-lane`" :data-status="item.status" />
        </div>
        <div class="timeline-list">
          <article v-for="item in lifecycle" :key="item.id" :data-status="item.status">
            <strong>{{ item.title }}</strong>
            <span>{{ item.time }}</span>
            <p>{{ item.detail }}</p>
          </article>
        </div>
      </article>

      <article class="connection-panel">
        <header class="section-head">
          <div>
            <AIcon type="SafetyCertificateOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.connection.quality') }}</h3>
          </div>
          <span>{{ qualityWindow }}</span>
        </header>
        <div class="quality-list">
          <article v-for="item in qualityMetrics" :key="item.label" :data-tone="item.tone">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <p>{{ item.detail }}</p>
          </article>
        </div>
      </article>
    </section>

    <section class="connection-grid">
      <article class="connection-panel">
        <header class="section-head">
          <div>
            <AIcon type="KeyOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.connection.identity') }}</h3>
          </div>
          <span>{{ $t('IotDeviceDetail.connection.maskedByDefault') }}</span>
        </header>
        <dl class="kv-list">
          <div v-for="item in identityFacts" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd :class="{ mono: item.mono }">{{ item.value }}</dd>
          </div>
        </dl>
      </article>

      <article class="connection-panel">
        <header class="section-head">
          <div>
            <AIcon type="FileSearchOutlined" aria-hidden="true" />
            <h3>{{ $t('IotDeviceDetail.connection.recentCommunication') }}</h3>
          </div>
          <span>{{ $t('IotDeviceDetail.common.count.item', { count: communicationLogs.length }) }}</span>
        </header>
        <div class="log-list">
          <article v-for="item in communicationLogs" :key="item.id" :data-level="item.level">
            <strong>{{ item.title }}</strong>
            <span>{{ item.happenedAt }}</span>
            <p>{{ item.message }}</p>
          </article>
        </div>
      </article>
    </section>

    <details class="technical-panel">
      <summary>
        <span>{{ $t('IotDeviceDetail.connection.technicalInfo') }}</span>
        <AIcon type="DownOutlined" aria-hidden="true" />
      </summary>
      <dl class="technical-grid">
        <div v-for="item in technicalFacts" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd class="mono">{{ item.value }}</dd>
        </div>
      </dl>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IotDevice, IotDeviceLog } from '../../types'

type ConnectionTone = 'online' | 'warning' | 'offline'

interface FactItem {
  label: string
  value: string | number
  mono?: boolean
}

interface QualityMetric {
  label: string
  value: string
  detail: string
  tone: ConnectionTone
}

interface LifecycleItem {
  id: string
  title: string
  time: string
  detail: string
  status: 'online' | 'offline' | 'warning'
}

const props = defineProps({
  device: {
    type: Object as PropType<IotDevice>,
    required: true,
  },
})

const { t: $t } = useI18n()

const isOnline = computed(() => props.device.status === 'online' || props.device.status === 'alarm')
const isOffline = computed(() => props.device.status === 'offline' || props.device.status === 'no-data')
const isDisabled = computed(() => props.device.status === 'disabled' || props.device.connectionStatus === 'disabled')

const connectionTone = computed<ConnectionTone>(() => {
  if (isDisabled.value) return 'offline'
  if (isOnline.value && props.device.risk === 'normal') return 'online'
  if (isOffline.value) return 'offline'
  return 'warning'
})

const connectionIcon = computed(() => {
  if (connectionTone.value === 'online') return 'WifiOutlined'
  if (connectionTone.value === 'offline') return 'WifiOutlined'
  return 'WarningOutlined'
})

const connectionTitle = computed(() => {
  if (isDisabled.value) return $t('IotDeviceDetail.connection.title.disabled')
  if (isOnline.value) return props.device.status === 'alarm' ? $t('IotDeviceDetail.connection.title.onlineWatch') : $t('IotDeviceDetail.connection.title.online')
  return $t('IotDeviceDetail.connection.title.offline')
})

const connectionSubtitle = computed(() => {
  if (isDisabled.value) return $t('IotDeviceDetail.connection.subtitle.disabled')
  if (props.device.status === 'no-data') return $t('IotDeviceDetail.connection.subtitle.noData')
  if (props.device.status === 'offline') return $t('IotDeviceDetail.connection.subtitle.offline')
  if (props.device.risk !== 'normal') return $t('IotDeviceDetail.connection.subtitle.watch')
  return $t('IotDeviceDetail.connection.subtitle.normal')
})

const primaryFacts = computed<FactItem[]>(() => [
  { label: $t('IotDeviceDetail.connection.field.address'), value: connectionAddress.value, mono: true },
  { label: $t('IotDeviceDetail.connection.field.accessMode'), value: primaryAccessMode.value },
  { label: $t('IotDeviceDetail.connection.field.lastCommunication'), value: props.device.lastSeen },
  { label: $t('IotDeviceDetail.connection.field.status'), value: isDisabled.value ? $t('IotDeviceDetail.connection.status.disabled') : isOnline.value ? $t('IotDeviceDetail.connection.status.online') : $t('IotDeviceDetail.connection.status.offline') },
  { label: isOnline.value ? $t('IotDeviceDetail.connection.field.currentOnline') : $t('IotDeviceDetail.connection.field.lastOffline'), value: lifecycleTime.value },
  { label: $t('IotDeviceDetail.connection.field.accessNode'), value: accessNode.value },
  { label: $t('IotDeviceDetail.connection.field.gateway'), value: props.device.gatewayName ?? $t('IotDeviceDetail.connection.directPlatform') },
])

const identityFacts = computed<FactItem[]>(() => [
  { label: $t('IotDeviceDetail.connection.field.identifier'), value: maskIdentifier(props.device.identifier), mono: true },
  { label: $t('IotDeviceDetail.connection.field.credentialType'), value: credentialType.value },
  { label: $t('IotDeviceDetail.connection.field.endpoint'), value: endpoint.value, mono: true },
  { label: $t('IotDeviceDetail.connection.field.topicPath'), value: topicPrefix.value, mono: true },
  { label: $t('IotDeviceDetail.connection.field.productProtocol'), value: props.device.productName },
  { label: $t('IotDeviceDetail.connection.field.identityStatus'), value: isDisabled.value ? $t('IotDeviceDetail.connection.identityStatus.disabled') : $t('IotDeviceDetail.connection.identityStatus.generated') },
])

const technicalFacts = computed<FactItem[]>(() => [
  { label: 'Client ID', value: props.device.identifier },
  { label: 'Session ID', value: `${props.device.id}-session` },
  { label: 'Keep-Alive', value: keepAlive.value },
  { label: $t('IotDeviceDetail.connection.field.protocolVersion'), value: protocolVersion.value },
  { label: $t('IotDeviceDetail.connection.field.accessService'), value: accessNode.value },
  { label: $t('IotDeviceDetail.connection.field.lastClientAddress'), value: connectionAddress.value },
])

const primaryAccessMode = computed(() => props.device.accessMode.split('/')[0]?.trim() || props.device.accessMode || '-')
const protocolVersion = computed(() => primaryAccessMode.value.toLowerCase().includes('mqtt') ? 'MQTT 3.1.1' : $t('IotDeviceDetail.connection.defaultProductProtocol'))
const keepAlive = computed(() => primaryAccessMode.value.toLowerCase().includes('mqtt') ? $t('IotDeviceDetail.connection.keepAliveSeconds', { count: 60 }) : $t('IotDeviceDetail.connection.keepAliveByReportWindow'))
const qualityWindow = computed(() => props.device.risk === 'normal' ? $t('IotDeviceDetail.connection.qualityWindow.stable') : $t('IotDeviceDetail.connection.qualityWindow.fluctuation'))
const credentialType = computed(() => primaryAccessMode.value.toLowerCase().includes('mqtt') ? $t('IotDeviceDetail.connection.credential.usernameToken') : $t('IotDeviceDetail.connection.credential.deviceSecret'))

const endpoint = computed(() => {
  const slug = props.device.projectId || 'project'
  if (primaryAccessMode.value.toLowerCase().includes('mqtt')) return `mqtts://${slug}.iot.jetlinks.local:8883`
  if (primaryAccessMode.value.toLowerCase().includes('tcp')) return `${slug}.iot.jetlinks.local:1883`
  return `https://${slug}.iot.jetlinks.local/device`
})

const topicPrefix = computed(() => {
  const deviceId = props.device.identifier || props.device.id
  if (primaryAccessMode.value.toLowerCase().includes('mqtt')) return `/device/${deviceId}/**`
  return `/device/${deviceId}`
})

const accessNode = computed(() => {
  const seed = props.device.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return $t('IotDeviceDetail.connection.accessNodeName', { area: props.device.area.split(' · ')[0] || $t('IotDeviceDetail.connection.defaultProject'), index: seed % 3 + 1 })
})

const connectionAddress = computed(() => {
  if (isDisabled.value) return '-'
  if (!isOnline.value && props.device.status !== 'no-data') return '-'
  const seed = props.device.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0)
  return `/${10 + seed % 120}.${18 + seed % 80}.${30 + seed % 70}.${80 + seed % 90}:${44000 + seed % 900}`
})

const lifecycleTime = computed(() => {
  if (isDisabled.value) return $t('IotDeviceDetail.connection.identityStatus.disabled')
  if (isOnline.value) return props.device.lastSeen.includes('前') ? $t('IotDeviceDetail.connection.recentCommunicationWithTime', { time: props.device.lastSeen }) : props.device.lastSeen
  return props.device.lastSeen
})

const qualityMetrics = computed<QualityMetric[]>(() => {
  if (isDisabled.value) {
    return [
      { label: $t('IotDeviceDetail.connection.metric.onlineStability'), value: $t('IotDeviceDetail.connection.metricValue.stopped'), detail: $t('IotDeviceDetail.connection.metricDetail.disabledOnline'), tone: 'offline' },
      { label: $t('IotDeviceDetail.connection.metric.disconnectRecords'), value: $t('IotDeviceDetail.connection.metricValue.notApplicable'), detail: $t('IotDeviceDetail.connection.metricDetail.disabledDisconnect'), tone: 'offline' },
      { label: $t('IotDeviceDetail.connection.metric.reportInterval'), value: $t('IotDeviceDetail.connection.metricValue.notApplicable'), detail: $t('IotDeviceDetail.connection.metricDetail.disabledReport'), tone: 'offline' },
    ]
  }
  if (props.device.status === 'offline') {
    return [
      { label: $t('IotDeviceDetail.connection.metric.onlineStability'), value: $t('IotDeviceDetail.connection.metricValue.low'), detail: $t('IotDeviceDetail.connection.metricDetail.offlineStability'), tone: 'offline' },
      { label: $t('IotDeviceDetail.connection.metric.disconnectRecords'), value: $t('IotDeviceDetail.connection.metricValue.frequent'), detail: $t('IotDeviceDetail.connection.metricDetail.offlineDisconnect'), tone: 'offline' },
      { label: $t('IotDeviceDetail.connection.metric.reportInterval'), value: $t('IotDeviceDetail.connection.metricValue.timeout'), detail: $t('IotDeviceDetail.connection.metricDetail.offlineReport'), tone: 'offline' },
    ]
  }
  if (props.device.status === 'no-data') {
    return [
      { label: $t('IotDeviceDetail.connection.metric.onlineStability'), value: $t('IotDeviceDetail.connection.metricValue.pendingConfirm'), detail: $t('IotDeviceDetail.connection.metricDetail.noDataStability'), tone: 'warning' },
      { label: $t('IotDeviceDetail.connection.metric.disconnectRecords'), value: $t('IotDeviceDetail.connection.metricValue.fluctuation'), detail: $t('IotDeviceDetail.connection.metricDetail.noDataDisconnect'), tone: 'warning' },
      { label: $t('IotDeviceDetail.connection.metric.reportInterval'), value: $t('IotDeviceDetail.connection.metricValue.exception'), detail: $t('IotDeviceDetail.connection.metricDetail.recentReport', { time: props.device.lastSeen }), tone: 'warning' },
    ]
  }
  if (props.device.risk !== 'normal') {
    return [
      { label: $t('IotDeviceDetail.connection.metric.onlineStability'), value: $t('IotDeviceDetail.connection.metricValue.available'), detail: $t('IotDeviceDetail.connection.metricDetail.watchStability'), tone: 'warning' },
      { label: $t('IotDeviceDetail.connection.metric.disconnectRecords'), value: $t('IotDeviceDetail.connection.metricValue.few'), detail: $t('IotDeviceDetail.connection.metricDetail.watchDisconnect'), tone: 'warning' },
      { label: $t('IotDeviceDetail.connection.metric.reportInterval'), value: $t('IotDeviceDetail.connection.metricValue.normal'), detail: $t('IotDeviceDetail.connection.metricDetail.recentReport', { time: props.device.lastSeen }), tone: 'online' },
    ]
  }
  return [
    { label: $t('IotDeviceDetail.connection.metric.onlineStability'), value: $t('IotDeviceDetail.connection.metricValue.stable'), detail: $t('IotDeviceDetail.connection.metricDetail.normalStability'), tone: 'online' },
    { label: $t('IotDeviceDetail.connection.metric.disconnectRecords'), value: $t('IotDeviceDetail.connection.metricValue.noException'), detail: $t('IotDeviceDetail.connection.metricDetail.normalDisconnect'), tone: 'online' },
    { label: $t('IotDeviceDetail.connection.metric.reportInterval'), value: $t('IotDeviceDetail.connection.metricValue.normal'), detail: $t('IotDeviceDetail.connection.metricDetail.recentReport', { time: props.device.lastSeen }), tone: 'online' },
  ]
})

const lifecycle = computed<LifecycleItem[]>(() => {
  const base: LifecycleItem[] = [
    {
      id: `${props.device.id}-current`,
      title: isDisabled.value ? $t('IotDeviceDetail.connection.lifecycle.currentDisabled') : isOnline.value ? $t('IotDeviceDetail.connection.lifecycle.currentOnline') : $t('IotDeviceDetail.connection.lifecycle.currentOffline'),
      time: props.device.lastSeen,
      detail: isDisabled.value
        ? $t('IotDeviceDetail.connection.lifecycleDetail.currentDisabled')
        : isOnline.value
          ? $t('IotDeviceDetail.connection.lifecycleDetail.currentOnline')
          : $t('IotDeviceDetail.connection.lifecycleDetail.currentOffline'),
      status: isOnline.value ? 'online' : 'offline',
    },
  ]

  if (props.device.status === 'no-data') {
    base.push({
      id: `${props.device.id}-silent`,
      title: $t('IotDeviceDetail.connection.lifecycle.businessTimeout'),
      time: props.device.lastSeen,
      detail: $t('IotDeviceDetail.connection.lifecycleDetail.businessTimeout'),
      status: 'warning',
    })
  }

  if (props.device.risk !== 'normal') {
    base.push({
      id: `${props.device.id}-watch`,
      title: $t('IotDeviceDetail.connection.lifecycle.watch'),
      time: $t('IotDeviceDetail.connection.currentShift'),
      detail: props.device.aiSummary.reasons[0] ?? $t('IotDeviceDetail.connection.lifecycleDetail.watch'),
      status: 'warning',
    })
  }

  base.push({
    id: `${props.device.id}-first`,
    title: $t('IotDeviceDetail.connection.lifecycle.accessEffective'),
    time: $t('IotDeviceDetail.connection.afterDeviceCreated'),
    detail: $t('IotDeviceDetail.connection.lifecycleDetail.accessEffective', { product: props.device.productName }),
    status: 'online',
  })

  return base
})

const communicationLogs = computed<IotDeviceLog[]>(() => {
  const logs = props.device.logs.slice(0, 4)
  if (logs.length) return logs
  return [
    {
      id: `${props.device.id}-connection-log`,
      level: isOnline.value ? 'info' : 'warning',
      title: isOnline.value ? $t('IotDeviceDetail.connection.log.propertyReport') : $t('IotDeviceDetail.connection.log.statusChanged'),
      message: isOnline.value ? $t('IotDeviceDetail.connection.log.propertyReportMessage') : $t('IotDeviceDetail.connection.log.statusChangedMessage'),
      happenedAt: props.device.lastSeen,
    },
  ]
})

function maskIdentifier(value: string): string {
  if (value.length <= 6) return value
  return `${value.slice(0, 3)}••••${value.slice(-3)}`
}
</script>

<style scoped>
.connection-tab {
  display: grid;
  gap: var(--space-3);
}

.connection-hero,
.connection-panel,
.technical-panel {
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.connection-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  padding: 0.875rem;
}

.connection-hero[data-tone='online'] {
  border-color: color-mix(in srgb, var(--jet-theme-success) 36%, var(--jet-theme-border));
}

.connection-hero[data-tone='warning'] {
  border-color: color-mix(in srgb, var(--jet-theme-warning) 38%, var(--jet-theme-border));
}

.connection-hero[data-tone='offline'] {
  border-color: color-mix(in srgb, var(--jet-theme-error) 32%, var(--jet-theme-border));
}

.connection-hero__icon {
  display: grid;
  place-items: center;
  width: 2.125rem;
  height: 2.125rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  color: var(--jet-theme-text-secondary);
  background: var(--jet-theme-bg-container);
}

.connection-hero[data-tone='online'] .connection-hero__icon {
  color: var(--jet-theme-success);
}

.connection-hero[data-tone='warning'] .connection-hero__icon {
  color: var(--jet-theme-warning);
}

.connection-hero[data-tone='offline'] .connection-hero__icon {
  color: var(--jet-theme-error);
}

.connection-hero__icon :deep(svg) {
  width: 1.0625rem;
  height: 1.0625rem;
}

.connection-hero__main,
.connection-hero__title,
.connection-panel,
.quality-list,
.timeline-list,
.log-list {
  display: grid;
  min-width: 0;
}

.connection-hero__main,
.connection-panel,
.timeline-list,
.log-list {
  gap: var(--space-3);
}

.connection-hero__title {
  gap: var(--space-1);
}

.connection-hero__title strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-title);
  font-weight: 600;
}

.connection-hero__title span,
.section-head span,
.connection-facts dt,
.kv-list dt,
.quality-list span,
.quality-list p,
.timeline-list span,
.timeline-list p,
.log-list span,
.log-list p,
.technical-grid dt {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.connection-facts,
.kv-list,
.technical-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.connection-facts div,
.kv-list div,
.technical-grid div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.connection-facts dd,
.kv-list dd,
.technical-grid dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono { font-size: var(--fs-14);
}

.connection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.connection-panel {
  padding: 0.875rem;
}

.section-head,
.section-head > div {
  display: flex;
  align-items: center;
  min-width: 0;
}

.section-head {
  justify-content: space-between;
  gap: var(--space-3);
}

.section-head > div {
  gap: 0.4375rem;
}

.section-head :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-primary);
}

.section-head h3 {
  margin: 0;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  font-weight: 600;
}

.connection-lane {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 0.1875rem;
  height: 0.75rem;
}

.connection-lane span {
  border-radius: var(--jet-theme-radius-sm);
  background: var(--jet-theme-border);
}

.connection-lane span[data-status='online'] {
  background: color-mix(in srgb, var(--jet-theme-success) 56%, var(--jet-theme-border));
}

.connection-lane span[data-status='warning'] {
  background: color-mix(in srgb, var(--jet-theme-warning) 58%, var(--jet-theme-border));
}

.connection-lane span[data-status='offline'] {
  background: color-mix(in srgb, var(--jet-theme-error) 48%, var(--jet-theme-border));
}

.quality-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.quality-list article {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
  padding: 0.625rem;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
}

.quality-list article[data-tone='online'] {
  border-color: color-mix(in srgb, var(--jet-theme-success) 32%, var(--jet-theme-border));
}

.quality-list article[data-tone='warning'] {
  border-color: color-mix(in srgb, var(--jet-theme-warning) 36%, var(--jet-theme-border));
}

.quality-list article[data-tone='offline'] {
  border-color: color-mix(in srgb, var(--jet-theme-error) 32%, var(--jet-theme-border));
}

.quality-list strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-h3);
  font-weight: 600;
}

.timeline-list article,
.log-list article {
  display: grid;
  gap: var(--space-1);
  padding: 0.625rem 0;
  border-top: 0.0625rem solid var(--jet-theme-border);
}

.timeline-list article:first-child,
.log-list article:first-child {
  border-top: 0;
  padding-top: 0;
}

.timeline-list strong,
.log-list strong {
  color: var(--jet-theme-text);
  font-size: var(--fs-body);
  font-weight: 600;
}

.timeline-list p,
.log-list p,
.quality-list p {
  margin: 0;
  line-height: 1.6;
}

.log-list article[data-level='warning'] strong {
  color: var(--jet-theme-warning);
}

.log-list article[data-level='error'] strong {
  color: var(--jet-theme-error);
}

.technical-panel {
  padding: 0;
}

.technical-panel summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 2.625rem;
  padding: 0 0.875rem;
  color: var(--jet-theme-text);
  cursor: pointer;
  font-size: var(--fs-14);
  font-weight: 600;
  list-style: none;
}

.technical-panel summary::-webkit-details-marker {
  display: none;
}

.technical-panel summary :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--jet-theme-text-disabled);
  transition: transform 0.16s ease;
}

.technical-panel[open] summary :deep(svg) {
  transform: rotate(180deg);
}

.technical-grid {
  padding: 0 0.875rem 0.875rem;
  border-top: 0.0625rem solid var(--jet-theme-border);
  padding-top: var(--space-3);
}

@media (max-width: 60rem) {
  .connection-grid,
  .connection-facts,
  .kv-list,
  .technical-grid,
  .quality-list {
    grid-template-columns: 1fr;
  }
}</style>
