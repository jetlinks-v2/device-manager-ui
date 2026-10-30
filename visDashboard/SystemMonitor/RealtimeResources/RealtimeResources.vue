<template>
  <MonitorCard class="realtime-resource" data-monitor-widget="RealtimeResources" :title="t('components.RealtimeResource.title')" :state="view" @retry="view.refresh">
    <template #controls>
      <span v-if="!view.loading && !view.error" class="realtime-resource__count">{{ t('components.RealtimeResource.nodeCount', [view.rows.length]) }}</span>
      <div class="realtime-resource__actions">
        <span v-if="view.updatedAt" class="realtime-resource__updated">{{ t('components.RealtimeResource.updatedAt', [view.updatedAt]) }}</span>
        <a-tag v-if="!isEdit && !view.loading && !view.error" color="processing">{{ t('components.RealtimeResource.liveInterval') }}</a-tag>
        <a-tooltip :title="t('components.MonitorRefresh.button')">
          <a-button type="text" :loading="view.loading" :disabled="isEdit" :aria-label="t('components.MonitorRefresh.button')" @click="view.refresh">
            <template #icon><AIcon type="ReloadOutlined" /></template>
          </a-button>
        </a-tooltip>
      </div>
    </template>
    <div class="realtime-resource__table-wrap">
      <table class="realtime-resource__table">
        <colgroup><col class="realtime-resource__identity-col" /><col v-for="column in view.columns" :key="column.key" :class="`realtime-resource__${column.kind}-col`" /><col class="realtime-resource__action-col" /></colgroup>
        <thead>
          <tr>
            <th scope="col" :aria-sort="sortDirection('nodeId')">
              <button type="button" :class="{ 'is-sorted': view.sortKey === 'nodeId' }" @click="view.changeSort('nodeId')">
                {{ t('components.RealtimeResource.serviceNode') }}
                <AIcon v-if="view.sortKey === 'nodeId'" aria-hidden="true" class="realtime-resource__sort is-active"
                  :type="view.sortOrder === 'asc' ? 'CaretUpOutlined' : 'CaretDownOutlined'" />
              </button>
            </th>
            <th v-for="column in view.columns" :key="column.key" scope="col" :aria-sort="sortDirection(column.key)">
              <button type="button" :class="{ 'is-sorted': view.sortKey === column.key }" @click="view.changeSort(column.key)">
                {{ column.label }}
                <AIcon aria-hidden="true" class="realtime-resource__sort" :class="{ 'is-active': view.sortKey === column.key }"
                  :type="view.sortKey === column.key ? view.sortOrder === 'asc' ? 'CaretUpOutlined' : 'CaretDownOutlined' : 'SwapOutlined'" />
              </button>
            </th>
            <th scope="col"><span class="realtime-resource__sr-only">{{ t('components.RealtimeResource.details') }}</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="node in view.rows" :key="node.nodeId">
            <tr class="realtime-resource__row" :class="{ 'is-expanded': view.expandedNodeId === node.nodeId }" :data-node-id="node.nodeId">
              <td class="realtime-resource__identity">
                <button type="button" class="realtime-resource__node" :aria-label="node.nodeId"
                  :aria-expanded="view.expandedNodeId === node.nodeId" :aria-controls="detailId(node.nodeId)" @click="view.toggleDetails(node.nodeId)">
                  <j-ellipsis class="realtime-resource__node-name">{{ node.name }}</j-ellipsis>
                  <span v-if="node.port" class="realtime-resource__port">:{{ node.port }}</span>
                </button>
                <NodeHealthStatus :health="node.health" />
              </td>
              <td v-for="cell in node.cells" :key="cell.key" class="realtime-resource__metric" :data-metric="cell.key">
                <span class="realtime-resource__mobile-label">{{ cell.label }}</span>
                <ResourceUsage v-if="cell.kind === 'usage'" :percent="cell.value" :detail="cell.capacity" />
                <span v-else class="realtime-resource__value" :class="{ 'is-unavailable': cell.value === undefined }">{{ cell.text }}</span>
              </td>
              <td class="realtime-resource__action">
                <a-button type="link" size="small" :aria-label="t(view.expandedNodeId === node.nodeId ? 'components.RealtimeResource.collapseNode' : 'components.RealtimeResource.expandNode', [node.nodeId])"
                  :aria-expanded="view.expandedNodeId === node.nodeId" :aria-controls="detailId(node.nodeId)" @click="view.toggleDetails(node.nodeId)">
                  {{ t(view.expandedNodeId === node.nodeId ? 'components.RealtimeResource.hideDetails' : 'components.RealtimeResource.details') }}
                </a-button>
              </td>
            </tr>
            <tr v-if="view.expandedNodeId === node.nodeId" :id="detailId(node.nodeId)" class="realtime-resource__detail-row">
              <td :colspan="view.columns.length + 2"><RealtimeResourceDetails :groups="view.detailGroups(node)" /></td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="!view.loading && !view.error && !view.empty" class="realtime-resource__note">{{ t('components.RealtimeResource.capacityNote') }}</div>
  </MonitorCard>
</template>
<script setup lang="ts">
import { getCurrentInstance, toRef, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardWidget } from '@jetlinks-web-core/components/DashBoardCanvas'
import MonitorCard from '../components/MonitorCard.vue'
import ResourceUsage from '../components/ResourceUsage.vue'
import NodeHealthStatus from '../components/NodeHealthStatus.vue'
import RealtimeResourceDetails from './RealtimeResourceDetails.vue'
import { useRealtimeResources } from '../hooks/useRealtimeResources'
import type { RealtimeSortKey } from '../utils/realtimeResourceData'
const props = defineProps({ info: { type: Object as PropType<DashboardWidget>, default: undefined }, isEdit: { type: Boolean, default: false } })
const { t } = useI18n()
const view = useRealtimeResources(toRef(props, 'isEdit'))
const instanceId = getCurrentInstance()!.uid
const detailId = (nodeId: string) => `realtime-${instanceId}-${encodeURIComponent(nodeId)}`
const sortDirection = (key: RealtimeSortKey) => view.sortKey !== key ? 'none' : view.sortOrder === 'asc' ? 'ascending' : 'descending'
</script>
<style scoped lang="less" src="./realtimeResources.less"></style>
