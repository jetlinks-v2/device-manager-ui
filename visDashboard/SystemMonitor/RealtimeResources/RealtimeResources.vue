<template>
  <MonitorCard data-monitor-widget="RealtimeResources" :title="$t('components.RealtimeResource.title')" :state="view" @retry="view.refresh">
    <template #controls>
      <span class="realtime-resource__updated">{{ $t('components.RealtimeResource.updatedAt', [view.updatedAt || '--']) }}</span>
      <div class="realtime-resource__actions">
        <a-tag v-if="!isEdit && !view.loading && !view.error" color="processing">{{ $t('components.RealtimeResource.live') }}</a-tag>
        <a-tooltip :title="$t('components.MonitorRefresh.button')">
          <a-button type="text" :loading="view.loading" :disabled="isEdit" :aria-label="$t('components.MonitorRefresh.button')" @click="view.refresh">
            <template #icon><AIcon type="ReloadOutlined" /></template>
          </a-button>
        </a-tooltip>
      </div>
    </template>
    <div class="realtime-resource__table-wrap">
      <table class="realtime-resource__table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key">
              <button type="button" @click="changeSort(column.key)">
                {{ column.label }}
                <AIcon v-if="sortKey === column.key" :type="sortOrder === 'asc' ? 'CaretUpOutlined' : 'CaretDownOutlined'" />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in sortedNodes" :key="node.nodeId">
            <td>
              <div class="realtime-resource__node-cell">
                <i class="realtime-resource__node-dot" :style="{ backgroundColor: nodeColor(node.nodeId) }" />
                <j-ellipsis class="realtime-resource__node">{{ node.nodeId }}</j-ellipsis>
              </div>
              <NodeHealthStatus :health="node.health" />
            </td>
            <td>
              <div class="realtime-resource__submetric">
                <span>{{ $t('components.RealtimeResource.cpuLabel') }}</span>
                <ResourceUsage :percent="node.cpuSystem">
                  <template #detail>
                    <a-tooltip :title="loadTooltip(node)">
                      <span :class="loadStatusClass(node)">
                        <i />
                        {{ loadSummary(node) }}
                      </span>
                    </a-tooltip>
                  </template>
                </ResourceUsage>
              </div>
              <div class="realtime-resource__submetric">
                <span>{{ $t('components.RealtimeResource.memorySystem') }}</span>
                <ResourceUsage :percent="node.memorySystem" :used="node.memorySystemUsed" :total="node.memorySystemTotal" />
              </div>
            </td>
            <td>
              <div class="realtime-resource__submetric">
                <span>{{ $t('components.RealtimeResource.cpuLabel') }}</span>
                <ResourceUsage :percent="node.cpuJvm" />
              </div>
              <div class="realtime-resource__submetric">
                <span>{{ $t('components.RealtimeResource.jvmMemoryShort') }}</span>
                <ResourceUsage
                  :percent="node.memoryJvm"
                  :detail="jvmMemoryDetail(node)"
                />
              </div>
            </td>
            <td>
              <ResourceUsage :percent="node.disk" :used="node.diskUsed" :total="node.diskTotal" />
              <RealtimeMetricGroup :items="diskItems(node)" inline fit />
            </td>
            <td>
              <RealtimeMetricGroup :items="networkTrafficItems(node)" inline />
              <RealtimeMetricGroup :items="networkConnectionItems(node)" compact />
              <RealtimeMetricGroup :items="networkQualityItems(node)" inline />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </MonitorCard>
</template>
<script setup lang="ts">
import { toRef, toRefs, type PropType } from 'vue'
import type { DashboardWidget } from '@jetlinks-web-core/components/DashBoardCanvas'
import MonitorCard from '../components/MonitorCard.vue'
import ResourceUsage from '../components/ResourceUsage.vue'
import RealtimeMetricGroup from '../components/RealtimeMetricGroup.vue'
import NodeHealthStatus from '../components/NodeHealthStatus.vue'
import { useRealtimeResources } from '../hooks/useRealtimeResources'
const props = defineProps({ info: { type: Object as PropType<DashboardWidget>, default: undefined }, isEdit: { type: Boolean, default: false } })
const view = useRealtimeResources(toRef(props, 'isEdit'))
const { columns, sortedNodes, sortKey, sortOrder, changeSort, nodeColor, loadTooltip, loadStatusClass,
  loadSummary, jvmMemoryDetail, diskItems, networkTrafficItems, networkConnectionItems, networkQualityItems } = toRefs(view)
</script>
<style scoped lang="less" src="./realtimeResources.less"></style>
