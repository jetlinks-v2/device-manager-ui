<template>
  <button type="button" class="device-connection-metrics" :aria-label="accessibleLabel" :title="hint" @click="$emit('open')">
    <template v-if="readable && (observation.sessions.length || observation.state.status === 'loading')">
      <span v-for="metric in visibleMetrics" :key="metric.key" class="device-connection-metrics__item" :class="`device-connection-metrics__item--${metric.key}`" :title="`${t(`IotDeviceDetail.connection.${metric.key}`)} · ${metric.loading ? t('IotDeviceDetail.connection.waiting') : metric.value}`">
        <AIcon :type="icons[metric.key]" aria-hidden="true" /><span class="device-connection-metrics__value"><SkeletonText v-if="metric.loading" :width="24" :height="10" /><span v-else>{{ metric.value }}</span></span>
      </span>
      <AIcon v-if="observation.paused || observation.state.status === 'error'" :type="observation.paused ? 'PauseOutlined' : 'ExclamationCircleOutlined'" aria-hidden="true" />
    </template>
    <AIcon v-else :type="observation.access.allowed ? 'InfoCircleOutlined' : 'LockOutlined'" aria-hidden="true" />
  </button>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'
import type { DeviceConnectionObservation } from '../../deviceDetailConnection'
import { useDeviceConnectionMetrics } from './useDeviceConnectionMetrics'
const props = defineProps<{ observation: DeviceConnectionObservation }>()
defineEmits<{ open: [] }>()
const { t } = useI18n()
const { metrics, traffic } = useDeviceConnectionMetrics(props.observation)
const icons = { receive: 'ArrowDownOutlined', send: 'ArrowUpOutlined', messages: 'ThunderboltOutlined', pending: 'InboxOutlined', traffic: 'SwapOutlined' }
const visibleMetrics = computed(() => [traffic.value, ...metrics.value.filter(metric => metric.key !== 'pending')])
const readable = computed(() => props.observation.access.allowed && !['forbidden','unsupported'].includes(props.observation.state.status))
const hint = computed(() => !props.observation.access.allowed || props.observation.state.status === 'forbidden' ? t('runtimeDiagnostics.deviceSessions.forbidden') : props.observation.state.status === 'unsupported' ? t('runtimeDiagnostics.deviceSessions.unsupported') : props.observation.state.status === 'error' ? t('IotDeviceDetail.connection.refreshFailed') : props.observation.paused ? t('runtimeDiagnostics.deviceSessions.paused') : t('IotDeviceDetail.connection.title'))
const accessibleLabel = computed(() => `${hint.value} · ${metrics.value.filter(metric => metric.key !== 'pending').map(metric => `${t(`IotDeviceDetail.connection.${metric.key}`)} ${metric.loading ? t('IotDeviceDetail.connection.waiting') : metric.value}`).join('，')}`)
</script>
<style scoped>
.device-connection-metrics { display:inline-flex; align-items:center; gap:8px; max-width:100%; min-width:0; height:24px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--jet-theme-text-secondary); font-size:12px; cursor:pointer; }
.device-connection-metrics__item { display:inline-flex; align-items:center; gap:3px; min-width:0; white-space:nowrap; }
.device-connection-metrics__item > .anticon { flex:none; font-size:14px; }
.device-connection-metrics__value { min-width:0; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
.device-connection-metrics__item--traffic { display:none; }
.device-connection-metrics:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:3px; }
@container detail-header (max-width:640px) {
  .device-connection-metrics__item--receive,.device-connection-metrics__item--send { display:none; }
  .device-connection-metrics__item--traffic { display:inline-flex; }
}
@container detail-header (max-width:400px) {
  .device-connection-metrics { gap:4px; }
  .device-connection-metrics__item--messages { display:none; }
}
</style>
