<template>
  <main ref="root" class="runtime-workspace">
    <PageChrome flush><SlantedTabs :active-key="view" :options="tabs" @change="selectView(String($event))" /></PageChrome>
    <section v-if="access.enter" v-show="view === 'cluster'" class="runtime-workspace__view"><ClusterMonitor /></section>
    <section v-if="access.trace" v-show="view === 'tracing'" class="runtime-workspace__view"><ClusterTracing :active="active && view === 'tracing'" /></section>
    <section v-if="access.sessions" v-show="view === 'connections'" class="runtime-workspace__view"><DeviceConnectionsWorkspace :active="active && view === 'connections'" :supported="supported" :nodes="nodes" :scope-key="scopeKey" /></section>
  </main>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import SlantedTabs, { type SlantedTabOption } from '@jetlinks-web-core/components/SlantedTabs'
import ClusterMonitor from './RuntimeMonitor/index.vue'
import ClusterTracing from './Tracing/index.vue'
import { provideClusterWorkspace } from './RuntimeMonitor/useClusterWorkspace'
import { provideClusterSessions } from './RuntimeMonitor/useClusterSessions'
import { clusterSessionSupport, useRuntimeWorkspace } from './useRuntimeWorkspace'
import { diagnosticIntervalSeconds } from './diagnostics/preferences'
const DeviceConnectionsWorkspace = defineAsyncComponent(() => import('./RuntimeMonitor/DeviceConnectionsWorkspace.vue'))
const { root, active, view, access, selectView } = useRuntimeWorkspace(), { t } = useI18n()
const cluster = provideClusterWorkspace(computed(() => active.value && view.value === 'cluster'), active)
// 能力目录属于整个工作区，切换一级视图仍可轻量发现；完整设备结果由连接页按需查询。
const sessions = provideClusterSessions(computed(() => cluster.nodes.value.map(node => node.id)), computed(() => active.value && access.value.monitor), cluster.scopeKey, cluster.discoveryScope, computed(() => access.value.monitor), computed(() => diagnosticIntervalSeconds(cluster.preferences.value.value.bufferIntervalSeconds)))
const supported = computed(() => clusterSessionSupport(cluster.nodes.value.map(node => node.id), sessions.snapshots.value))
const tabs = computed<SlantedTabOption[]>(() => [
  ...(access.value.enter ? [{ key: 'cluster', label: t('RuntimeMonitor.clusterMonitoring') }] : []),
  ...(access.value.trace ? [{ key: 'tracing', label: t('RuntimeMonitor.tracing') }] : []),
  // 无 monitor 权限无法发现 MBean；独立 sessions 授权允许尝试查询，不能把未知当成支持证据。
  ...(access.value.sessions && (supported.value === true || !access.value.monitor && supported.value === undefined) ? [{ key: 'connections', label: t('RuntimeMonitor.deviceConnections') }] : []),
])
const nodes = computed(() => cluster.nodes.value.map(({ id, alias }) => ({ id, alias })))
const scopeKey = cluster.scopeKey
</script>
<style scoped>
.runtime-workspace,.runtime-workspace__view { display:flex; flex:1 1 auto; min-width:0; min-height:0; flex-direction:column; }
.runtime-workspace__view { font-size:var(--fs-body,14px); line-height:var(--lh-normal,1.55); }
/* 只约束诊断内容的默认强调与操作图标；各区块仍可声明更轻的字重。 */
.runtime-workspace__view :deep(:where(strong,b)) { font-weight:600; }
.runtime-workspace__view :deep(:where(.ant-btn) > .anticon),.runtime-workspace__view :deep(.anticon-info-circle) { font-size:var(--fs-body,14px); }
.runtime-workspace__view :deep(:where(.ant-btn) > .anticon-down),.runtime-workspace__view :deep(:where(.ant-btn) > .anticon-right) { font-size:var(--fs-caption,12px); }
.runtime-workspace__view :deep(.ant-btn-lg > .anticon) { font-size:var(--fs-title-4,16px); }
</style>
