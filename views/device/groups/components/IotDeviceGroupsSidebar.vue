<template>
  <aside class="group-sidebar" :aria-label="$t('IotDeviceGroups.sidebar.aria')">
    <section class="group-sidebar__card">
      <div class="group-sidebar__switch">
        <a-segmented
          :value="activeView"
          block
          class="group-sidebar__segmented"
          :options="segmentedOptions"
          @change="handleViewChange"
        >
          <template #label="{ payload, value }">
            <span class="group-sidebar__segment-label" :class="{ 'is-active': activeView === value }">
              <AIcon :type="segmentIcon(payload)" aria-hidden="true" />
              <span>{{ segmentLabel(payload) }}</span>
            </span>
          </template>
        </a-segmented>
      </div>

      <div class="group-sidebar__search">
        <a-input-search
          class="group-sidebar__search-input"
          :placeholder="$t('IotDeviceGroups.sidebar.searchPlaceholder')"
          allow-clear
          @search="handleGroupSearch"
        />
        <a-button
          v-if="activeView === 'type'"
          class="group-sidebar__add"
          size="small"
          @click="$emit('create-type-group')"
        >
          <template #icon>
            <AIcon type="PlusOutlined" aria-hidden="true" />
          </template>
        </a-button>
      </div>

      <div class="group-sidebar__body">
        <div v-if="activeView === 'area'" class="group-tree">
          <a-tree
            v-if="areaTreeData.length"
            :tree-data="areaTreeData"
            :expanded-keys="areaExpandedKeys"
            :selected-keys="selectedKeys"
            block-node
            @expand="onAreaExpand"
            @select="onAreaSelect"
          >
            <template #switcherIcon="{ switcherCls }">
              <AIcon type="DownOutlined" :class="switcherCls" />
            </template>
            <template #title="node">
              <span
                class="group-tree-node"
                :class="{
                  'is-active': selectedGroupId === node.item.id,
                  'is-root': node.isRoot,
                  'is-unbound': node.isUnbound,
                }"
              >
                <span class="group-tree-node__name">{{ node.title }}</span>
                <em class="group-node-count">{{ node.item.summary.total }}</em>
              </span>
            </template>
          </a-tree>
        </div>

        <div v-else class="group-list">
          <div
            v-for="item in visibleListItems"
            :key="item.id"
            class="group-list__item"
            :class="{
              'is-active': selectedGroupId === item.id,
              'is-unassigned': isUnassignedTypeItem(item),
            }"
            role="button"
            tabindex="0"
            @click="selectTypeItem(item.id)"
            @keydown.enter.prevent="selectTypeItem(item.id)"
            @keydown.space.prevent="selectTypeItem(item.id)"
          >
            <strong class="group-list__name">{{ item.name }}</strong>
            <em class="group-node-count">{{ item.summary.total }}</em>
            <span class="group-list__actions">
              <a-button
                v-if="!item.isVirtual"
                class="group-list__action"
                type="text"
                :aria-label="$t('IotDeviceGroups.sidebar.editGroup')"
                @click.stop="$emit('edit-type-group', item)"
              >
                <AIcon type="EditOutlined" aria-hidden="true" />
              </a-button>
              <a-button
                v-if="!item.isVirtual"
                class="group-list__action"
                type="text"
                :aria-label="$t('IotDeviceGroups.sidebar.deleteGroup')"
                @click.stop="$emit('delete-type-group', item)"
              >
                <AIcon type="DeleteOutlined" aria-hidden="true" />
              </a-button>
            </span>
          </div>
        </div>

        <CloudEmpty v-if="!visibleItems.length" class="empty-state group-sidebar__empty" :description="$t('IotDeviceGroups.sidebar.empty')" />
      </div>

      <footer class="group-sidebar__foot">
        <span>{{ $t('IotDeviceGroups.sidebar.total', { count: currentViewCount }) }}</span>
        <span>{{ $t('IotDeviceGroups.sidebar.coverage', { count: visibleDeviceCount }) }}</span>
      </footer>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import type { EventDataNode } from 'ant-design-vue/es/tree'
import type { IotDeviceGroupView } from '@device-manager-ui/hooks/useIotDeviceGroupMeta'
import type { ProjectAreaType } from '@device-manager-ui/modules/defaults/types'

import type { AreaTreeNode, GroupItem } from './iotDeviceGroupsPage.types'

const props = defineProps<{
  activeView: IotDeviceGroupView
  areaExpandedKeys: string[]
  areaTreeData: AreaTreeNode[]
  currentViewCount: number
  groupKeyword: string
  groupViewOptions: ReadonlyArray<{ key: IotDeviceGroupView; label: string; icon: string }>
  selectedGroupId: string
  visibleDeviceCount: number
  visibleItems: GroupItem[]
  visibleListItems: GroupItem[]
  viewCount: (view: IotDeviceGroupView) => number
  areaIcon: (type: ProjectAreaType) => string
  riskLevelLabel: (level: GroupItem['riskLevel']) => string
  riskTone: (level: GroupItem['riskLevel']) => 'ok' | 'warn' | 'err'
}>()

const emit = defineEmits<{
  (event: 'create-type-group'): void
  (event: 'delete-type-group', value: GroupItem): void
  (event: 'edit-type-group', value: GroupItem): void
  (event: 'expand-area', value: string[]): void
  (event: 'switch-view', view: IotDeviceGroupView): void
  (event: 'update:groupKeyword', value: string): void
  (event: 'update:selectedGroupId', value: string): void
}>()

type GroupViewSegmentPayload = {
  icon: string
  label: string
}

const segmentedOptions = computed(() => props.groupViewOptions.map((option) => ({
  value: option.key,
  title: option.label,
  payload: {
    icon: option.icon,
    label: option.label,
  } satisfies GroupViewSegmentPayload,
})))

const selectedKeys = computed(() => (props.selectedGroupId ? [props.selectedGroupId] : []))

function isGroupView(value: unknown): value is IotDeviceGroupView {
  return value === 'area' || value === 'type'
}

function segmentIcon(payload: unknown) {
  if (payload && typeof payload === 'object' && 'icon' in payload && typeof payload.icon === 'string') {
    return payload.icon
  }
  return 'AppstoreOutlined'
}

function segmentLabel(payload: unknown) {
  if (payload && typeof payload === 'object' && 'label' in payload && typeof payload.label === 'string') {
    return payload.label
  }
  return ''
}

function handleViewChange(value: string | number) {
  if (isGroupView(value)) emit('switch-view', value)
}

function handleGroupSearch(value: string) {
  emit('update:groupKeyword', String(value || ''))
}

const onAreaExpand: TreeProps['onExpand'] = (keys) => {
  emit('expand-area', keys.map((key) => String(key)))
}

const onAreaSelect: TreeProps['onSelect'] = (_keys, info) => {
  const node = info.node as EventDataNode & AreaTreeNode
  const groupId = node?.item?.id || String(info.node?.key || '')
  if (groupId) emit('update:selectedGroupId', groupId)
}

function selectTypeItem(id: string) {
  emit('update:selectedGroupId', id)
}

function isUnassignedTypeItem(item: GroupItem) {
  return item.isVirtual || /未指派|未派/.test(item.name)
}

</script>
<style scoped src="./IotDeviceGroupsSidebar.css"></style>
