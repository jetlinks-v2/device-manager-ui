<template>
  <div class="metric-object-navigation">
    <a-input-search v-model:value="state.keyword.value" :placeholder="t('DeviceMetrics.searchObjects')" allow-clear @search="state.search" />
    <a-alert v-if="state.error.value" type="error" :message="t('DeviceMetrics.objectLoadError')">
      <template #action><a-button size="small" @click="state.retry">{{ t('DeviceMetrics.retry') }}</a-button></template>
    </a-alert>
    <a-spin :spinning="state.loading.value">
      <a-tree v-if="tree && state.visibleNodes.value.length" :tree-data="state.visibleNodes.value" :field-names="{ key: 'ownerId', title: 'label' }" :selected-keys="selectedId ? [selectedId] : []" block-node :show-line="{ showLeafIcon:false }" default-expand-all @select="selectTree">
        <template #title="node"><IotTreeNodeRow><template #icon><AIcon type="FolderOutlined" /></template><template #label>{{ node.label }}</template></IotTreeNodeRow></template>
      </a-tree>
      <ul v-else-if="!tree && state.nodes.value.length" class="metric-object-navigation__list">
        <li v-for="node in state.nodes.value" :key="node.ownerId">
          <button type="button" class="metric-object-navigation__object" :aria-pressed="selectedId === node.ownerId" :title="[node.label, node.productName, node.ownerId, stateLabel(node)].filter(Boolean).join('\n')" :disabled="state.loading.value || state.error.value" @click="state.select(node.ownerId)">
            <a-avatar shape="square" :size="30" :src="node.photoUrl"><template #icon><AIcon type="DesktopOutlined" /></template></a-avatar>
            <span class="metric-object-navigation__copy"><span class="metric-object-navigation__name">{{ node.label }}</span><span class="metric-object-navigation__summary"><span class="metric-object-navigation__product">{{ duplicateLabels.has(node.label) ? node.ownerId : node.productName || node.ownerId }}</span><a-badge v-if="node.state" :status="stateValue(node) === 'online' ? 'success' : 'default'" :text="stateLabel(node)" /></span></span>
            <AIcon v-if="selectedId === node.ownerId" type="CheckOutlined" class="metric-object-navigation__check" />
          </button>
        </li>
      </ul>
      <a-empty v-else-if="!state.loading.value && !state.error.value" :description="t('DeviceMetrics.noObjects')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </a-spin>
    <a-pagination v-if="!tree && state.total.value > 20" size="small" :current="state.page.value" :total="state.total.value" :page-size="20" :show-size-changer="false" @change="state.changePage" />
  </div>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { MetricObjectSelection, MetricSelectionOrigin } from '@jetlinks-web-core/components'
import { useMetricNavigator, type MetricNavigationNode, type MetricNavigationQuery } from './useMetricNavigator'
import IotTreeNodeRow from '../../../../components/IotTreeNodeRow.vue'
const props = defineProps<{ selectedId?: string; tree?: boolean; query: MetricNavigationQuery }>()
const emit = defineEmits<{ select: [selection?: MetricObjectSelection, origin?: MetricSelectionOrigin] }>()
const { t } = useI18n()
const state = useMetricNavigator(props.query, toRef(props, 'selectedId'), (selection, origin) => emit('select', selection, origin), props.tree)
const duplicateLabels = computed(() => {
  const seen = new Set<string>(), duplicates = new Set<string>()
  for (const node of state.nodes.value) { if (seen.has(node.label)) duplicates.add(node.label); else seen.add(node.label) }
  return duplicates
})
const stateValue = (node: MetricNavigationNode) => typeof node.state === 'string' ? node.state : node.state?.value
const stateLabel = (node: MetricNavigationNode) => {
  if (typeof node.state === 'object' && node.state.text) return node.state.text
  const value = stateValue(node)
  return value && ['online','offline','notActive'].includes(value) ? t(`DeviceMetrics.${value}`) : value
}
function selectTree(keys: (string | number)[]) { if (keys.length) state.select(String(keys[0])) }
</script>
<style scoped>
.metric-object-navigation { display:flex; flex-direction:column; gap:12px; min-width:0; min-height:0; height:100%; }
.metric-object-navigation__list { list-style: none; margin: 0; padding: 0; }
.metric-object-navigation__object { position:relative; display:flex; align-items:center; gap:10px; width:100%; min-height:60px; margin-bottom:4px; text-align:left; border:0; background:transparent; padding:9px 8px; border-radius:6px; cursor:pointer; color:var(--ink-1); font:inherit; }
.metric-object-navigation__object :deep(.ant-avatar) { flex:none; background:var(--bg-hover); color:var(--ink-3) }
.metric-object-navigation__copy { min-width:0; flex:1; display:flex; flex-direction:column; gap:6px }
.metric-object-navigation__name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-inline-end:18px; font-size:13px; font-weight:500; line-height:17px }
.metric-object-navigation__summary { display:flex; align-items:center; gap:6px; font-size:11px; color:var(--ink-3); min-width:0; line-height:14px }
.metric-object-navigation__product { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.metric-object-navigation__summary :deep(.ant-badge) { flex:none }
.metric-object-navigation__summary :deep(.ant-badge-status-text) { font-size:10px; color:var(--ink-3); margin-inline-start:4px }
.metric-object-navigation__check { position:absolute; inset-inline-end:8px; top:12px; font-size:12px }
.metric-object-navigation__list button:hover, .metric-object-navigation__list button[aria-pressed="true"] { background: var(--ant-primary-color-deprecated-bg, #e6f7ff); }
.metric-object-navigation__list button[aria-pressed="true"] { color: var(--ant-primary-color, #1677ff); }
.metric-object-navigation > :deep(.ant-spin-nested-loading) { flex:1; min-height:0; overflow:auto; }
.metric-object-navigation :deep(.ant-spin-container) { min-height:0; }
</style>
