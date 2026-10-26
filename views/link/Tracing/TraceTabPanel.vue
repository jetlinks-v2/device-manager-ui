<template>
  <section v-show="active" ref="root" class="trace-tab-panel">
    <TraceViewer :active="active" :spans="spans" :state="tab.state" :selected-id="tab.selectedId" :focus-node="tab.focusNode" :log-access="{ allowed: logAccess }" :node-access="{ allowed: nodeAccess }" @refresh="emit('refresh')" @select="emit('select', $event)" @logs="emit('logs', $event)" @node="emit('node', $event)" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { TraceViewer, type TraceSpan } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DiagnosticNode } from '../../../api/link/diagnostics'
import { normalizeTrace } from '../diagnostics/normalize'
import type { TraceWorkspaceTab } from './useTraceWorkspace'

const props = defineProps<{ tab: TraceWorkspaceTab; nodes: DiagnosticNode[]; active: boolean; logAccess: boolean; nodeAccess: boolean }>()
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'select', span?: TraceSpan): void; (event: 'logs' | 'node', span: TraceSpan): void }>()
const root = ref<HTMLElement>(), spans = computed(() => normalizeTrace(props.tab.data ?? [], props.nodes))
let position: Array<{ element: HTMLElement; top: number; left: number }> = []
// Ant Table 的内部容器负责双轴滚动；仅保存页面外层 scrollTop 会丢失当前调用位置。
watch(() => props.active, async active => {
  if (!active) {
    position = Array.from(root.value?.querySelectorAll<HTMLElement>('.ant-table-body, .ant-table-content') ?? []).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft }))
  } else {
    await nextTick()
    if (props.active) position.forEach(({ element, top, left }) => { if (element.isConnected) { element.scrollTop = top; element.scrollLeft = left } })
  }
}, { flush: 'pre' })
</script>
<style scoped>
.trace-tab-panel { min-width:0; }
</style>
