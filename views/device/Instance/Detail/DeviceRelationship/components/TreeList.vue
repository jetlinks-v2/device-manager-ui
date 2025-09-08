<template>
  <div class="tree-list">
    <!-- 顶部控制区域 -->
    <div class="tree-header" v-if="showViewToggle || $slots['header-extra']">
      <div class="header-left">
        <!-- 视图切换控制 -->
        <div class="view-controls" v-if="showViewToggle">
          <a-radio-group v-model:value="currentView" button-style="solid" @change="handleViewChange">
            <a-radio-button value="tree">{{ t('DeviceRelationship.TreeList.234567-0') }}</a-radio-button>
            <a-radio-button value="flat">{{ t('DeviceRelationship.TreeList.234567-1') }}</a-radio-button>
          </a-radio-group>
          <slot name="extra-controls"></slot>
        </div>
      </div>
      <div class="header-right">
        <!-- 顶部右侧插槽 -->
        <slot name="header-extra"></slot>
      </div>
    </div>

    <!-- 列表内容 -->
    <div class="list-content">
      <!-- 树形视图 -->
      <div v-if="currentView === 'tree'" class="tree-view">
        <a-tree
          :tree-data="treeNodeData"
          :expanded-keys="expandedKeys"
          :field-names="{ children: 'children', title: 'title', key: 'key' }"
          @expand="handleExpand"
          block-node
        >
          <template #title="{ dataRef }">
            <div class="tree-node-content">
              <span class="node-name">{{ dataRef.title }}</span>
              <div class="node-actions">
                <slot name="actions" :item="dataRef.originData" :level="dataRef.level"></slot>
              </div>
            </div>
          </template>
        </a-tree>
      </div>

      <!-- 平铺视图 -->
      <div v-else class="flat-view">
        <div
          v-for="item in flatData"
          :key="item[keyField]"
          class="flat-item"
          :class="{ 'sub-sub-item': item.level === 2 }"
        >
          <div class="item-content">
            <span class="item-name">{{ item[nameField] }}</span>
          </div>
          <div class="item-actions">
            <slot name="actions" :item="item" :level="item.level || 0"></slot>
          </div>
        </div>
      </div>

      <!-- 无数据状态 -->
      <div v-if="!treeData.length && !loading" class="empty-state">
        <slot name="empty">
          <div class="empty-text">{{ t('DeviceRelationship.TreeList.234567-2') }}</div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  data: any[]
  loading?: boolean
  keyField?: string
  nameField?: string
  showViewToggle?: boolean
  defaultView?: 'tree' | 'flat'
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  keyField: 'id',
  nameField: 'name',
  showViewToggle: true,
  defaultView: 'tree'
})

const emit = defineEmits<{
  viewChange: [view: 'tree' | 'flat']
}>()

const currentView = ref(props.defaultView)
const expandedKeys = ref<string[]>([])

// 树形数据
const treeData = computed(() => props.data || [])

// 转换为a-tree组件所需的数据格式
const treeNodeData = computed(() => {
  const transformNode = (items: any[], level = 0) => {
    return items.map(item => ({
      key: item[props.keyField],
      title: item[props.nameField],
      children: item.children?.length ? transformNode(item.children, level + 1) : undefined,
      originData: item,
      level
    }))
  }

  return transformNode(treeData.value)
})

// 平铺数据 - 将树形结构展开为平铺列表
const flatData = computed(() => {
  const result: any[] = []

  const flatten = (items: any[], level = 0) => {
    items.forEach(item => {
      result.push({ ...item, level })
      if (item.children?.length) {
        flatten(item.children, level + 1)
      }
    })
  }

  flatten(treeData.value)
  return result
})

// 处理树节点展开/收起
const handleExpand = (expandedKeysValue: string[]) => {
  expandedKeys.value = expandedKeysValue
}

// 视图切换
const handleViewChange = () => {
  emit('viewChange', currentView.value)
}

// 默认展开所有节点
onMounted(() => {
  const getAllKeys = (items: any[]): string[] => {
    const keys: string[] = []
    items.forEach(item => {
      if (item.children?.length) {
        keys.push(item[props.keyField])
        keys.push(...getAllKeys(item.children))
      }
    })
    return keys
  }

  expandedKeys.value = getAllKeys(treeData.value)
})
</script>

<style lang="less" scoped>
.tree-list {
  display: flex;
  flex-direction: column;
  height: 100%;

  .tree-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .header-left {
      .view-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .list-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;

    .tree-view {
      :deep(.ant-tree) {
        background-color: transparent;
        .ant-tree-switcher {
          line-height: 40px;
        }
        .ant-tree-node-content-wrapper {
          flex: 1;
          display: flex !important;
          align-items: center;
          padding: 4px 0;

          &:hover {
            background-color: transparent;
          }
        }

        .ant-tree-title {
          flex: 1;
          width: 100%;
        }

        .tree-node-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 4px 8px;
          min-height: 32px;

          .node-name {
            color: #333;
            font-size: 14px;
            flex: 1;
          }

          .node-actions {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }

      // 特殊样式处理第三级节点
      :deep(.ant-tree-treenode) {
        &[data-level="2"] {
          .tree-node-content {
            background: #f0f8ff;
            border-left: 3px solid #1890ff;
            margin: 2px 0;
            border-radius: 0 4px 4px 0;
          }
        }
      }
    }

    .flat-view {
      .flat-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
        min-height: 32px;

        &:last-child {
          border-bottom: none;
        }

        &.sub-sub-item {
          background-color: #F1F7FF;
          border: 1px solid #BAE0FF;
          margin: 2px 0;
          padding: 8px;
        }

        .item-content {
          display: flex;
          align-items: center;
          flex: 1;

          .item-name {
            color: #333;
            font-size: 14px;
          }
        }

        .item-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100px;
      color: #999;

      .empty-text {
        font-size: 14px;
      }
    }
  }
}
</style>
