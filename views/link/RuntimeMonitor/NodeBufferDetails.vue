<template>
  <section class="node-buffer-detail">
    <div class="node-buffer-heading" :title="snapshot.state.sampledAt ? t('runtimeDiagnostics.updatedAt', { time: clock(snapshot.state.sampledAt) }) : undefined">
      <strong>{{ t('runtimeDiagnostics.bufferQueues') }}</strong><a-tooltip :title="t('runtimeDiagnostics.bufferStatsInfo')"><InfoCircleOutlined /></a-tooltip>
      <a-tag v-if="snapshot.state.status === 'stale'" color="warning">{{ t('runtimeDiagnostics.nodeStale') }}</a-tag>
      <a-button v-if="canOpen && snapshot.queues.length" type="link" size="small" class="node-buffer-all" @click="emit('openBuffers')">{{ t('runtimeDiagnostics.bufferAllQueues') }} ({{ snapshot.queues.length }}) <ArrowRightOutlined /></a-button>
      <span v-else-if="snapshot.queues.length" class="node-buffer-all">{{ t('runtimeDiagnostics.bufferAllQueues') }} ({{ snapshot.queues.length }})</span>
    </div>
    <p v-if="snapshot.state.message" class="node-buffer-message" :title="snapshot.state.message">{{ snapshot.state.message }}</p>
    <template v-if="snapshot.queues.length">
      <div class="node-buffer-metrics">
        <span v-if="overview.pending !== undefined">{{ t('runtimeDiagnostics.queue.pending') }} <b>{{ quantity(overview.pending) }}</b> {{ t('runtimeDiagnostics.items') }} <small v-if="overview.pendingDelta" :title="t('RuntimeMonitor.bufferWindowChange', { change: quantity(overview.pendingDelta) })">({{ overview.pendingDelta > 0 ? '+' : '' }}{{ quantity(overview.pendingDelta) }})</small></span>
        <span v-if="overview.dead !== undefined">{{ t('runtimeDiagnostics.queue.dead') }} <b>{{ quantity(overview.dead) }}</b> {{ t('runtimeDiagnostics.items') }}</span>
        <span v-for="item in rates" :key="item.key">{{ t(item.key) }} <b>{{ rate(item.value) }}</b> {{ t('runtimeDiagnostics.bufferItemsPerSecond') }}</span>
      </div>
      <p v-if="overview.window" class="node-buffer-window">{{ t('RuntimeMonitor.bufferMeasuredWindow', { from: clock(overview.window.from), to: clock(overview.window.to), seconds: windowSeconds(overview.window.seconds) }) }}</p>
      <p v-else-if="!rates.length" class="node-buffer-window">{{ t(overview.firstSample ? 'RuntimeMonitor.bufferRateSampling' : 'RuntimeMonitor.bufferRateWaiting') }}</p>
      <div v-if="overview.queues.length" class="node-buffer-priority">
        <div v-for="queue in overview.queues" :key="queue.objectName" class="node-buffer-queue">
          <a-button v-if="canOpen" type="link" size="small" class="node-buffer-open" :title="queue.objectName" @click="emit('openQueue', queue.objectName)">{{ queue.name }}</a-button>
          <span v-else class="node-buffer-name" :title="queue.objectName">{{ queue.name }}</span>
          <span v-if="queue.pending !== undefined && queue.pending > 0">{{ t('runtimeDiagnostics.queue.pending') }} <b>{{ quantity(queue.pending) }}</b></span>
          <span v-if="queue.dead !== undefined && queue.dead > 0">{{ t('runtimeDiagnostics.queue.dead') }} <b>{{ quantity(queue.dead) }}</b></span>
        </div>
      </div>
    </template>
    <p v-else class="node-buffer-message">{{ t(snapshot.state.status === 'loading' ? 'RuntimeMonitor.bufferSampling' : snapshot.state.status === 'ready' ? 'RuntimeMonitor.noBufferQueues' : 'runtimeDiagnostics.noMonitoringData') }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import type { ClusterBufferSnapshot } from './useClusterBuffers'
import { nodeBufferOverview, bufferQuantity as quantity, bufferRate as rate } from './nodeBufferOverview'
const props = defineProps({ snapshot: { type: Object as PropType<ClusterBufferSnapshot>, required: true }, canOpen: { type: Boolean, default: false } })
const emit = defineEmits<{ openQueue: [objectName: string]; openBuffers: [] }>()
const { t } = useI18n()
const overview = computed(() => nodeBufferOverview(props.snapshot))
const rates = computed(() => [
  { key: 'runtimeDiagnostics.bufferWriteRate', value: overview.value.writtenRate },
  { key: 'runtimeDiagnostics.bufferAttemptRate', value: overview.value.attemptedRate },
].filter((item): item is { key: string; value: number } => item.value !== undefined))
const clock = (time: number) => new Date(time).toLocaleTimeString([], { hour12: false })
const windowSeconds = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
</script>
<style scoped>
.node-buffer-detail { margin-top:7px; border-top:1px solid var(--line); padding-top:6px; font-size:var(--fs-caption,12px); }
.node-buffer-heading { display:flex; align-items:center; gap:5px; line-height:19px; }.node-buffer-heading strong { font-size:var(--fs-sm,13px); font-weight:600; }.node-buffer-heading .ant-tag { margin:0; font-size:var(--fs-caption,12px); line-height:17px; }.node-buffer-all { margin-inline-start:auto; }.node-buffer-heading .ant-btn { height:auto; padding:0; font-size:var(--fs-caption,12px); }
.node-buffer-message { margin:3px 0; color:var(--ink-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.node-buffer-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px 12px; margin-top:4px; line-height:18px; color:var(--ink-3); font-variant-numeric:tabular-nums; }.node-buffer-metrics > span { white-space:nowrap; }.node-buffer-metrics b,.node-buffer-queue b { color:var(--ink-1); font-size:var(--fs-caption,12px); font-weight:500; }.node-buffer-metrics small { font-size:var(--fs-caption,12px); }
.node-buffer-window { margin:2px 0 0; color:var(--ink-3); font-size:var(--fs-caption,12px); line-height:15px; }
.node-buffer-priority { margin-top:3px; }.node-buffer-queue { display:flex; align-items:baseline; gap:10px; min-width:0; line-height:20px; color:var(--ink-3); }.node-buffer-open,.node-buffer-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:start; }.node-buffer-queue .ant-btn { height:auto; padding:0; font-size:var(--fs-caption,12px); line-height:20px; }.node-buffer-queue > span:not(.node-buffer-name) { flex-shrink:0; }
@media (max-width:540px) { .node-buffer-metrics { column-gap:6px; font-size:var(--fs-caption,12px); } }
</style>
