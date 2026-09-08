<template>
  <ContentPanel class="iot-device-scope" :aria-label="$t('IotDeviceList.scope.aria')">
    <a-segmented v-model:value="scopeType" block :options="scopeOptions" />
    <div class="iot-device-scope__body">
      <template v-if="scopeType === 'area'">
        <button class="iot-device-scope__all" :class="{ 'is-active': !scopeId }" type="button" @click="select('')">
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.allAreas') }}</span>
          <em class="iot-device-scope__count">{{ countText(totalDeviceCount) }}</em>
        </button>
        <div class="iot-device-scope__scroll">
          <a-tree
            v-if="areaTree.length"
            block-node
            :tree-data="areaTree"
            :selected-keys="scopeId ? [scopeId] : []"
            :default-expand-all="true"
            @select="onAreaSelect"
          >
            <template #title="node">
              <span class="iot-device-scope__area-node">
                <span class="iot-device-scope__label">{{ node.title }}</span>
                <em class="iot-device-scope__count">{{ countText(areaDeviceCounts[String(node.key)]) }}</em>
              </span>
            </template>
          </a-tree>
          <CloudEmpty v-else :description="$t('IotDeviceList.scope.emptyAreas')" />
        </div>
        <button
          class="iot-device-scope__unbound"
          :class="{ 'is-active': scopeId === IOT_UNBOUND_AREA_SCOPE_ID }"
          type="button"
          @click="select(IOT_UNBOUND_AREA_SCOPE_ID)"
        >
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.unboundArea') }}</span>
          <em class="iot-device-scope__count">{{ countText(unboundAreaDeviceCount) }}</em>
        </button>
      </template>
      <template v-else>
        <button class="iot-device-scope__all" :class="{ 'is-active': !scopeId }" type="button" @click="select('')">
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.allGroups') }}</span>
          <em class="iot-device-scope__count">{{ countText(totalDeviceCount) }}</em>
        </button>
        <div class="iot-device-scope__scroll">
          <a-tree
            v-if="groupTree.length"
            block-node
            :tree-data="groupTree"
            :selected-keys="scopeId ? [scopeId] : []"
            :default-expand-all="true"
            @select="onGroupSelect"
          >
            <template #title="node">
              <span class="iot-device-scope__group-node">
                <span class="iot-device-scope__label">{{ node.title }}</span>
                <em class="iot-device-scope__count">{{ countText(groupDeviceCounts[node.group.id]) }}</em>
                <a-dropdown :trigger="['click']">
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
          <CloudEmpty v-else :description="$t('IotDeviceList.scope.emptyGroups')" />
        </div>
        <button
          class="iot-device-scope__unbound"
          :class="{ 'is-active': scopeId === IOT_UNASSIGNED_GROUP_SCOPE_ID }"
          type="button"
          @click="select(IOT_UNASSIGNED_GROUP_SCOPE_ID)"
        >
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.unassignedGroup') }}</span>
          <em class="iot-device-scope__count">{{ countText(unassignedGroupDeviceCount) }}</em>
        </button>
        <a-button class="iot-device-scope__create-group" type="dashed" block @click="$emit('create-group')">
          <template #icon><AIcon type="PlusOutlined" /></template>
          {{ $t('IotDeviceList.scope.createGroup') }}
        </a-button>
      </template>
    </div>
  </ContentPanel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { buildDeviceGroupTreeData, type DeviceGroupTreeNode } from '../hooks/iotDeviceGroupTreeOptions'
import {
  IOT_UNASSIGNED_GROUP_SCOPE_ID,
  IOT_UNBOUND_AREA_SCOPE_ID,
} from '../hooks/useIotDeviceAssetFilters'

type Area = { id: string; name: string; parentId?: string }
type Group = DeviceGroup

const props = defineProps<{
  activeType: 'area' | 'group'
  activeId: string
  areas: Area[]
  groups: Group[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
}>()
const emit = defineEmits<{
  (event: 'change', value: { type: 'area' | 'group'; id: string }): void
  (event: 'create-group'): void
  (event: 'create-child-group', group: Group): void
  (event: 'edit-group', group: Group): void
  (event: 'delete-group', group: Group): void
}>()
const { t: $t } = useI18n()

const scopeType = computed({
  get: () => props.activeType,
  set: (type: 'area' | 'group') => emit('change', { type, id: '' }),
})
const scopeId = computed(() => props.activeId)
const scopeOptions = computed(() => [
  { label: $t('IotDeviceList.scope.area'), value: 'area' },
  { label: $t('IotDeviceList.scope.group'), value: 'group' },
])
const areaTree = computed(() => {
  const byParent = new Map<string, Area[]>()
  props.areas.forEach((area) => {
    const parentId = area.parentId || ''
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), area])
  })
  const toNode = (area: Area): Record<string, unknown> => ({
    key: area.id,
    title: area.name,
    children: (byParent.get(area.id) ?? []).map(toNode),
  })
  return (byParent.get('') ?? []).map(toNode)
})
const groupTree = computed<DeviceGroupTreeNode[]>(() => buildDeviceGroupTreeData(props.groups))

function select(id: string) {
  emit('change', { type: scopeType.value, id })
}

function countText(value?: number) {
  return $t('IotDeviceList.scope.deviceCount', { count: Math.max(0, Number(value) || 0) })
}

const onAreaSelect: TreeProps['onSelect'] = (keys) => select(String(keys[0] || ''))
const onGroupSelect: TreeProps['onSelect'] = (keys) => select(String(keys[0] || ''))
</script>

<style scoped>
.iot-device-scope {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  min-height: 0;
  height: 100%;
}

.iot-device-scope__body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: var(--space-2);
  min-height: 0;
}

.iot-device-scope__scroll {
  min-height: 0;
  overflow: auto;
}

.iot-device-scope__all,
.iot-device-scope__unbound {
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

.iot-device-scope__unbound {
  border: 1px solid var(--jet-theme-border, var(--ant-color-border));
  border-radius: var(--r-3);
}

.iot-device-scope__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iot-device-scope__count {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.iot-device-scope__area-node,
.iot-device-scope__group-node {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--space-2);
  align-items: center;
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

.iot-device-scope__all.is-active,
.iot-device-scope__unbound.is-active {
  color: var(--jet-theme-primary);
  font-weight: 600;
}

.iot-device-scope__all:not(.is-active):hover,
.iot-device-scope__unbound:not(.is-active):hover {
  background: var(--ant-table-row-hover-bg, rgba(0, 0, 0, 0.02));
  color: var(--jet-theme-text);
}

.iot-device-scope__create-group {
  margin-top: var(--space-1);
}
</style>
