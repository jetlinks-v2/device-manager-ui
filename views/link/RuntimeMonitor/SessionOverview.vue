<template>
  <div class="session-overview">
    <a-tooltip :title="t('RuntimeMonitor.connectionCollectedNodes', { count: overview.sessions.nodes })" :trigger="['hover', 'focus']"><span class="session-overview-metric" tabindex="0">{{ t('runtimeDiagnostics.deviceSessions.sessionRecords') }} <b>{{ quantity(overview.sessions.value) }}</b></span></a-tooltip>
    <a-tooltip :title="t('RuntimeMonitor.connectionCollectedNodes', { count: overview.keepOnline.nodes })" :trigger="['hover', 'focus']"><span class="session-overview-metric" tabindex="0">{{ t('RuntimeMonitor.sessionKeepOnline') }} <b>{{ quantity(overview.keepOnline.value) }}</b></span></a-tooltip>
    <a-tooltip :title="t('runtimeDiagnostics.deviceSessions.coverageInfo')" :trigger="['hover', 'focus']"><span class="session-overview-metric" tabindex="0">{{ t('runtimeDiagnostics.deviceSessions.collectedCoverage', { count: overview.collected, total: overview.total }) }}</span></a-tooltip>
    <a-tooltip :title="t('RuntimeMonitor.connectionSummaryInfo')" :trigger="['hover', 'focus']"><InfoCircleOutlined class="session-overview-info" tabindex="0" :aria-label="t('RuntimeMonitor.connectionSummaryInfo')" /></a-tooltip>
    <a-popover :open="open" trigger="click" placement="bottomRight" @open-change="setOpen">
      <template #content>
        <div ref="content" class="session-distribution" tabindex="-1" @keydown.esc.stop.prevent="close">
          <div class="session-distribution-title"><strong>{{ t('RuntimeMonitor.connectionNodeDistribution') }}</strong><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.closeDetails')" @click="close"><CloseOutlined /></a-button></div>
          <div class="session-distribution-table">
            <div class="session-distribution-row session-distribution-row--head"><span>{{ t('RuntimeMonitor.connectionNode') }}</span><span>{{ t('RuntimeMonitor.connectionCollectedSessions') }}</span><span>{{ t('RuntimeMonitor.sessionKeepOnline') }}</span><span>{{ t('RuntimeMonitor.connectionSamplingCoverage') }}</span></div>
            <div v-for="row in overview.rows" :key="row.nodeId" class="session-distribution-row" :class="{ 'session-distribution-row--stale': row.status === 'stale' }">
              <span class="session-distribution-node" :title="row.nodeId">{{ row.label }}</span><b>{{ quantity(row.sessions) }}</b><b>{{ quantity(row.keepOnline) }}</b><span>{{ statusLabel(row.status) }}<small v-if="sampleTime(row.sampledAt)">{{ t('runtimeDiagnostics.updatedAt', { time: sampleTime(row.sampledAt) }) }}</small></span>
            </div>
          </div>
          <p>{{ t('RuntimeMonitor.connectionSamplingInfo') }}</p>
        </div>
      </template>
      <a-button ref="trigger" class="session-distribution-trigger" size="small" type="text" :aria-expanded="open" @keydown.esc.stop.prevent="close">{{ t('RuntimeMonitor.connectionNodeDistribution') }}<DownOutlined /></a-button>
    </a-popover>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined, DownOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import type { SessionOverview, SessionOverviewRow } from './sessionOverview'
const props = defineProps({ overview: { type: Object as PropType<SessionOverview>, required: true }, active: { type: Boolean, default: true } })
const { t, locale } = useI18n(), open = ref(false), trigger = ref<{ focus: () => void }>(), content = ref<HTMLElement>()
const quantity = (value: string | undefined) => value === undefined ? '—' : BigInt(value).toLocaleString(locale.value)
const sampleTime = (value: number | undefined) => value === undefined || !Number.isFinite(value) || !Number.isFinite(new Date(value).getTime()) ? '' : new Date(value).toLocaleString(locale.value)
const stateKeys: Record<SessionOverviewRow['status'], string> = { ready: 'RuntimeMonitor.connectionCollected', missing: 'RuntimeMonitor.connectionCountsMissing', unknown: 'RuntimeMonitor.connectionNotCollected', loading: 'RuntimeMonitor.connectionNotCollected', empty: 'RuntimeMonitor.connectionNotCollected', stale: 'runtimeDiagnostics.nodeStale', error: 'runtimeDiagnostics.failed', forbidden: 'runtimeDiagnostics.forbidden', unsupported: 'runtimeDiagnostics.unsupported' }
const statusLabel = (status: SessionOverviewRow['status']) => t(stateKeys[status])
/** 浮层只展示已有快照；关闭或失活不触发采集，也不改变设备结果。 */
async function setOpen(value: boolean) { open.value = value && props.active; if (open.value) { await nextTick(); if (open.value) content.value?.focus() } }
function close() { open.value = false; trigger.value?.focus() }
watch(() => props.active, active => { if (!active) open.value = false }, { flush: 'sync' })
</script>
<style scoped>
.session-overview { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px) var(--space-4,16px); min-width:0; min-height:36px; padding-bottom:var(--space-2,8px); margin-bottom:var(--space-2,8px); border-bottom:1px solid var(--line); color:var(--ink-2); font-size:var(--fs-caption,12px); }
.session-overview-metric { display:inline-flex; align-items:baseline; flex-wrap:wrap; gap:6px; }.session-overview-metric b { color:var(--ink-1); font-weight:600; font-variant-numeric:tabular-nums; font-size:var(--fs-body,14px); }.session-overview-metric small { color:var(--ink-3); font-size:var(--fs-caption,12px); }.session-overview-info { color:var(--ink-3); }.session-distribution-trigger { margin-inline-start:auto; }
.session-distribution { width:640px; max-width:calc(100vw - 64px); outline:none; }.session-distribution-title { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }.session-distribution-title strong { font-size:var(--fs-body,14px); font-weight:600; }.session-distribution-table { overflow:auto; max-height:50vh; }.session-distribution-row { display:grid; grid-template-columns:minmax(150px,1fr) 130px 100px 170px; align-items:start; gap:12px; min-width:600px; padding:9px 0; border-bottom:1px solid var(--line); font-size:var(--fs-sm,13px); }.session-distribution-row--head { color:var(--ink-3); font-size:var(--fs-caption,12px); font-weight:500; }.session-distribution-row b { font-weight:500; font-variant-numeric:tabular-nums; }.session-distribution-node { min-width:0; overflow-wrap:anywhere; }.session-distribution-row small { display:block; color:var(--ink-3); font-size:var(--fs-caption,12px); }.session-distribution-row--stale b { color:var(--ink-3); text-decoration:underline dotted; }.session-distribution p { margin:10px 0 0; color:var(--ink-3); font-size:var(--fs-caption,12px); }
</style>
