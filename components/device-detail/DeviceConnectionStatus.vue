<template>
  <DefinePanel><DeviceConnectionPanel :device-id="deviceId" :label="label" :online-at="onlineAt" :offline-at="offlineAt" :last-report-at="lastReportAt" :sessions="sessions" :history="history" :state="state" :access="access" :interval="interval" :paused="paused" :requesting="requesting" :active="collecting" :collecting="collecting" @update:paused="paused = $event" @update:interval="interval = $event" @refresh="refresh" @close="close" /></DefinePanel>
  <a-popover :open="open && !narrow" :trigger="narrow ? [] : ['click']" placement="bottomLeft" @open-change="open = $event">
    <button ref="trigger" type="button" class="device-detail-connection" :aria-label="`${t('IotDeviceDetail.connection.title')} · ${label}`" :title="connectionHint" :aria-expanded="open" aria-haspopup="dialog" @click="narrow && (open = !open)" @keydown.esc.stop.prevent="close">
      <StatusTag appearance="text" :status="status === 'online' ? 'success' : 'disabled'" :text="label" />
      <span v-if="duration" class="device-detail-connection__duration" aria-hidden="true">{{ duration }}</span>
    </button>
    <template #content><div v-if="open && !narrow" class="device-detail-connection__panel" @keydown.esc.stop.prevent="close"><ConnectionPanel /></div></template>
  </a-popover>
  <JlDrawerShell v-if="narrow" :open="open" :width="560" hide-head @update:open="!$event && close()"><div v-if="open" class="device-detail-connection__drawer"><ConnectionPanel /></div></JlDrawerShell>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createReusableTemplate, useNow } from '@vueuse/core'
import dayjs from 'dayjs'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import DeviceConnectionPanel from './DeviceConnectionPanel.vue'
import { formatDeviceSessionDuration } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DeviceConnectionObservation } from '../../deviceDetailConnection'
const props = defineProps<{ observation: DeviceConnectionObservation; deviceId: string; status: string; label: string; onlineAt?: number; offlineAt?: number; lastReportAt?: number }>()
const { t, locale } = useI18n(), trigger = ref<HTMLButtonElement>()
const [DefinePanel, ConnectionPanel] = createReusableTemplate()
const { open, narrow, paused, interval, sessions, history, state, access, requesting, collecting, refresh } = toRefs(props.observation)
let opener: HTMLElement | undefined
watch(open, value => {
  if (!value) return
  const active = trigger.value?.ownerDocument?.activeElement
  opener = active && 'focus' in active ? active as HTMLElement : trigger.value
}, { flush:'sync' })
const connectionTime = computed(() => props.status === 'online' ? props.onlineAt : props.status === 'offline' ? props.offlineAt : undefined)
const now = useNow({ interval: 60000 })
watch(connectionTime, () => { now.value = new Date() })
const duration = computed(() => formatDeviceSessionDuration(connectionTime.value, now.value.getTime(), String(locale.value), true))
const connectionHint = computed(() => {
  const timestamp = connectionTime.value && dayjs(connectionTime.value).isValid() ? t(props.status === 'online' ? 'IotDeviceDetail.header.connectedAtShort' : 'IotDeviceDetail.header.disconnectedAtShort', { time: dayjs(connectionTime.value).format('YYYY-MM-DD HH:mm:ss') }) : labelHint()
  return duration.value ? `${t(`IotDeviceDetail.connectionHealth.segment.${props.status === 'online' ? 'onlineDuration' : 'offlineDuration'}`, { duration: duration.value })} · ${timestamp}` : timestamp
})
function labelHint() { return `${t('IotDeviceDetail.connection.title')} · ${props.label}` }
function close() { open.value = false; void nextTick(() => (opener?.isConnected && opener.getClientRects().length ? opener : trigger.value)?.focus()) }
</script>
<style scoped>
.device-detail-connection { display:inline-flex; align-items:center; gap:4px; max-width:100%; height:24px; padding:0; border:0; border-radius:4px; background:transparent; color:inherit; cursor:pointer; }
.device-detail-connection__duration { color:var(--jet-theme-text-secondary); font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.device-detail-connection:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:3px; }
.device-detail-connection__panel { width:min(520px,calc(100vw - 48px)); max-height:min(640px,calc(100vh - 160px)); overflow:auto; }
.device-detail-connection__drawer { padding:16px; }
@container detail-header (max-width:400px) { .device-detail-connection__duration { display:none; } }
</style>
