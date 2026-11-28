<template>
  <section class="device-connection-panel">
    <header class="device-connection-panel__head">
      <strong>{{ t('IotDeviceDetail.connection.title') }}</strong>
      <div class="device-connection-panel__controls">
        <a-button type="text" size="small" :disabled="!access.allowed" :aria-label="t(paused ? 'runtimeDiagnostics.deviceSessions.resume' : 'runtimeDiagnostics.deviceSessions.pause')" @click="$emit('update:paused', !paused)"><AIcon :type="paused ? 'CaretRightOutlined' : 'PauseOutlined'" /></a-button>
        <SamplingIntervalControl :value="interval" :disabled="!access.allowed" @change="$emit('update:interval', $event)" />
        <a-button type="text" size="small" :disabled="!access.allowed || requesting" :aria-label="t('runtimeDiagnostics.deviceSessions.refresh')" @click="$emit('refresh')"><AIcon type="ReloadOutlined" /></a-button>
        <a-button type="text" size="small" :aria-label="t('IotDeviceDetail.connection.close')" @click="$emit('close')"><AIcon type="CloseOutlined" /></a-button>
      </div>
    </header>
    <p class="device-connection-panel__sampling">{{ t(collecting ? 'runtimeDiagnostics.deviceSessions.observing' : 'runtimeDiagnostics.deviceSessions.paused') }}<span v-if="state.sampledAt">{{ t('IotDeviceDetail.connection.sampledAt', { time: time(state.sampledAt) }) }}</span></p>
    <a-alert v-if="!access.allowed || state.status === 'forbidden'" type="warning" :message="t('runtimeDiagnostics.deviceSessions.forbidden')" />
    <a-alert v-else-if="state.status === 'unsupported'" type="info" :message="t('runtimeDiagnostics.deviceSessions.unsupported')" />
    <a-alert v-else-if="state.status === 'error'" type="warning" :message="t('IotDeviceDetail.connection.refreshFailed')"><template #action><a-button size="small" @click="$emit('refresh')">{{ t('runtimeDiagnostics.retry') }}</a-button></template></a-alert>
    <dl class="device-connection-panel__facts">
      <dt>{{ t('IotDeviceDetail.header.connectionState') }}</dt><dd>{{ label }}</dd>
      <dt>{{ t('IotDeviceDetail.header.connectedAt') }}</dt><dd>{{ time(onlineAt) }}</dd>
      <dt>{{ t('IotDeviceDetail.header.disconnectedAt') }}</dt><dd>{{ time(offlineAt) }}</dd>
      <dt>{{ t('IotDeviceDetail.detail.lastReport') }}</dt><dd>{{ time(lastReportAt) }}</dd>
    </dl>
    <template v-if="access.allowed && !['forbidden','unsupported'].includes(state.status)">
      <a-skeleton v-if="state.status === 'loading' && !state.sampledAt" active :title="false" :paragraph="{ rows: 4 }" />
      <template v-else-if="state.sampledAt">
        <div class="device-connection-panel__overview"><span>{{ t('IotDeviceDetail.connection.sessionCount', { count: sessions.length }) }}</span><span>{{ t('IotDeviceDetail.connection.connectionCount', { count: connectionCount ?? unknown }) }}</span><span>{{ transports }}</span></div>
        <dl v-if="sessions.length" class="device-connection-panel__metrics">
          <div v-for="metric in metrics" :key="metric.key"><dt>{{ t(`IotDeviceDetail.connection.${metric.key}`) }}</dt><dd><a-skeleton-input v-if="metric.loading" active size="small" style="width:64px;min-width:0" /><span v-else>{{ metric.value }}</span></dd></div>
        </dl>
        <dl v-if="sessions.length" class="device-connection-panel__facts device-connection-panel__activity"><dt>{{ t('IotDeviceDetail.connection.lastCommunication') }}</dt><dd>{{ time(activity.lastCommAt) }}</dd><dt>{{ t('IotDeviceDetail.connection.lastHeartbeat') }}</dt><dd>{{ time(activity.lastHeartbeatAt) }}</dd></dl>
        <div class="device-connection-panel__sessions"><strong>{{ t('IotDeviceDetail.connection.sessions') }}</strong><DeviceSessionViewer details-only expand-connections :sessions="sessions" :state="state" :access="access" :active="active" :device-id="deviceId" :queried-device-id="deviceId" :result-device-id="deviceId" /><p v-if="sessions.length" class="device-connection-panel__note">{{ t('IotDeviceDetail.connection.cumulativeHint') }}</p></div>
      </template>
      <p v-else class="device-connection-panel__note">{{ t('IotDeviceDetail.connection.waiting') }}</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { DeviceSessionViewer, SamplingIntervalControl, deviceObservationActivity, type DeviceObservationSample, type DiagnosticSamplingInterval } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DeviceSessionInfo, ViewState, ActionAccess } from '@jetlinks-web-core/components/RuntimeDiagnostics/types'
import { useDeviceConnectionMetrics } from './useDeviceConnectionMetrics'
const props = defineProps<{ deviceId: string; label: string; onlineAt?: number; offlineAt?: number; lastReportAt?: number; sessions: DeviceSessionInfo[]; history: DeviceObservationSample[]; state: ViewState; access: ActionAccess; interval: DiagnosticSamplingInterval; paused: boolean; requesting: boolean; active: boolean; collecting: boolean }>()
defineEmits<{ close: []; refresh: []; 'update:paused': [value: boolean]; 'update:interval': [value: DiagnosticSamplingInterval] }>()
const { t } = useI18n()
const unknown = computed(() => t('IotDeviceDetail.connection.notProvided'))
const activity = computed(() => deviceObservationActivity(props.sessions))
const { metrics } = useDeviceConnectionMetrics(props)
const connectionCount = computed(() => props.sessions.every(session => Array.isArray(session.connections)) ? props.sessions.reduce((count, session) => count + (session.connections?.length ?? 0), 0) : undefined)
const transports = computed(() => [...new Set(props.sessions.map(session => session.transport).filter(Boolean))].join(' / '))
function time(value?: number) { return value && dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : unknown.value }
</script>
<style scoped>
.device-connection-panel { min-width:0; color:var(--jet-theme-text); }
.device-connection-panel__head,.device-connection-panel__controls { display:flex; align-items:center; gap:4px; }
.device-connection-panel__head { justify-content:space-between; gap:12px; }
.device-connection-panel__head > strong { font-size:14px; }
.device-connection-panel__controls { flex:none; }
.device-connection-panel__sampling { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 12px; margin:4px 0 12px; color:var(--jet-theme-text-secondary); font-size:12px; }
.device-connection-panel__facts { display:grid; grid-template-columns:minmax(0,112px) minmax(0,1fr); gap:8px 16px; margin:12px 0; font-size:12px; }
.device-connection-panel__facts dt,.device-connection-panel__metrics dt { color:var(--jet-theme-text-secondary); }
.device-connection-panel__facts dd { min-width:0; margin:0; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
.device-connection-panel__overview { display:flex; flex-wrap:wrap; gap:8px 16px; padding-top:12px; border-top:1px solid var(--line); font-size:12px; }
.device-connection-panel__metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:12px 0; }
.device-connection-panel__metrics dd { margin:4px 0 0; min-width:0; font-size:14px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.device-connection-panel__metrics dt { font-size:12px; }
.device-connection-panel__sessions { margin-top:12px; padding-top:12px; border-top:1px solid var(--line); }
.device-connection-panel__sessions > strong { font-size:12px; font-weight:500; }
.device-connection-panel__note { margin:8px 0 0; color:var(--jet-theme-text-secondary); font-size:12px; }
@media (max-width:600px) { .device-connection-panel__metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } .device-connection-panel__facts { grid-template-columns:minmax(0,96px) minmax(0,1fr); gap:8px 12px; } }
</style>
