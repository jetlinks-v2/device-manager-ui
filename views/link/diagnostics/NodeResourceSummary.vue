<template>
  <div class="node-resource-shell"><div class="node-resource-summary">
    <section>
      <h4>{{ t('components.RealtimeResource.system') }}</h4>
      <NodeResourceMeter label="CPU" :percent="live?.cpuSystem" />
      <NodeResourceMeter :label="t('runtimeDiagnostics.memory')" :percent="live?.memorySystem" :used="live?.memorySystemUsed" :total="live?.memorySystemTotal" capacity />
      <small v-if="live"><a-tooltip :title="view.loadTooltip(live)">{{ view.loadSummary(live) }}</a-tooltip></small>
    </section>
    <section>
      <h4>JVM</h4>
      <NodeResourceMeter label="CPU" :percent="live?.cpuJvm" />
      <NodeResourceMeter :label="t('runtimeDiagnostics.heap')" :percent="live?.memoryJvm" :used="live?.memoryJvmUsed" :total="live?.memoryJvmTotal" capacity />
      <small v-if="live">{{ t('components.RealtimeResource.nonHeapSize', [memorySize(live.memoryJvmNonHeapUsed)]) }}</small>
      <dl v-if="jvmMetrics.length" class="node-resource-jvm-metrics"><template v-for="metric in jvmMetrics" :key="metric.key"><dt>{{ metric.label }}</dt><dd>{{ metric.value }}</dd></template></dl>
    </section>
    <section>
      <h4>{{ t('components.RealtimeResource.disk') }}</h4>
      <NodeResourceMeter :label="t('components.RealtimeResource.disk')" :percent="live?.disk" :used="live?.diskUsed" :total="live?.diskTotal" capacity />
      <RealtimeMetricGroup v-if="live" :items="view.diskItems(live)" inline />
    </section>
    <section>
      <h4>{{ t('components.RealtimeResource.network') }}</h4>
      <template v-if="live"><RealtimeMetricGroup :items="view.networkTrafficItems(live)" inline /><RealtimeMetricGroup :items="view.networkConnectionItems(live)" /><RealtimeMetricGroup :items="view.networkQualityItems(live)" inline /></template>
      <span v-else>—</span>
    </section>
  </div></div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MetricValue } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import NodeResourceMeter from './NodeResourceMeter.vue'
import { formatMemorySize } from '../../../visDashboard/SystemMonitor/utils/monitorData'
import RealtimeMetricGroup from '../../../visDashboard/SystemMonitor/components/RealtimeMetricGroup.vue'
import { useRealtimeResourcePresentation } from '../../../visDashboard/SystemMonitor/hooks/useRealtimeResourcePresentation'
const props = defineProps({ live: { type: Object as PropType<RealtimeNode>, default: undefined }, metrics: { type: Array as PropType<MetricValue[]>, default: () => [] } })
const { t } = useI18n()
const view = useRealtimeResourcePresentation()
const jvmMetrics = computed(() => props.metrics.filter(metric => ['threads', 'gc'].includes(metric.key) && metric.value !== undefined))
const memorySize = (value?: number) => value === undefined ? '—' : formatMemorySize(value)
</script>
<style scoped>
.node-resource-shell { container-type:inline-size; }
.node-resource-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 20px; margin-bottom:10px; }
@container (min-width:900px) { .node-resource-summary { grid-template-columns:repeat(4,minmax(0,1fr)); } }
@container (max-width:399px) { .node-resource-summary { grid-template-columns:minmax(0,1fr); } }
section { min-width:0; }h4 { margin:0 0 6px; color:var(--ink-2); font-size:12px; font-weight:600; }
section > :deep(.node-resource-meter) { margin-block:5px; }section > :deep(.realtime-metric-group) { margin-top:5px; }
small { display:block; color:var(--ink-3); font-size:12px; line-height:18px; }
.node-resource-jvm-metrics { display:flex; flex-wrap:wrap; gap:4px 8px; margin:4px 0 0; font-size:12px; line-height:18px; }.node-resource-jvm-metrics dt { color:var(--ink-3); }.node-resource-jvm-metrics dd { margin:0 8px 0 0; }
.node-resource-summary :deep(.realtime-metric-group__item span) { color:var(--ink-3); }
</style>
