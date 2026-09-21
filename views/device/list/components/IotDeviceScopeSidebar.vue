<template>
  <div class="iot-device-scope" :aria-label="$t('IotDeviceList.scope.aria')">
    <a-segmented v-model:value="scopeType" block class="iot-device-scope__tabs" :options="scopeOptions">
      <template #label="{ payload }">
        <span class="iot-device-scope__tab">
          <AIcon :type="payload.icon" />
          <span>{{ payload.title }}</span>
        </span>
      </template>
    </a-segmented>
    <div class="iot-device-scope__body">
      <div class="iot-device-scope__scroll">
        <a-tree
          :key="scopeType"
          block-node
          :show-line="{ showLeafIcon: true }"
          :tree-data="treeData"
          :selected-keys="selectedKeys"
          :default-expand-all="scopeType === 'area'"
          @select="onSelect"
        >
          <template #leafIcon="{ dataRef }">
            <span v-if="dataRef.isScope" class="iot-device-scope__scope-dot" aria-hidden="true" />
            <AIcon v-else class="ant-tree-switcher-line-icon" type="FileOutlined" aria-hidden="true" />
          </template>
          <template #title="node">
            <span class="iot-device-scope__tree-node">
              <span>
                <AIcon :type="node.icon" />
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
      <a-button v-if="scopeType === 'group' && showGroupActions !== false" class="iot-device-scope__create-group" block @click="$emit('create-group')">
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
const { scopeType, scopeOptions, treeData, selectedKeys, onSelect, countText } =
  useIotDeviceScopeSidebar(props, (scope) => emit('change', scope))
</script>

<style scoped>
.iot-device-scope {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.iot-device-scope__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--space-4);
  min-height: 0;
}

.iot-device-scope__scroll {
  min-height: 0;
  overflow: auto;
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

.iot-device-scope__scope-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  vertical-align: middle;
  background: #DDE4ED;
  border-radius: 50%;
}

.iot-device-scope__tree-node {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
}

.iot-device-scope__group-action {
  opacity: 0;
}

.iot-device-scope__tree-node:hover .iot-device-scope__group-action,
.iot-device-scope__tree-node:focus-within .iot-device-scope__group-action {
  opacity: 1;
}

.iot-device-scope :deep(.ant-tree-title) {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.iot-device-scope__create-group {
  margin-top: 0;
}
.iot-device-scope__tabs.ant-segmented {
	background: #F9FBFD;
	border: 1px solid var(--jet-theme-border-color-1);
	border-radius: var(--r-1);
	padding: 0;
}

.iot-device-scope__tabs :deep(.ant-segmented-item-selected) {
	box-shadow: none;
	color: var(--jet-theme-primary);
}

.iot-device-scope__tabs :deep(.ant-segmented-item-label) {
	min-height: 2rem;
	line-height: 2rem;
}

.iot-device-scope__tab {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: var(--space-1);
}

.iot-device-scope__tab :deep(.anticon) {
	font-size: var(--fs-14);
}
</style>
