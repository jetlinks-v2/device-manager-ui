<template>
  <section v-if="trends.length || communication?.supported === true || signals.length" class="node-operational-overview" :aria-label="t('runtimeDiagnostics.operationalSignals')">
    <DeviceRuntimeTrend :session="trends.find(trend => trend.key === 'sessions')" :cache="trends.find(trend => trend.key === 'property-cache')" :communication="communication" :recording="recording" :config="config" @retry-recording="emit('retry-recording')" @peak="value => emit('peak', value)" @live="emit('live')" @details="details" @configure="value => emit('configure', value)" />
    <div v-if="signals.length" class="node-operational-signals">
      <a-button v-for="signal in signals" :key="signal.objectName" type="link" size="small" class="node-operational-signal" :class="{ 'node-operational-signal--stale': signal.stale || state.status === 'stale' }" @click="emit('inspect', signal.objectName)">
        <span v-for="fact in signal.facts" :key="fact.label">{{ t(fact.label) }} {{ fact.value }}</span><small v-if="signal.stale || state.status === 'stale'">{{ t('RuntimeMonitor.overviewRetained') }}</small>
      </a-button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ViewState } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { OperationalSignal } from './useNodeOperationalSignals'
import type { OverviewTrend } from './overview/useOverviewTrends'
import DeviceRuntimeTrend from './overview/DeviceRuntimeTrend.vue'
import type { NodeDeviceMessageSnapshot } from '../RuntimeMonitor/device-runtime/deviceMessageHistory'
import type { DeviceRecordingView, DevicePeakSelection } from '../RuntimeMonitor/device-runtime/deviceMessageRecording'
import type { DiagnosticNodePreference } from './preferences'
defineProps({ recording: { type: Object as PropType<DeviceRecordingView>, default: undefined }, signals: { type: Array as PropType<OperationalSignal[]>, default: () => [] }, trends: { type: Array as PropType<OverviewTrend[]>, default: () => [] }, state: { type: Object as PropType<ViewState>, required: true }, communication: { type: Object as PropType<NodeDeviceMessageSnapshot>, default: undefined }, config: { type: Object as PropType<DiagnosticNodePreference>, default: () => ({}) } })
const emit = defineEmits<{ (event: 'peak', value: DevicePeakSelection): void; (event: 'live' | 'retry-recording'): void; (event: 'inspect', objectName: string): void; (event: 'session'): void; (event: 'configure', value: Partial<DiagnosticNodePreference>): void }>()
const { t } = useI18n()
function details(value: string) { if (value === 'session') emit('session'); else emit('inspect', value) }
</script>
<style scoped>
.node-operational-signals { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-3,12px); margin:var(--space-2,8px) 0; }
.node-operational-signal { display:inline-flex; flex-wrap:wrap; align-items:baseline; gap:var(--space-1,4px); height:auto; padding:0; color:var(--ink-2); font-size:var(--fs-12,12px); white-space:normal; }
.node-operational-signal--stale { opacity:.7; }
.node-operational-overview { container-type:inline-size; }
</style>
