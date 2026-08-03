<template>
  <aside class="iot-health-tree">
    <header class="iot-health-tree__head">
      <h3>{{ $t('IotHealthPage.tree.title') }}</h3>
      <span>{{ total }}</span>
    </header>

    <div class="iot-health-tree__search">
      <a-input
        class="iot-health-tree__search-input"
        :value="keyword"
        :placeholder="$t('IotHealthPage.tree.search')"
        @update:value="handleKeywordSearch"
      >
        <template #prefix>
          <AIcon type="SearchOutlined" />
        </template>
      </a-input>
    </div>

    <div class="iot-health-tree__body">
      <a-tree
        v-if="treeData.length"
        v-model:expandedKeys="expandedKeys"
        :tree-data="treeData"
        :selected-keys="selectedKeys"
        block-node
        @select="onSelect"
      >
        <template #switcherIcon="{ switcherCls }">
          <AIcon type="DownOutlined" :class="switcherCls" />
        </template>
        <template #title="node">
          <IotHealthTreeTitle :node="node" />
        </template>
      </a-tree>
      <CloudEmpty
        v-else
        class="iot-health-tree__empty"
        :description="$t('IotHealthPage.tree.empty')"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'

import IotHealthTreeTitle from './IotHealthTreeTitle.vue'
import type { HealthTreeNode } from '../hooks/useIotDeviceHealthPage'
import { useI18n } from 'vue-i18n'

type TreeItem = {
  key: string
  title: string
  count: number
  tone: HealthTreeNode['tone']
  icon: string
  children?: TreeItem[]
  deviceId?: string
  score?: number
}

const props = defineProps({
  nodes: {
    type: Array as PropType<HealthTreeNode[]>,
    default: () => [],
  },
  selectedDeviceId: {
    type: String,
    default: '',
  },
  summary: {
    type: Object as PropType<{ score: number; delta: number; total: number }>,
    required: true,
  },
})

const emit = defineEmits<{
  select: [deviceId: string]
}>()

const { t: $t } = useI18n()
const keyword = ref('')
const expandedKeys = ref<string[]>([])

const total = computed(() => $t('IotHealthPage.tree.total', { total: props.summary.total }))

const filteredNodes = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return props.nodes
  return props.nodes
    .map((node) => filterNode(node, text))
    .filter((node): node is HealthTreeNode => Boolean(node))
})

const treeData = computed(() => filteredNodes.value.map(toTreeItem))
const selectedKeys = computed(() => props.selectedDeviceId ? [`device-${props.selectedDeviceId}`] : [])
const nodeMap = computed(() => {
  const map = new Map<string, TreeItem>()
  const visit = (items: TreeItem[]) => {
    items.forEach((item) => {
      map.set(item.key, item)
      if (item.children?.length) visit(item.children)
    })
  }
  visit(treeData.value)
  return map
})

watch(treeData, (items) => {
  expandedKeys.value = keyword.value ? collectExpandableKeys(items) : items
    .filter((item) => item.key === 'all')
    .map((item) => item.key)
}, { immediate: true })

function filterNode(node: HealthTreeNode, text: string): HealthTreeNode | null {
  const matched = node.label.toLowerCase().includes(text)
    || node.device?.identifier?.toLowerCase().includes(text)
  const children = node.children
    ?.map((child) => filterNode(child, text))
    .filter((child): child is HealthTreeNode => Boolean(child))

  if (!matched && !children?.length) return null
  return { ...node, children }
}

function toTreeItem(node: HealthTreeNode): TreeItem {
  return {
    key: node.deviceId ? `device-${node.deviceId}` : node.id,
    title: node.label,
    count: node.count,
    tone: node.tone,
    icon: treeIcon(node),
    children: node.children?.map(toTreeItem),
    deviceId: node.deviceId,
    score: node.score,
  }
}

function treeIcon(node: HealthTreeNode) {
  if (node.tone === 'danger') return 'WarningOutlined'
  if (node.tone === 'warn') return 'BookOutlined'
  if (node.tone === 'good') return 'HeartOutlined'
  return 'AppstoreOutlined'
}

function collectExpandableKeys(items: TreeItem[]) {
  const keys: string[] = []
  const visit = (nodes: TreeItem[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        keys.push(node.key)
        visit(node.children)
      }
    })
  }
  visit(items)
  return keys
}

function onSelect(keys: Array<string | number>) {
  const node = nodeMap.value.get(String(keys[0] ?? ''))
  if (node?.deviceId) emit('select', node.deviceId)
}

function handleKeywordSearch(value: string) {
  keyword.value = String(value || '')
}
</script>

<style scoped>
.iot-health-tree {
  --iot-health-tree-active-bg: #e2edff;
  --iot-health-tree-active-color: #1e72f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--jet-theme-bg-container);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-secondary);
  border-radius: 1rem;
}

.iot-health-tree__head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 1rem 1rem 0;
}

.iot-health-tree__head h3 {
  flex: 1;
  margin: 0;
  color: var(--jet-theme-text);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.5rem;
}

.iot-health-tree__head span {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.375rem;
}

.iot-health-tree__search {
  padding: 1rem;
}

.iot-health-tree__search-input {
  width: 100%;
}

.iot-health-tree__search :deep(.ant-input-affix-wrapper) {
  height: 2.25rem;
  border-color: var(--jet-theme-border-secondary);
  border-radius: 0.5rem;
  box-shadow: none;
}

.iot-health-tree__search :deep(.ant-input-affix-wrapper > input.ant-input) {
  font-size: var(--fs-14);
}

.iot-health-tree__body {
  flex: 1;
  overflow: auto;
  padding: 0 1rem 1rem;
}

.iot-health-tree__body :deep(.ant-tree) {
  background: transparent;
}

.iot-health-tree__body :deep(.ant-tree-indent-unit) {
  width: 1rem;
}

.iot-health-tree__body :deep(.ant-tree-treenode) {
  align-items: center;
  min-height: 2.25rem;
  padding: 0;
}

.iot-health-tree__body :deep(.ant-tree-switcher) {
  width: 1rem;
  height: 2.25rem;
  color: var(--jet-theme-text-disabled);
  display: flex;
  align-items: center;
  justify-content: center;
}

.iot-health-tree__body :deep(.ant-tree-node-content-wrapper) {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  min-height: 2.25rem;
  padding: 0 var(--space-2);
  border-radius: 0.5rem;
}

.iot-health-tree__body :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected) {
	border-left: 2px solid var(--jet-theme-primary);
  background: linear-gradient(90deg, var(--accent-soft) 0%, rgba(255, 255, 255, 0.10) 100%);
}

.iot-health-tree__body :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected::before) {
  position: absolute;
  top: 0.375rem;
  bottom: 0.375rem;
  left: 0;
  width: 0.125rem;
  background: var(--accent-soft);
  border-radius: 0 0.125rem 0.125rem 0;
  content: '';
}

.iot-health-tree__body :deep(.ant-tree-node-content-wrapper.ant-tree-node-selected .iot-health-tree-title__name) {
  color: var(--jet-theme-primary);
  font-weight: var(--layout-menu-item-active-font-weight);
}

.iot-health-tree__body :deep(.ant-tree-title) {
  display: block;
  flex: 1;
  min-width: 0;
}

.iot-health-tree__empty {
  padding: var(--space-6) 0;
}

:deep(.ant-tree-switcher-noop) {
  display: none !important;
}
</style>
