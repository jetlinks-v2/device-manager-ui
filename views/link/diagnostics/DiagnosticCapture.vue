<template>
  <a-modal :open="open" :title="t(kind === 'jfr' ? 'runtimeDiagnostics.jfrFile' : 'runtimeDiagnostics.exportHeap')" :ok-text="t(kind === 'jfr' ? 'runtimeDiagnostics.startRecording' : 'runtimeDiagnostics.exportHeapDump')" :confirm-loading="busy" :ok-button-props="{ disabled: !allowed || busy }" @ok="view.capture(kind, live)" @cancel="close">
    <a-descriptions size="small" :column="1"><a-descriptions-item :label="t('runtimeDiagnostics.nodes')">{{ nodeId }}</a-descriptions-item></a-descriptions>
    <a-form v-if="kind === 'jfr'" layout="vertical"><a-form-item :label="t('runtimeDiagnostics.seconds')"><a-input-number v-model:value="view.seconds.value" :min="1" :max="300" /></a-form-item></a-form>
    <a-alert :type="kind === 'heap-dump' ? 'warning' : 'info'" show-icon :message="t(kind === 'heap-dump' ? 'runtimeDiagnostics.heapEvidenceHint' : 'RuntimeMonitor.jfrFileHint')" />
    <a-alert v-if="kind === 'heap-dump' && live" type="warning" show-icon :message="t('RuntimeMonitor.liveHeapConfirm')" />
    <a-alert v-if="['error', 'forbidden', 'unsupported'].includes(view.operation.state.value.status)" type="error" :message="view.operation.state.value.message || t('runtimeDiagnostics.failed')" />
    <a-alert v-if="busy" type="info" :message="t('RuntimeMonitor.captureInProgress')" />
    <a-alert v-if="view.operation.data.value" type="success" :message="t('runtimeDiagnostics.captureDone')" />
  </a-modal>
</template>
<script setup lang="ts">
import { computed, toRef, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDiagnosticsAccess } from './useDiagnosticsAccess'
import { useDiagnosticCapture } from './useDiagnosticCapture'
const props = defineProps({ nodeId: { type: String, required: true }, open: { type: Boolean, default: false }, kind: { type: String as PropType<'jfr' | 'heap-dump'>, default: 'jfr' }, live: { type: Boolean, default: false } })
const emit = defineEmits<{ (event: 'close'): void }>()
const { t } = useI18n(), access = useDiagnosticsAccess()
const view = useDiagnosticCapture(toRef(props, 'nodeId'))
const busy = computed(() => view.operation.state.value.status === 'loading')
const allowed = computed(() => props.kind === 'jfr' ? access.value.exportJfr : access.value.heap)
function close() { view.operation.clear(); emit('close') }
watch(() => props.open, () => { view.operation.clear(); view.seconds.value = 10 })
</script>
<style scoped>.ant-alert { margin-top:var(--space-3,12px); }</style>
