<template>
  <a-button v-if="queues.length" class="buffer-history-entry" type="text" size="small" @click="open = true"><LineChartOutlined />{{ t('runtimeDiagnostics.bufferHistoryTitle') }}</a-button>
  <a-modal v-model:open="open" :title="t('runtimeDiagnostics.bufferHistoryTitle')" :footer="null" :width="1120" :style="{ top: '24px', maxWidth: 'calc(100vw - 32px)' }" :body-style="{ maxHeight: 'calc(100dvh - 144px)', overflowY: 'auto', overscrollBehavior: 'contain' }" destroy-on-close>
    <div class="buffer-history-toolbar">
      <nav v-if="queues.length > 1" class="buffer-history-queues" :aria-label="t('runtimeDiagnostics.bufferName')">
        <a-tabs v-model:active-key="objectName" size="small" :tab-bar-gutter="16"><a-tab-pane v-for="queue in queues" :key="queue.objectName"><template #tab><span class="buffer-history-queue-tab" :title="queue.objectName">{{ queue.name }}</span></template></a-tab-pane></a-tabs>
      </nav>
      <strong v-else class="buffer-history-queue" :title="objectName">{{ queues[0]?.name }}</strong>
      <div class="buffer-history-actions" role="group" :aria-label="t('runtimeDiagnostics.bufferHistoryTitle')">
        <a-button v-for="item in ranges" :key="item.value" :type="range === item.value ? 'link' : 'text'" :aria-pressed="range === item.value" :title="item.label" size="small" @click="range = item.value">{{ item.shortLabel }}</a-button>
        <a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.refresh')" :title="t('runtimeDiagnostics.refresh')" :loading="query.state.value.status === 'loading'" @click="load"><ReloadOutlined /></a-button>
      </div>
    </div>
    <a-spin :spinning="query.state.value.status === 'loading'">
      <BufferObservationHistory v-if="query.data.value" :recording="query.data.value" />
      <a-empty v-else :description="query.state.value.message || t('runtimeDiagnostics.noMonitoringData')" />
    </a-spin>
  </a-modal>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { LineChartOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { BufferObservationHistory, readBufferObservationRecording, type BufferObservationRecording, type MBeanDescriptor } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import { runtimeBeanOverview } from '@jetlinks-web-core/components/RuntimeDiagnostics/utils'
import { useDiagnosticQuery } from '@jetlinks-web-core/hooks/useDiagnosticQuery'
import { queryMBeans } from '../../../api/link/diagnostics'
import { normalizeMBeans } from './normalize'
import { diagnosticErrorState } from './status'
const props = defineProps<{ nodeId: string; scopeKey: string; active: boolean; permitted: boolean; beans: MBeanDescriptor[] }>()
const { t } = useI18n()
const open = ref(false), objectName = ref<string>(), range = ref<'recent' | 'hour'>('recent')
const query = useDiagnosticQuery<BufferObservationRecording | undefined>()
const queues = computed(() => runtimeBeanOverview(props.beans).buffers.filter(queue => queue.observation))
const ranges = computed(() => [{ value: 'recent' as const, label: t('runtimeDiagnostics.bufferHistoryRecent'), shortLabel: t('runtimeDiagnostics.bufferHistoryRecentShort') }, { value: 'hour' as const, label: t('runtimeDiagnostics.bufferHistoryHour'), shortLabel: t('runtimeDiagnostics.bufferHistoryHourShort') }])
const generation = computed(() => queues.value.find(queue => queue.objectName === objectName.value)?.observation?.generation)
watch(queues, values => { if (!values.some(queue => queue.objectName === objectName.value)) objectName.value = values[0]?.objectName }, { immediate: true })
/** 历史只在用户打开、切换或刷新时请求；既有 query 负责取消和拒绝迟到响应。 */
function load() {
  const target = objectName.value, hour = range.value === 'hour', expectedGeneration = generation.value
  if (!open.value || !props.active || !props.permitted || !target || !expectedGeneration) { query.clear(); return }
  void query.run(async signal => {
    const raw = await queryMBeans(props.nodeId, signal, target, [hour ? 'HourHistory' : 'RecentHistory'])
    const bean = normalizeMBeans(raw).find(bean => bean.domain === 'org.jetlinks' && bean.type === 'PersistenceBuffer' && bean.objectName === target)
    const recording = bean ? readBufferObservationRecording(bean, hour) : undefined
    return recording?.snapshot.generation === expectedGeneration ? recording : undefined
  }, true, { errorState: diagnosticErrorState, isEmpty: value => value === undefined })
}
watch([() => props.nodeId, () => props.scopeKey, () => props.active, () => props.permitted], () => { open.value = false; query.clear() }, { flush: 'sync' })
watch([open, objectName, range, generation], load, { flush: 'sync' })
</script>
<style scoped>
.buffer-history-entry { padding-inline:4px; color:var(--ink-2); font-size:var(--fs-caption,12px); }
.buffer-history-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:4px 16px; min-width:0; margin-bottom:8px; }
.buffer-history-queues { flex:1 1 240px; min-width:0; }.buffer-history-queues :deep(.ant-tabs-nav) { margin:0; }.buffer-history-queues :deep(.ant-tabs-tab) { padding-block:6px; font-size:var(--fs-caption,12px); }
.buffer-history-queue-tab { display:block; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.buffer-history-queue { flex:1 1 180px; min-width:0; overflow-wrap:anywhere; font-size:var(--fs-body,14px); font-weight:500; }
.buffer-history-actions { display:flex; align-items:center; gap:2px; margin-inline-start:auto; }.buffer-history-actions :deep(.ant-btn) { padding-inline:6px; font-size:var(--fs-caption,12px); }
</style>
