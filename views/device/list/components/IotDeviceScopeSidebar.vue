<template>
  <aside class="iot-device-scope" :aria-label="$t('IotDeviceList.scope.aria')">
    <a-segmented v-model:value="scopeType" block :options="scopeOptions" />
    <div class="iot-device-scope__body">
      <template v-if="scopeType === 'area'">
        <button class="iot-device-scope__all" :class="{ 'is-active': !scopeId }" type="button" @click="select('')">
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.allAreas') }}</span>
          <em class="iot-device-scope__count">{{ countText(totalDeviceCount) }}</em>
        </button>
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
      </template>
      <template v-else>
        <button class="iot-device-scope__all" :class="{ 'is-active': !scopeId }" type="button" @click="select('')">
          <span class="iot-device-scope__label">{{ $t('IotDeviceList.scope.allGroups') }}</span>
          <em class="iot-device-scope__count">{{ countText(totalDeviceCount) }}</em>
        </button>
        <div v-if="groups.length" class="iot-device-scope__groups">
          <button
            v-for="group in groups"
            :key="group.id"
            type="button"
            :class="{ 'is-active': scopeId === group.id }"
            @click="select(group.id)"
          >
            <span class="iot-device-scope__label">{{ group.name }}</span>
            <em class="iot-device-scope__count">{{ countText(groupDeviceCounts[group.id]) }}</em>
          </button>
        </div>
        <CloudEmpty v-else :description="$t('IotDeviceList.scope.emptyGroups')" />
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TreeProps } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

type Area = { id: string; name: string; parentId?: string }
type Group = { id: string; name: string }

const props = defineProps<{
  activeType: 'area' | 'group'
  activeId: string
  areas: Area[]
  groups: Group[]
  totalDeviceCount: number
  areaDeviceCounts: Record<string, number>
  groupDeviceCounts: Record<string, number>
}>()
const emit = defineEmits<{
  (event: 'change', value: { type: 'area' | 'group'; id: string }): void
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

function select(id: string) {
  emit('change', { type: scopeType.value, id })
}

function countText(value?: number) {
  return $t('IotDeviceList.scope.deviceCount', { count: Math.max(0, Number(value) || 0) })
}

const onAreaSelect: TreeProps['onSelect'] = (keys) => select(String(keys[0] || ''))
</script>

<style scoped>
.iot-device-scope {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-3);
  min-height: 0;
}

.iot-device-scope__body {
  min-height: 0;
  overflow: auto;
}

.iot-device-scope__all,
.iot-device-scope__groups button {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.iot-device-scope__count {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  font-style: normal;
}

.iot-device-scope__area-node {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
}

.iot-device-scope :deep(.ant-tree-title) {
  display: block;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.iot-device-scope__all.is-active,
.iot-device-scope__groups button.is-active {
  color: var(--jet-theme-primary);
  font-weight: 600;
}

.iot-device-scope__all:not(.is-active):hover,
.iot-device-scope__groups button:not(.is-active):hover {
  background: var(--ant-table-row-hover-bg, rgba(0, 0, 0, 0.02));
  color: var(--jet-theme-text);
}

.iot-device-scope__groups {
  display: grid;
  gap: var(--space-1);
}
</style>
