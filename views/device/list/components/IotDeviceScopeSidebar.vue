<template>
  <SplitterPane class="iot-device-scope" :scroll="false" :padding="0" :aria-label="$t('IotDeviceList.scope.aria')" :aria-busy="loading || countsLoading || undefined">
    <template #header>
    <a-segmented v-model:value="scopeType" block class="iot-device-scope__tabs" :options="scopeOptions">
      <template #label="{ payload }">
        <span class="iot-device-scope__tab">
          <AIcon :type="payload.icon" />
          <AutoFitText :text="payload.title" />
        </span>
      </template>
    </a-segmented>
    <slot name="header-action" />
    </template>
    <div class="iot-device-scope__body">
      <nav class="iot-device-scope__shortcuts" :aria-label="$t('IotDeviceList.scope.aria')">
        <a-button v-for="item in quickScopes" :key="item.key" type="text" block class="iot-device-scope__shortcut" :class="{ 'is-selected': activeId === item.key }" :aria-pressed="activeId === item.key" @click="chooseScope(item.key)">
          <IotTreeNodeRow :count="countValue(item.count)" :count-loading="countsLoading" :count-error="countsError">
            <template #icon><AIcon :type="item.icon" /></template>
            <template #label><AutoFitText :text="item.title" /></template>
          </IotTreeNodeRow>
        </a-button>
      </nav>
        <a-skeleton v-if="loading && !hasData" class="iot-device-scope__skeleton" active :title="false" :paragraph="{ rows: 6 }" />
        <a-result v-else-if="loadError && !hasData" status="error" :title="$t('UnifiedDeviceList.loadFailed')"><template #extra><a-button @click="$emit('retry')">{{ $t('UnifiedDeviceList.retry') }}</a-button></template></a-result>
        <NavigationTree
          v-else-if="hasData"
          class="iot-device-scope__tree"
          :key="scopeType"
          searchable
          :tree-data="treeData"
          :aria-label="$t('IotDeviceList.scope.aria')"
          :search-node-key="rootId"
          :search-label="searchPlaceholder"
          :search-placeholder="searchPlaceholder"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          :draggable="canDragGroups"
          :node-draggable="canDragGroupNode"
          :allow-drop="allowGroupDrop"
          @update:expanded-keys="onExpand"
          @select="onSelect"
          @drop="handleGroupDrop"
        >
          <template #node-meta="node">
            <span class="iot-device-scope__meta" :class="{ 'iot-device-scope__meta--actionable': node.group && canManageGroups }">
              <span class="iot-device-scope__count"><SkeletonText v-if="countsLoading" :width="24" /><AIcon v-else-if="countsError" type="ExclamationCircleOutlined" /><template v-else><span v-if="node.isRoot || countValue(node.count) > 0" aria-hidden="true">{{ $t('IotDeviceList.scope.deviceCountShort', { count: countValue(node.count) }) }}</span><span class="iot-device-scope__count-label">{{ $t('IotDeviceList.scope.deviceCountTip', { count: countValue(node.count) }) }}</span></template></span>
              <a-dropdown v-if="node.group && canManageGroups" :trigger="['click']">
                <a-button type="text" size="small" class="iot-device-scope__action" :disabled="actionBusy" :aria-label="$t('IotDeviceList.scope.groupActions', { name: node.group.name })" @click.stop><AIcon type="EllipsisOutlined" aria-hidden="true" /></a-button>
                <template #overlay><IotDeviceGroupNodeMenu :group="node.group" :disabled="actionBusy" @action="action => handleGroupAction(action, node.group)" /></template>
              </a-dropdown>
            </span>
          </template>
          <template v-if="scopeType === 'group' && canManageGroups" #node-menu="node"><IotDeviceGroupNodeMenu :group="node.group" :disabled="actionBusy" @action="action => handleGroupAction(action, node.group)" /></template>
          <template v-if="scopeType === 'group' && canManageGroups" #root-menu><IotDeviceGroupNodeMenu :disabled="actionBusy" @action="handleGroupAction" /></template>
          <template #empty><CloudEmpty :description="$t('IotDeviceList.scope.noMatches')" /></template>
        </NavigationTree>
      <div v-else-if="!loading && !loadError" class="iot-device-scope__empty">
        <CloudEmpty :description="$t(scopeType === 'area' ? 'IotDeviceList.scope.emptyAreas' : 'IotDeviceList.scope.emptyGroups')" :image-style="{ height: '60px' }">
          <template v-if="scopeType === 'area' && areaManagementCode">
            <p class="iot-device-scope__empty-hint">{{ $t('IotDeviceList.scope.areaManagementHint') }}</p>
            <a-button type="link" @click="openAreaManagement">{{ $t('IotDeviceList.scope.goAreaManagement') }}<AIcon type="ArrowRightOutlined" aria-hidden="true" /></a-button>
          </template>
          <template v-else-if="scopeType === 'group' && canManageGroups">
            <p class="iot-device-scope__empty-hint">{{ $t('IotDeviceList.scope.groupCreateHint') }}</p>
            <a-button type="link" :disabled="actionBusy" @click="$emit('create-group')">{{ $t('IotDeviceList.scope.createRootGroup') }}</a-button>
          </template>
        </CloudEmpty>
      </div>
    </div>
    <template v-if="hasData && scopeType === 'group' && canManageGroups" #footer>
      <a-button class="iot-device-scope__create-group" :disabled="actionBusy" block @click="$emit('create-group')">
        <template #icon><AIcon type="PlusOutlined" /></template>
        <AutoFitText :text="$t('IotDeviceList.scope.createRootGroup')" />
      </a-button>
    </template>
  </SplitterPane>
</template>

<script setup lang="ts">
import SkeletonText from '@jetlinks-web-core/components/SkeletonText'
import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useRoute } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import type { DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { AutoFitText, NavigationTree, SplitterPane } from '@jetlinks-web-core/components'
import IotTreeNodeRow from '@device-manager-ui/components/IotTreeNodeRow.vue'
import IotDeviceGroupNodeMenu from './IotDeviceGroupNodeMenu.vue'
import { resolveGroupDrop, type GroupMoveIntent, type GroupTreeAction } from '../hooks/iotDeviceGroupTreeInteractions'
import { useIotDeviceScopeSidebar } from '../hooks/useIotDeviceScopeSidebar'
import { getIotDeviceListMenuCode } from '../hooks/useIotDeviceRouting'

interface IotDeviceScopeSidebarProps {
  // 仅消费范围筛选的页面可关闭管理入口；设备页默认保留分组操作。
  showGroupActions?: boolean
  // 未装配空间服务时隐藏区域范围，避免生成依赖 space-bind term 的查询。
  showArea?: boolean
  loading?: boolean
  countsLoading?: boolean
  countsError?: boolean
  loadError?: boolean
  actionBusy?: boolean
  activeType: 'area' | 'group'
  activeId: string
  areas: { id: string; name: string; parentId?: string }[]
  groups: DeviceGroup[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
  unboundAreaDeviceCount: number
  unassignedGroupDeviceCount: number
  boundAreaDeviceCount?: number
  assignedGroupDeviceCount?: number
}

const props = withDefaults(defineProps<IotDeviceScopeSidebarProps>(), {
  showGroupActions: true,
  showArea: true,
})
const emit = defineEmits<{
  (event: 'retry'): void
  (event: 'change', value: { type: 'area' | 'group'; id: string }): void
  (event: 'create-group'): void
  (event: 'create-child-group', group: DeviceGroup): void
  (event: 'edit-group', group: DeviceGroup): void
  (event: 'delete-group', group: DeviceGroup): void
  (event: 'move-group', intent: GroupMoveIntent): void
}>()
const { scopeType, scopeOptions, searchPlaceholder, rootId, hasData, quickScopes, treeData, expandedKeys, onExpand, selectedKeys, chooseScope, onSelect, countValue } =
  useIotDeviceScopeSidebar(props, (scope) => emit('change', scope))
const route = useRoute()
const menu = useMenuStore()
const auth = useAuthStore()
const canManageGroups = computed(() => props.showGroupActions !== false && auth.hasPermission(`${getIotDeviceListMenuCode(route)}:update`))
const canDragGroups = computed(() => scopeType.value === 'group' && canManageGroups.value && !props.actionBusy)
const canDragGroupNode = (node: NonNullable<TreeProps['treeData']>[number]) => Boolean(node.group)
const allowGroupDrop: NonNullable<TreeProps['allowDrop']> = ({ dragNode, dropNode, dropPosition }) => canDragGroups.value && Boolean(resolveGroupDrop(props.groups, String(dragNode.key), dropNode.isRoot ? undefined : String(dropNode.key), dropPosition, Boolean(dropNode.expanded)))
const handleGroupDrop: NonNullable<TreeProps['onDrop']> = (info) => {
  if (!canDragGroups.value || !info.node.pos) return
  const position = info.dropPosition - Number(info.node.pos.split('-').at(-1))
  const intent = resolveGroupDrop(props.groups, String(info.dragNode.key), info.node.isRoot ? undefined : String(info.node.key), position, Boolean(info.node.expanded))
  if (intent) emit('move-group', intent)
}
function handleGroupAction(action: GroupTreeAction, group?: DeviceGroup) {
  if (props.actionBusy) return
  if (action === 'create-root') emit('create-group')
  else if (group && action === 'create-child') emit('create-child-group', group)
  else if (group && action === 'edit') emit('edit-group', group)
  else if (group && action === 'delete') emit('delete-group', group)
}
const areaManagementCode = computed(() => {
  const codes = route.params.projectId
    ? ['project/space/AreaManagement', 'space/AreaManagement']
    : ['space/AreaManagement', 'project/space/AreaManagement']
  return codes.find(code => menu.hasMenu(code) && auth.hasPermission(`${code}:view`))
})
function openAreaManagement() { if (areaManagementCode.value) void menu.jumpPage(areaManagementCode.value) }
</script>

<style scoped>
.iot-device-scope {
  --iot-device-scope-row-height: 32px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.iot-device-scope__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 0;
  flex: 1;
  padding-bottom: var(--space-4);
}

.iot-device-scope__tabs { flex:1; min-width:0; }

.iot-device-scope__shortcuts {
  display: grid;
  width: 100%;
  gap: 2px;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.iot-device-scope__shortcut {
  display: block;
  height: var(--iot-device-scope-row-height);
  padding-inline: var(--space-2);
  text-align: start;
}

.iot-device-scope__shortcut.is-selected {
  color: var(--primary-color);
  background: var(--jet-theme-color-primary-bg, var(--info-bg));
}

.iot-device-scope__shortcut :deep(.iot-tree-node-row) { width: 100%; }
.iot-device-scope__shortcut:not(.is-selected) :deep(.iot-tree-node-row__icon) { color: var(--jet-theme-text-secondary); }

.iot-device-scope__tree, .iot-device-scope__empty { margin-inline: var(--space-4); }
.iot-device-scope__empty { display: flex; flex: 1; min-height: 0; align-items: center; }
.iot-device-scope__empty-hint { margin: var(--space-2) 0; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.iot-device-scope__meta { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; height: 1.5rem; }
.iot-device-scope__count { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 1.25rem; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); line-height: 1; font-variant-numeric: tabular-nums; }
.iot-device-scope__skeleton { padding:16px; }
.iot-device-scope__count-label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.iot-device-scope__action { position: absolute; inset: 0; display: inline-flex; align-items: center; justify-content: center; width: 100%; min-width: 0; height: 100%; padding: 0; opacity: 0; }
.iot-device-scope__action.ant-btn-text,
.iot-device-scope__action.ant-btn-text:hover,
.iot-device-scope__action.ant-btn-text:active { background: transparent; border-color: transparent; box-shadow: none; color: var(--jet-theme-text-secondary); }
.iot-device-scope__action.ant-btn-text:focus-visible { color: var(--primary-color); }
.iot-device-scope :deep(.navigation-tree__row:hover) .iot-device-scope__action,
.iot-device-scope__meta:focus-within .iot-device-scope__action,
.iot-device-scope__action.ant-dropdown-open { opacity: 1; }
.iot-device-scope :deep(.navigation-tree__row:hover) .iot-device-scope__meta--actionable .iot-device-scope__count,
.iot-device-scope__meta--actionable:focus-within .iot-device-scope__count,
.iot-device-scope__meta--actionable:has(.ant-dropdown-open) .iot-device-scope__count { opacity: 0; }

@media (pointer: coarse) {
  .iot-device-scope { --iot-device-scope-row-height: 44px; }
}

.iot-device-scope__create-group {
  display: flex;
  align-items: center;
  margin-top: 0;
  margin-inline: 0;
  width: 100%;
}

.iot-device-scope__tab {
	display: flex;
	min-width: 0;
	max-width: 100%;
	align-items: center;
	justify-content: center;
	gap: var(--space-1);
}

.iot-device-scope__tab :deep(.anticon) {
	font-size: var(--fs-14);
	flex-shrink: 0;
}
</style>
