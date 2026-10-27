<template>
  <section v-show="active" ref="root" class="trace-tab-panel">
    <div v-if="tab.edges?.length" class="trace-edge-status">
      <a-popover :open="sourcesOpen" trigger="click" placement="bottomLeft" @open-change="setSourcesOpen">
        <template #content>
          <div class="trace-edge-sources" @keydown.esc.stop.prevent="closeSources(true)">
            <div v-for="edge in tab.edges" :key="edge.target.key" class="trace-edge-source">
              <CloudServerOutlined aria-hidden="true" />
              <span class="trace-edge-name" :title="`${edge.target.thingType}:${edge.target.thingId}`">{{ edge.target.thingId }}</span>
              <span class="trace-edge-state" :title="edge.message" :class="{ 'trace-edge-state--failed': ['error', 'forbidden', 'unsupported'].includes(edge.status) }">
                <LoadingOutlined v-if="edge.status === 'loading'" spin />
                {{ edge.status === 'ready' ? t('Tracing.edgeSpans', { count: edge.data?.length ?? 0 }) : t(`Tracing.edgeState.${edge.status}`) }}
              </span>
              <a-tooltip v-if="['empty', 'error', 'unsupported', 'forbidden'].includes(edge.status)" :title="t('Tracing.retryEdge')">
                <a-button type="text" size="small" :aria-label="`${t('Tracing.retryEdge')} ${edge.target.thingId}`" @click="emit('retryEdge', edge.target.key)"><ReloadOutlined /></a-button>
              </a-tooltip>
            </div>
            <small>{{ t('Tracing.edgeRetentionHint') }}</small>
          </div>
        </template>
        <a-button ref="sourcesTrigger" type="text" size="small" :aria-label="t('Tracing.edgeSources')" :aria-expanded="sourcesOpen" :class="{ 'trace-edge-trigger--failed': failed }" @keydown.esc.stop.prevent="closeSources(true)">
          <LoadingOutlined v-if="loading" spin /><CloudServerOutlined v-else />
          {{ t('Tracing.edgeProgress', { done: completed, total: tab.edges.length }) }}<DownOutlined />
        </a-button>
      </a-popover>
      <span v-if="tab.omittedEdges" class="trace-edge-limit">{{ t('Tracing.edgeLimit', { count: tab.omittedEdges }) }}</span>
    </div>
    <TraceViewer :active="active" :spans="spans" :state="tab.state" :selected-id="tab.selectedId" :focus-node="tab.focusNode" :log-access="{ allowed: logAccess }" :node-access="{ allowed: nodeAccess }" @refresh="emit('refresh')" @select="emit('select', $event)" @logs="emit('logs', $event)" @node="emit('node', $event)" />
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { TraceViewer, type TraceSpan } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { CloudServerOutlined, DownOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import type { DiagnosticNode } from '../../../api/link/diagnostics'
import { normalizeTrace } from '../diagnostics/normalize'
import type { TraceWorkspaceTab } from './useTraceWorkspace'
import { combinedTraceSpans } from './edgeTrace'

const props = defineProps<{ tab: TraceWorkspaceTab; nodes: DiagnosticNode[]; active: boolean; logAccess: boolean; nodeAccess: boolean }>()
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'select', span?: TraceSpan): void; (event: 'logs' | 'node', span: TraceSpan): void; (event: 'retryEdge', key: string): void }>()
const { t } = useI18n()
const root = ref<HTMLElement>(), spans = computed(() => normalizeTrace(combinedTraceSpans(props.tab), props.nodes))
const completed = computed(() => props.tab.edges?.filter(edge => edge.status === 'ready' || edge.status === 'empty').length ?? 0)
const loading = computed(() => props.tab.edges?.some(edge => edge.status === 'pending' || edge.status === 'loading'))
const failed = computed(() => props.tab.edges?.some(edge => ['error', 'forbidden', 'unsupported'].includes(edge.status)))
const sourcesOpen = ref(false), sourcesTrigger = ref<{ focus?: () => void }>()
function setSourcesOpen(open: boolean) { sourcesOpen.value = open && props.active }
/** 隐藏页不能遗留传送到 body 的浮层；Escape 只在当前视图恢复焦点。 */
async function closeSources(restoreFocus = false) {
  sourcesOpen.value = false
  await nextTick()
  if (restoreFocus && props.active) sourcesTrigger.value?.focus?.()
}
watch(() => props.active, active => { if (!active) void closeSources() }, { flush: 'sync' })
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
.trace-edge-status { display:flex; align-items:center; gap:8px; margin-bottom:8px; min-height:24px; }
.trace-edge-limit, .trace-edge-state, .trace-edge-sources small { color:var(--text-muted); font-size:12px; }
.trace-edge-trigger--failed, .trace-edge-state--failed { color:var(--warning-color, #d48806); }
.trace-edge-sources { width:min(380px, calc(100vw - 48px)); display:grid; gap:8px; }
.trace-edge-source { display:flex; align-items:center; gap:8px; font-size:13px; }
.trace-edge-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trace-edge-state { display:inline-flex; align-items:center; gap:4px; flex-shrink:0; }
</style>
