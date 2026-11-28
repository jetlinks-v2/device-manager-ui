<template>
  <button v-if="visible" type="button" class="device-connection-context" :aria-label="label" :title="title" :aria-expanded="observation.open" aria-haspopup="dialog" @click="$emit('open')" @keydown.esc.stop.prevent="$emit('close')">
    <template v-if="loading"><SkeletonText v-for="item in 3" :key="item" :width="64" :height="10" /></template>
    <template v-else>
      <span v-if="transport" class="device-connection-context__item"><AIcon type="ApiOutlined" aria-hidden="true" />{{ transport }}</span>
      <span v-if="connections !== undefined" class="device-connection-context__item"><AIcon type="ClusterOutlined" aria-hidden="true" />{{ t('IotDeviceDetail.connection.connectionCount', { count:connections }) }}</span>
      <span v-if="sessions !== undefined" class="device-connection-context__item">{{ t('IotDeviceDetail.connection.sessionCount', { count:sessions }) }}</span>
      <span v-if="activityText" class="device-connection-context__item"><AIcon type="HistoryOutlined" aria-hidden="true" />{{ activityText }}</span>
      <AIcon v-if="unavailable" :type="observation.paused ? 'PauseOutlined' : 'ExclamationCircleOutlined'" aria-hidden="true" />
    </template>
  </button>
</template>
<script setup lang="ts">
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'
import { useI18n } from 'vue-i18n'
import type { DeviceConnectionObservation } from '../../deviceDetailConnection'
import { useDeviceConnectionContext } from './useDeviceConnectionContext'
const props = defineProps<{ observation:DeviceConnectionObservation; status:string }>()
defineEmits<{ open:[]; close:[] }>()
const { t } = useI18n()
const { loading, transport, connections, sessions, activityText, unavailable, title, label, visible } = useDeviceConnectionContext(props.observation, () => props.status)
</script>
<style scoped>
.device-connection-context { display:inline-flex; align-items:center; gap:var(--space-3); min-width:0; max-width:100%; height:24px; padding:0; border:0; border-radius:var(--r-2); background:transparent; color:var(--jet-theme-text-secondary); font-size:var(--fs-12); cursor:pointer; }
.device-connection-context__item { display:inline-flex; align-items:center; gap:var(--space-1); min-width:0; white-space:nowrap; }
.device-connection-context__item > .anticon { flex:none; font-size:14px; }
.device-connection-context:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:2px; }
</style>
