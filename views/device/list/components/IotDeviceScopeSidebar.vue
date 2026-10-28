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
    <a-input
      v-model:value="searchKeyword"
      allow-clear
      :placeholder="searchPlaceholder"
      :aria-label="searchPlaceholder"
    >
      <template #prefix><AIcon type="SearchOutlined" aria-hidden="true" /></template>
    </a-input>
    <div class="iot-device-scope__body">
      <div class="iot-device-scope__scroll">
        <a-tree
          v-if="filteredTreeData.length"
          :key="treeKey"
          block-node
          :show-line="{ showLeafIcon: false }"
          :tree-data="filteredTreeData"
          :selected-keys="selectedKeys"
          :default-expand-all="expandAll"
          @select="onSelect"
        >
          <template #leafIcon="{ dataRef }">
            <span v-if="dataRef.isScope" class="iot-device-scope__scope-dot" aria-hidden="true" />
            <AIcon v-else class="ant-tree-switcher-line-icon" type="FileOutlined" aria-hidden="true" />
          </template>
          <template #title="node">
            <IotTreeNodeRow
              :count="countValue(node.count)"
              :count-tooltip="$t('IotDeviceList.scope.deviceCountTip', { count: countValue(node.count) })"
              :show-action="Boolean(node.group && showGroupActions !== false)"
              :reserve-action-space="scopeType === 'group' && showGroupActions !== false"
              :action-aria-label="$t('IotDeviceList.scope.groupActions', { name: node.group?.name })"
            >
              <template #icon>
                <AIcon :type="node.icon" />
              </template>
              <template #label>{{ node.title }}</template>
              <template #action>
                <template v-if="node.group && showGroupActions !== false">
                  <a-menu-item @click="$emit('create-group')">
                    <AIcon type="PlusOutlined" aria-hidden="true" />
                    {{ $t('IotDeviceList.scope.createGroup') }}
                  </a-menu-item>
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
                </template>
              </template>
            </IotTreeNodeRow>
          </template>
        </a-tree>
        <CloudEmpty v-else :description="$t('IotDeviceList.scope.noMatches')" />
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
import IotTreeNodeRow from '@device-manager-ui/components/IotTreeNodeRow.vue'
import { useIotDeviceScopeSidebar } from '../hooks/useIotDeviceScopeSidebar'

interface IotDeviceScopeSidebarProps {
  // 仅消费范围筛选的页面可关闭管理入口；设备页默认保留分组操作。
  showGroupActions?: boolean
  // 未装配空间服务时隐藏区域范围，避免生成依赖 space-bind term 的查询。
  showArea?: boolean
  activeType: 'area' | 'group'
  activeId: string
  areas: { id: string; name: string; parentId?: string }[]
  groups: DeviceGroup[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
}

const props = withDefaults(defineProps<IotDeviceScopeSidebarProps>(), {
  showGroupActions: true,
  showArea: true,
})
const emit = defineEmits<{
  (event: 'change', value: { type: 'area' | 'group'; id: string }): void
  (event: 'create-group'): void
  (event: 'create-child-group', group: DeviceGroup): void
  (event: 'edit-group', group: DeviceGroup): void
  (event: 'delete-group', group: DeviceGroup): void
}>()
const { scopeType, scopeOptions, searchKeyword, searchPlaceholder, filteredTreeData, treeKey, expandAll, selectedKeys, onSelect, countValue } =
  useIotDeviceScopeSidebar(props, (scope) => emit('change', scope))
</script>

<style scoped>
.iot-device-scope {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.iot-device-scope__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-height: 0;
}

.iot-device-scope__scroll {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.iot-device-scope__scroll:has(> .cloud-empty) {
  display: flex;
  align-items: safe center;
}

.iot-device-scope__scope-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  vertical-align: middle;
  background: #DDE4ED;
  border-radius: 50%;
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
