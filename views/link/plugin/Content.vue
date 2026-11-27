<template>
  <FullPage class="plugin-list" :padding="16" :style="{ '--plugin-card-row-height': `${list.rowHeight}px` }">
    <header class="plugin-list__toolbar">
      <div v-if="$slots.headerLeftRender" class="plugin-list__context"><slot name="headerLeftRender" /></div>
      <ConditionFilter class="plugin-list__filter" :columns="filterFields" target="link-plugin" @search="list.refresh" />
      <span class="plugin-list__count">{{ t('pluginRuntime.loaded', { count: list.items.value.length }) }}</span>
      <a-space :size="8" class="plugin-list__actions">
        <a-button type="text" size="small" :aria-label="t('pluginRuntime.refresh')" :title="t('pluginRuntime.refresh')" @click="list.refresh()"><AIcon type="ReloadOutlined" /></a-button>
        <j-permission-button type="primary" :hasPermission="`${permissionKey}:add`" @click="add"><template #icon><AIcon type="PlusOutlined" /></template>{{ t('plugin.index.293829-0') }}</j-permission-button>
      </a-space>
    </header>
    <div ref="viewport" class="plugin-list__body">
      <VirtualScroll v-if="list.items.value.length" ref="scroll" class="plugin-list__scroll" tabindex="0" role="region" :aria-label="t('AccessComponent.listTitle.plugin')" :data="list.rows.value" :item-height="list.rowHeight" :style="{ height: '0px' }" @reach-bottom="list.loadMore">
        <template #renderItem="{ plugins }">
          <div class="plugin-list__row" :style="{ gridTemplateColumns: `repeat(${list.columns.value}, minmax(0, 1fr))` }">
            <PluginCard v-for="plugin in plugins" :key="plugin.id" :data="plugin" :status="statusFor(plugin.id)" :loading="runtime.loading.value.has(plugin.id) || !visibleIds.has(plugin.id)" :permission="permissionKey"
              :type-label="runtime.rows.value.find(node => node.driverId === plugin.id && node.typeName)?.typeName"
              :actions="actions(plugin)" :inspection-open="inspectionId === plugin.id" :inspection="inspectionId === plugin.id ? inspectionView : undefined" :can-view-logs="diagnostics.logs"
              @inspect="inspect(plugin.id, $event)" @visibility="setVisible(plugin.id, $event)" @refresh="refreshInspection" @retry="retryNode" @logs="openLogs" />
          </div>
        </template>
      </VirtualScroll>
      <div v-else-if="list.loading.value" class="plugin-list__skeleton" aria-hidden="true"><CardSummary v-for="n in 6" :key="n" class="plugin-list__placeholder" :data="{ title: '' }" :background-opacity="100" disabled><template #title><a-skeleton-input active size="small" /></template><template #description><a-skeleton active :title="false" :paragraph="{ rows: 2 }" /></template></CardSummary></div>
      <a-result v-else-if="list.error.value" status="warning" :title="t('pluginRuntime.loadFailed')"><template #extra><a-button @click="list.loadMore">{{ t('pluginRuntime.reloadList') }}</a-button></template></a-result>
      <CloudEmpty v-else :search="list.query.value.terms" :search-name="t('components.SecondKind.311605-0')">
        <j-permission-button type="primary" :hasPermission="`${permissionKey}:add`" @click="add">{{ t('plugin.index.293829-0') }}</j-permission-button>
      </CloudEmpty>
      <div v-if="list.items.value.length" class="plugin-list__tail">
        <template v-if="list.error.value">{{ t('pluginRuntime.loadFailed') }} <a-button type="link" @click="list.loadMore">{{ t('pluginRuntime.reloadList') }}</a-button></template>
        <template v-else-if="list.loading.value"><a-spin size="small" />{{ t('pluginRuntime.loadingMore') }}</template>
        <a-button v-else-if="list.more.value" type="link" @click="list.loadMore">{{ t('pluginRuntime.loadMore') }}</a-button>
        <template v-else>{{ t('pluginRuntime.listEnd') }}</template>
      </div>
    </div>
  </FullPage>
  <SaveModal v-if="visible" :data="editData || {}" @cancel="visible = false" @ok="save" />
</template>
<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import VirtualScroll from '@jetlinks-web-core/components/VirtualScroll/index.vue'
import { CardSummary } from '@jetlinks-web-core/components/CardBox'
import { getTypes } from '../../../api/link/plugin'
import { usePluginPermission } from '../../../hooks/usePermission'
import { usePluginRuntime } from './usePluginRuntime'
import { usePluginList } from './usePluginList'
import { usePluginActions } from './usePluginActions'
import { pluginAvailability } from './runtimeState'
import type { PluginRuntimeInfo } from '../../../api/link/pluginRuntime'
import { useDiagnosticsAccess } from '../diagnostics/useDiagnosticsAccess'
import PluginCard from './PluginCard.vue'
import SaveModal from './Save.vue'

defineOptions({ name: 'PluginContent' })
const { t } = useI18n(), route = useRoute()
const router = useRouter(), diagnostics = useDiagnosticsAccess()
const permissionKey = usePluginPermission()
const list = usePluginList()
const { viewport, scroll } = list
const { visible, editData, add, save, actions } = usePluginActions(() => list.refresh())
const visibleIds = ref(new Set<string>())
const inspectionId = ref<string>()
function inspect(id: string, open: boolean) {
  if (open) inspectionId.value = id
  else if (inspectionId.value === id) inspectionId.value = undefined
}
function setVisible(id: string, value: boolean) {
  const next = new Set(visibleIds.value)
  if (value) next.add(id); else next.delete(id)
  visibleIds.value = next
  if (!value) inspect(id, false)
}
const demand = computed(() => {
  if (!list.enabled.value) return []
  return list.items.value.filter(driver => visibleIds.value.has(driver.id))
})
const runtime = usePluginRuntime(() => demand.value)
const inspection = usePluginRuntime(() => demand.value.filter(driver => driver.id === inspectionId.value), true)
const inspectionView = computed(() => ({
  nodes: runtime.rows.value.filter(node => node.driverId === inspectionId.value),
  instances: inspection.rows.value,
  nodeError: runtime.error.value,
  instanceError: inspection.error.value,
  pending: inspection.pending.value,
  limitReached: inspection.limitReached.value,
  busy: inspection.busy.value,
}))
function refreshInspection() { runtime.refresh(); inspection.refresh() }
async function retryNode(node: PluginRuntimeInfo) { await inspection.retry(node.driverId, node); runtime.refresh() }
function openLogs(serverId: string) {
  inspectionId.value = undefined
  void router.push({ path: '/infrastructure/runtime-monitor', query: { view: 'cluster', nodeId: serverId, tool: 'logs' } })
}
const statusFor = (id: string) => runtime.status.value[id] || pluginAvailability([])
const filterFields = [
  { title: t('plugin.index.293829-1'), dataIndex: 'id', search: { type: 'string' } },
  { title: t('plugin.index.293829-3'), dataIndex: 'name', search: { type: 'string' } },
  { title: t('plugin.index.293829-2'), dataIndex: 'type', search: { type: 'select', options: async () => {
    const response = await getTypes()
    return response.result?.map((item: { text: string; id: string }) => ({ ...item, label: item.text })) || []
  } } },
  { title: t('plugin.index.293829-6'), dataIndex: 'description', search: { type: 'string' } },
]
const parentTable = inject<{ initTableRef?: (table: { reload: () => void }) => void }>('tableRef', {})
onMounted(() => { list.refresh(); parentTable.initTableRef?.({ reload: () => list.refresh() }); if (route.query.save) add() })
</script>
<style scoped>
.plugin-list { display:flex; flex-direction:column; gap:var(--space-3); min-height:0; min-width:0; overflow:hidden; }
.plugin-list__toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-3); min-height:32px; }
.plugin-list__context { display:flex; align-items:center; gap:var(--space-3); }
.plugin-list__filter { flex:1; min-width:min(240px,100%); }
.plugin-list__actions { flex:none; }
.plugin-list__count { margin-inline-start:auto; color:var(--ink-3); font-size:var(--fs-12,12px); white-space:nowrap; }
.plugin-list__body { flex:1; min-height:0; min-width:0; display:flex; flex-direction:column; }
.plugin-list__scroll { flex:1; min-height:0; scrollbar-gutter:stable; }
.plugin-list__row { display:grid; gap:var(--space-4); padding-bottom:var(--space-4); }
.plugin-list__skeleton { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr)); gap:var(--space-4); }
.plugin-list__placeholder { --panel-radius:var(--r-2,6px); height:calc(var(--plugin-card-row-height) - 16px); border-color:var(--line); }
.plugin-list__tail { display:flex; align-items:center; justify-content:center; gap:var(--space-2); min-height:32px; color:var(--ink-3); font-size:var(--fs-12,12px); }
</style>
