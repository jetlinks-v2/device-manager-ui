<template>
  <section class="plugin-inspection" @keydown.esc.stop="emit('close')">
    <header class="plugin-inspection__header">
      <strong>{{ name }}</strong>
      <a-button type="text" size="small" :aria-label="t('pluginRuntime.refresh')" :title="t('pluginRuntime.refresh')" @click="emit('refresh')"><AIcon type="ReloadOutlined" /></a-button>
    </header>
    <p class="plugin-inspection__muted plugin-inspection__sample">{{ t('pluginRuntime.sampledAt') }} {{ lastSample || '—' }}</p>
    <div class="plugin-inspection__body">
      <section>
        <h4>{{ t('pluginRuntime.nodes') }}<span>{{ applicableNodes.length }}</span></h4>
        <p v-if="runtime.nodeError" class="plugin-inspection__problem" role="status">{{ runtime.nodeError }}</p>
        <p v-else-if="!applicableNodes.length" class="plugin-inspection__muted">{{ t('pluginRuntime.noEffectiveNodes') }}</p>
        <div v-for="node in applicableNodes" :key="node.serverId" class="plugin-inspection__row">
          <div class="plugin-inspection__identity"><span :title="node.serverId">{{ node.serviceId || node.serverId }}</span><span :class="{ 'plugin-inspection__problem': node.status === 'failed' }">{{ stateText(node) }}</span></div>
          <p class="plugin-inspection__muted">{{ node.serverId }}<template v-if="node.version"> · {{ node.version }}</template></p>
          <p v-if="node.status === 'loading' && node.progress" class="plugin-inspection__muted">{{ progressLabel(node.progress, t) }} {{ progressAmount(node.progress, locale, t) }}</p>
          <p v-if="node.error" class="plugin-inspection__problem">{{ node.error }}</p>
          <p v-else-if="node.lastError" class="plugin-inspection__muted">{{ t('pluginRuntime.recovered') }} · {{ node.lastError }}</p>
          <div v-if="node.status === 'failed' || canViewLogs && node.error" class="plugin-inspection__actions">
            <j-permission-button v-if="node.status === 'failed'" type="link" size="small" :has-permission="`${permissionKey}:update`" :loading="runtime.busy === node.serverId" @click="emit('retry', node)">{{ t('pluginRuntime.retry') }}</j-permission-button>
            <a-button v-if="canViewLogs && node.error" type="link" size="small" @click="emit('logs', node.serverId)">{{ t('pluginRuntime.logs') }}</a-button>
          </div>
        </div>
        <p v-if="unsupportedCount" class="plugin-inspection__muted plugin-inspection__note">{{ t('pluginRuntime.unsupportedNodes', { count: unsupportedCount }) }}</p>
      </section>
      <section class="plugin-inspection__instances">
        <h4>{{ t('pluginRuntime.instances') }}<span v-if="!runtime.pending && !runtime.instanceError">{{ previewInstances.length }}{{ runtime.limitReached ? '+' : '' }}</span></h4>
        <p v-if="runtime.instanceError" class="plugin-inspection__problem" role="status">{{ runtime.instanceError }}</p>
        <a-skeleton v-if="runtime.pending && !previewInstances.length" active :title="false" :paragraph="{ rows: 1 }" />
        <p v-else-if="!previewInstances.length && !runtime.instanceError" class="plugin-inspection__muted">{{ t('pluginRuntime.noInstances') }}</p>
        <div v-for="instance in previewInstances.slice(0, 5)" :key="`${instance.serverId}:${instance.instanceKey}`" class="plugin-inspection__row">
          <div class="plugin-inspection__identity"><span :title="instance.instanceKey">{{ instance.pluginId || instance.ownerId || instance.instanceKey }}</span><span class="plugin-inspection__state" :class="{ 'plugin-inspection__problem': !!instance.error }">{{ stateText(instance) }}<small v-if="isPreviousPluginRevision(instance)" class="plugin-inspection__previous">{{ t('pluginRuntime.previousInstance') }}</small></span></div>
          <p class="plugin-inspection__muted">{{ instance.serverId }}<template v-if="instance.ownerId && instance.ownerId !== instance.pluginId"> · {{ instance.ownerId }}</template></p>
          <p v-if="instance.error" class="plugin-inspection__problem">{{ instance.error }}</p>
        </div>
        <p v-if="previewInstances.length > 5 || runtime.limitReached" class="plugin-inspection__muted plugin-inspection__note">{{ t('pluginRuntime.instancePreview', { count: Math.min(5, previewInstances.length) }) }}<template v-if="runtime.limitReached"> · {{ t('pluginRuntime.instanceLimit') }}</template></p>
      </section>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimestamp } from '@vueuse/core'
import { theme } from 'ant-design-vue'
import { usePluginPermission } from '../../../hooks/usePermission'
import type { PluginRuntimeInfo } from '../../../api/link/pluginRuntime'
import { pluginRuntimeState, isPreviousPluginRevision, pluginInstancePreview, type PluginRuntimeInspection } from './runtimeState'
import { progressLabel, progressAmount } from './installProgress'

const props = defineProps<{ name: string; runtime: PluginRuntimeInspection; canViewLogs: boolean }>()
const emit = defineEmits<{ refresh: []; retry: [node: PluginRuntimeInfo]; logs: [serverId: string]; close: [] }>()
const { t, locale } = useI18n(), { token } = theme.useToken()
const permissionKey = usePluginPermission()
const now = useTimestamp({ interval: 1000 })
const previewInstances = computed(() => pluginInstancePreview(props.runtime.instances))
const applicableNodes = computed(() => props.runtime.nodes.filter(node => node.status !== 'unsupported'))
const unsupportedCount = computed(() => props.runtime.nodes.length - applicableNodes.value.length)
const lastSample = computed(() => {
  const sampledAt = Math.max(0, ...props.runtime.nodes.map(node => node.sampledAt), ...props.runtime.instances.map(row => row.sampledAt))
  return sampledAt ? new Date(sampledAt).toLocaleTimeString() : ''
})
function stateText(row: PluginRuntimeInfo) {
  const state = pluginRuntimeState(row, now.value), key = `pluginRuntime.states.${state}`, text = t(key)
  return text === key ? state : text
}
</script>
<style scoped>
.plugin-inspection { width:min(380px,calc(100vw - 64px)); color:var(--ink-1); font-size:var(--fs-12,12px); line-height:1.6; }
.plugin-inspection__header { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); }
.plugin-inspection__header strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-14,14px); font-weight:500; }
.plugin-inspection p { margin:var(--space-1) 0 0; overflow-wrap:anywhere; }
.plugin-inspection .plugin-inspection__sample { margin:0 0 var(--space-3); }
.plugin-inspection__body { max-height:min(420px,60vh); overflow:auto; scrollbar-gutter:stable; }
.plugin-inspection h4 { display:flex; align-items:center; gap:var(--space-2); margin:0; color:var(--ink-2); font-size:inherit; font-weight:500; }
.plugin-inspection h4 span { color:var(--ink-3); font-weight:400; font-variant-numeric:tabular-nums; }
.plugin-inspection__row { padding:var(--space-2) 0; }
.plugin-inspection__identity { display:flex; justify-content:space-between; align-items:baseline; gap:var(--space-3); }
.plugin-inspection__identity > :first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.plugin-inspection__identity > :last-child { flex:none; }
.plugin-inspection__state { display:flex; align-items:center; gap:var(--space-2); }
.plugin-inspection__previous { color:v-bind('token.colorWarning'); font-size:inherit; font-weight:400; }
.plugin-inspection__muted { color:var(--ink-3); }
.plugin-inspection__problem { color:v-bind('token.colorError'); }
.plugin-inspection__instances { margin-top:var(--space-3); padding-top:var(--space-3); border-top:var(--jet-theme-stroke-width) solid var(--line); }
.plugin-inspection .plugin-inspection__note { margin-top:var(--space-2); }
.plugin-inspection__actions { display:flex; gap:var(--space-2); margin-top:var(--space-1); }
</style>
