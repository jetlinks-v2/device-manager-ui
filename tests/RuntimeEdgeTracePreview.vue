<template>
  <main class="preview-shell" :class="{ 'preview-shell--narrow': narrow }">
    <header class="preview-controls"><strong>边缘链路补全验收 · 合成数据</strong><a-button @click="workspace.refresh()">刷新链路</a-button><a-button @click="narrow = !narrow">切换窄屏</a-button><a-button @click="active = !active">{{ active ? '隐藏链路' : '显示链路' }}</a-button></header>
    <TraceTabPanel v-if="workspace.active.value" :tab="workspace.active.value" :nodes="[{ id: 'iot-service:8200' }]" :active="active" :log-access="false" :node-access="false" @refresh="workspace.refresh()" @select="select" @retry-edge="workspace.retryEdge(workspace.active.value!.key, $event)" />
  </main>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TraceSpan } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { RawSpan } from '../api/link/diagnostics'
import TraceTabPanel from '../views/link/Tracing/TraceTabPanel.vue'
import { useTraceWorkspace } from '../views/link/Tracing/useTraceWorkspace'
const traceId = '1234567890abcdef1234567890abcdef', active = ref(true), narrow = ref(false)
const base = 1792652760000000000n, attempts = new Map<string, number>()
function span(spanId: string, name: string, start: number, end: number, parentSpanId?: string, app = 'iot-service:8200'): RawSpan {
  return { traceId, spanId, parentSpanId, app, name, startWithNanos: String(base + BigInt(start) * 1000000n), endWithNanos: String(base + BigInt(end) * 1000000n) }
}
const cloud = [span('root', '/http/POST/device/instance/edge-demo/function/invoke', 0, 150), span('proxy-east', '/agent-proxy/device/edge-east', 10, 100, 'root'), span('proxy-west', '/agent-command/device:edge-west/runtimeService/ProxyWebApi/_execute', 20, 130, 'root')]
const workspace = useTraceWorkspace({ allowed: () => true, load: async () => cloud, errorState: () => ({ status: 'error', message: '示例：边缘连接超时' }), edge: { load: async (target, _, signal) => {
  await new Promise(resolve => setTimeout(resolve, 500))
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const attempt = (attempts.get(target.key) ?? 0) + 1; attempts.set(target.key, attempt)
  if (target.thingId === 'edge-west' && attempt === 1) throw new Error('Example timeout')
  const east = target.thingId === 'edge-east'
  return [span(east ? 'remote-east' : 'remote-west', east ? '/device/function/writeProperty' : '/device/function/readProperty', east ? 25 : 35, east ? 80 : 110, east ? 'proxy-east' : 'proxy-west')]
} } })
function select(value?: TraceSpan) { if (workspace.active.value) workspace.active.value.selectedId = value && 'key' in value ? String(value.key) : value?.id ?? '' }
watch(active, value => value ? workspace.resume() : workspace.suspend(), { flush: 'sync' })
workspace.open(traceId)
</script>
<style scoped>
.preview-shell { padding:24px; min-height:100vh; color:var(--ink-1); background:var(--bg-container,#fff); }
.preview-shell--narrow { width:760px; max-width:100%; }
.preview-controls { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:24px; }
.preview-controls strong { margin-right:auto; }
</style>
