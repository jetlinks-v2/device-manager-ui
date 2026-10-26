<template>
  <section class="device-connections-workspace">
    <SessionOverview v-if="access.monitor" :overview="overview" :active="active" />
    <DeviceSessionObservation :entries="observation.entries.value" :device-options="suggestions.options.value" :device-searching="suggestions.searching.value" :active="active" :access="{ allowed: access.sessions }" :unsupported="supported === false" :waiting="supported === undefined && access.monitor"
      :paused="observation.paused.value" :interval="observation.interval.value" :metrics="observation.metrics.value"
      @add="add" @remove="remove" @refresh="observation.refresh" @search-device="suggestions.search" @update:paused="value => observation.paused.value = value" @update:interval="value => observation.interval.value = value" @update:metrics="value => observation.metrics.value = value" />
  </section>
</template>
<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DeviceSessionObservation } from '@jetlinks-web-core/components/RuntimeDiagnostics'
import type { DiagnosticNode } from '../../../api/link/diagnostics'
import { useDiagnosticsAccess } from '../diagnostics/useDiagnosticsAccess'
import { useDeviceSuggestions } from '../diagnostics/useDeviceSuggestions'
import { useDeviceObservation } from './device-observation/useDeviceObservation'
import { useClusterSessionContext } from './useClusterSessions'
import { sessionOverview } from './sessionOverview'
import SessionOverview from './SessionOverview.vue'

const props = defineProps<{ active: boolean; supported: boolean | undefined; nodes: DiagnosticNode[]; scopeKey: string }>()
const route = useRoute(), router = useRouter(), access = useDiagnosticsAccess()
const active = computed(() => props.active), scopeKey = computed(() => props.scopeKey)
// 设备连接查询有独立按钮授权；无监控权限时允许尝试尚未发现的能力。
const capability = computed(() => props.supported === true || props.supported === undefined && !access.value.monitor)
const observation = useDeviceObservation(active, computed(() => access.value.sessions), capability, scopeKey, computed(() => props.supported))
const suggestions = useDeviceSuggestions(computed(() => active.value && access.value.sessions), scopeKey)
const clusterSessions = useClusterSessionContext()
const overview = computed(() => sessionOverview(props.nodes, clusterSessions?.snapshots.value ?? new Map()))

function updateQuery(deviceId?: string) {
  if (!active.value) return
  const { nodeId: _legacyNode, ...query } = route.query
  void router.replace({ query: { ...query, deviceId } })
}
function add(id: string, label?: string) { if (active.value && capability.value && observation.add(id, label)) updateQuery(id.trim()) }
function remove(id: string) { observation.remove(id); if (route.query.deviceId === id) updateQuery(observation.entries.value.at(-1)?.id) }
// 深链只是加入观测集合；周期刷新不改路由，一级视图往返不会重建已有设备。
watch([active, capability, () => access.value.sessions, scopeKey, () => route.query.deviceId], ([enabled, supported, permitted, _scope, id]) => {
  if (enabled && supported && permitted && typeof id === 'string' && id.trim()) observation.add(id.trim())
}, { immediate: true, flush: 'post' })
</script>
<style scoped>
.device-connections-workspace { min-width:0; }
</style>
