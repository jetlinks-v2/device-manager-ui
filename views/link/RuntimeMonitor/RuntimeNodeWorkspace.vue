<template>
  <NodeDiagnostics :node-id="nodeId" :scope-key="scopeKey" :property-cache="metrics.operational.cache.value" :heap-evidence="metrics.operational.heap.value" :tab="tab" :live="live" :stale="stale" :active="active && pageActive" :metrics="metrics.metrics.value" :sampled-at="sampledAt" :trace-id="traceId" :reloaded="reloaded" @tab="value => emit('tab', value)" @settings="emit('settings')"><template v-if="$slots['node-leading']" #node-leading><slot name="node-leading" /></template><template v-if="$slots['node-name']" #node-name><slot name="node-name" /></template><template #actions><slot name="actions" /></template></NodeDiagnostics>
</template>
<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, toRef, watch, type PropType, type Ref } from 'vue'
import type { MetricValue } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RealtimeNode } from '../../../visDashboard/SystemMonitor/utils/realtimeResourceData'
import { provideNodeMetrics } from '../diagnostics/useNodeMetrics'
import NodeDiagnostics from '../diagnostics/NodeDiagnostics.vue'

const props = defineProps({ nodeId: { type: String, required: true }, scopeKey: { type: String, required: true }, tab: { type: String, default: 'overview' }, live: { type: Object as PropType<RealtimeNode>, default: undefined }, stale: { type: Boolean, default: false }, pageActive: { type: Boolean, default: true }, sampledAt: { type: String, default: '' }, traceId: { type: String, default: '' }, reloaded: { type: Boolean, default: false }, connection: { type: Object as PropType<{ stale: Ref<boolean> }>, required: true } })
const emit = defineEmits<{ (event: 'tab', value: string): void; (event: 'settings'): void; (event: 'metrics', value: { nodeId: string; scopeKey: string; metrics: MetricValue[] }): void }>()
const active = ref(true)
// 每个缓存节点只拥有自己的概览会话，工具切换不会把别的节点基准带进标题。
const metrics = provideNodeMetrics(toRef(props, 'nodeId'), computed(() => active.value && props.pageActive && props.tab === 'overview'), toRef(props, 'scopeKey'), props.connection.stale, computed(() => active.value && props.pageActive))
function publishMetrics() { if (active.value && props.pageActive) emit('metrics', { nodeId: props.nodeId, scopeKey: props.scopeKey, metrics: metrics.metrics.value }) }
watch(metrics.metrics, publishMetrics, { immediate: true })
onDeactivated(() => { active.value = false })
onActivated(() => { active.value = true; publishMetrics() })
</script>
