<template>
  <div class="iot-device-scope" :aria-label="$t('IotDeviceList.scope.aria')">
    <a-segmented v-model:value="scopeType" block class="iot-device-scope__tabs" :options="scopeOptions" />
    <div class="iot-device-scope__body">
      <button class="iot-device-scope__all" :class="{ 'is-active': !scopeId }" type="button" @click="select('')">
        <span class="iot-device-scope__label">{{ $t(scopeType === 'area' ? 'IotDeviceList.scope.allAreas' : 'IotDeviceList.scope.allGroups') }}</span>
        <em class="iot-device-scope__count">{{ countText(totalDeviceCount) }}</em>
      </button>
      <div class="iot-device-scope__scroll">
        <CloudEmpty v-if="!hasScopes" :description="$t(scopeType === 'area' ? 'IotDeviceList.scope.emptyAreas' : 'IotDeviceList.scope.emptyGroups')" />
        <a-tree
          :key="scopeType"
          block-node
          showLine
          :tree-data="treeData"
          :selected-keys="scopeId ? [scopeId] : []"
          :default-expand-all="scopeType === 'area'"
          @select="onSelect"
        >
          <template #title="node">
            <span class="iot-device-scope__group-node">
              <span>
                <AIcon :type="node.isLeaf ? 'icon-dizhi': 'icon-shebei2' " />
              </span>
              <span class="iot-device-scope__label">
                <j-ellipsis>
                  {{ node.title }}
                </j-ellipsis>
              </span>
              <em class="iot-device-scope__count">{{ countText(node.count) }}</em>
              <a-dropdown v-if="node.group && showGroupActions !== false" :trigger="['click']">
                <a-button
                  class="iot-device-scope__group-action"
                  type="text"
                  size="small"
                  :aria-label="$t('IotDeviceList.scope.groupActions', { name: node.group.name })"
                  @click.stop
                >
                  <AIcon type="EllipsisOutlined" aria-hidden="true" />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item @click="$emit('create-child-group', node.group)">
                      <AIcon type="PlusOutlined" aria-hidden="true" />
                      {{ $t('IotDeviceList.scope.createChildGroup') }}
                    </a-menu-item>
                    <a-menu-item @click="$emit('edit-group', node.group)">
                      <AIcon type="EditOutlined" aria-hidden="true" />
                      {{ $t('IotDeviceList.scope.editGroup') }}
                    </a-menu-item>
                    <a-menu-item danger @click="$emit('delete-group', node.group)">
                      <AIcon type="DeleteOutlined" aria-hidden="true" />
                      {{ $t('IotDeviceList.scope.deleteGroup') }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </span>
          </template>
        </a-tree>
      </div>
      <a-button v-if="scopeType === 'group' && showGroupActions !== false" class="iot-device-scope__create-group" type="dashed" block @click="$emit('create-group')">
        <template #icon><AIcon type="PlusOutlined" /></template>
        {{ $t('IotDeviceList.scope.createGroup') }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { useIotDeviceScopeSidebar } from '../hooks/useIotDeviceScopeSidebar'

interface IotDeviceScopeSidebarProps {
  // 仅消费范围筛选的页面可关闭管理入口；设备页默认保留分组操作。
  showGroupActions?: boolean
  activeType: Scope['type']
  activeId: string
  areas: Area[]
  groups: DeviceGroup[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
}


const props = withDefaults(defineProps<IotDeviceScopeSidebarProps>(), {
  showGroupActions: true,
})
const emit = defineEmits<{
  (event: 'change', value: { type: 'area' | 'group'; id: string }): void
  (event: 'create-group'): void
  (event: 'create-child-group', group: DeviceGroup): void
  (event: 'edit-group', group: DeviceGroup): void
  (event: 'delete-group', group: DeviceGroup): void
}>()
const { scopeType, scopeId, scopeOptions, hasScopes, treeData, select, onSelect, countText } =
  useIotDeviceScopeSidebar(props, (scope) => emit('change', scope))
</script>

<style scoped>
.iot-device-scope {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.iot-device-scope__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--space-2);
  min-height: 0;
}

.iot-device-scope__scroll {
  min-height: 0;
  overflow: auto;
}

.iot-device-scope__all {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  border: 0;
  background: transparent;
  padding: var(--space-2);
  color: var(--jet-theme-text-secondary);
  cursor: pointer;
  text-align: left;
}

.iot-device-scope__label {
  flex: 1;
  min-width: 0;
}

.iot-device-scope__count {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
  width: 2.125rem;
  text-align: right;
}

.iot-device-scope__group-node {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
}

.iot-device-scope__group-action {
  opacity: 0;
}

.iot-device-scope__group-node:hover .iot-device-scope__group-action,
.iot-device-scope__group-node:focus-within .iot-device-scope__group-action {
  opacity: 1;
}

.iot-device-scope :deep(.ant-tree-title) {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.iot-device-scope__all.is-active {
  color: var(--jet-theme-primary);
  font-weight: 600;
}

.iot-device-scope__all:not(.is-active):hover {
  background: var(--ant-table-row-hover-bg, rgba(0, 0, 0, 0.02));
  color: var(--jet-theme-text);
}

.iot-device-scope__create-group {
  margin-top: var(--space-1);
}
</style>
