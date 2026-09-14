<template>
  <div class="product-category-tree" :aria-label="$t('Product.index.660348-36')">
    <a-input
      v-model:value="keyword"
      class="product-category-tree__search"
      :placeholder="$t('Product.index.660348-37')"
      allow-clear
    >
      <template #prefix><AIcon type="SearchOutlined" /></template>
    </a-input>

    <div class="product-category-tree__content">
      <a-spin :spinning="loading">
        <button
          class="product-category-tree__all"
          :class="{ 'is-active': !activeId }"
          type="button"
          @click="emit('select', undefined)"
        >
          <span class="product-category-tree__label">{{ $t('Product.index.660348-38') }}</span>
        </button>
        <a-tree
          v-if="filteredTree.length"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          block-node
          :tree-data="filteredTree"
          :field-names="fieldNames"
          @expand="handleExpand"
          @select="handleSelect"
        >
          <template #title="node">
            <span class="product-category-tree__node">
              <span class="product-category-tree__label">{{ node.i18nName || node.name }}</span>
              <a-dropdown v-if="canAdd || canUpdate || canDelete" :trigger="['click']">
                <a-button
                  class="product-category-tree__node-action"
                  type="text"
                  size="small"
                  :aria-label="$t('Category.index.779033-4')"
                  @click.stop
                >
                  <AIcon type="EllipsisOutlined" aria-hidden="true" />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item v-if="canAdd" @click="emit('add-child', node)">
                      <AIcon type="PlusOutlined" aria-hidden="true" />
                      {{ $t('Category.index.779033-7') }}
                    </a-menu-item>
                    <a-menu-item v-if="canUpdate" @click="emit('edit', node)">
                      <AIcon type="EditOutlined" aria-hidden="true" />
                      {{ $t('Category.index.779033-5') }}
                    </a-menu-item>
                    <a-menu-item v-if="canDelete" danger @click="emit('delete', node)">
                      <AIcon type="DeleteOutlined" aria-hidden="true" />
                      {{ $t('Category.index.779033-9') }}
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </span>
          </template>
        </a-tree>
        <a-empty v-else :description="$t('Product.index.660348-39')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
      </a-spin>
    </div>
    <button
      class="product-category-tree__unclassified"
      :class="{ 'is-active': activeId === unclassifiedScopeId }"
      type="button"
      @click="emit('select-unclassified')"
    >
      <span class="product-category-tree__label">{{ $t('Product.index.660348-42') }}</span>
    </button>
    <a-button
      v-if="canAdd"
      class="product-category-tree__create-category"
      type="dashed"
      block
      @click="emit('add-root')"
    >
      <template #icon><AIcon type="PlusOutlined" /></template>
      {{ $t('Category.index.779033-15') }}
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { Empty } from 'ant-design-vue'

export interface ProductCategoryTreeNode {
  id: string
  name: string
  i18nName?: string
  children?: ProductCategoryTreeNode[]
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  treeData?: ProductCategoryTreeNode[]
  activeId?: string
  loading?: boolean
  canAdd?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}>(), {
  treeData: () => [],
  activeId: undefined,
  loading: false,
  canAdd: false,
  canUpdate: false,
  canDelete: false,
})

const emit = defineEmits<{
  (event: 'select', id?: string): void
  (event: 'select-unclassified'): void
  (event: 'add-root'): void
  (event: 'add-child', category: ProductCategoryTreeNode): void
  (event: 'edit', category: ProductCategoryTreeNode): void
  (event: 'delete', category: ProductCategoryTreeNode): void
}>()

const keyword = ref('')
const expandedKeys = ref<string[]>([])
const expandedBeforeSearch = ref<string[]>()
const unclassifiedScopeId = '__product-unclassified__'
const fieldNames = {
  title: 'name',
  key: 'id',
  children: 'children',
}

const selectedKeys = computed(() => props.activeId ? [props.activeId] : [])
const normalizedKeyword = computed(() => keyword.value.trim())
const filteredTree = computed(() => filterTree(props.treeData, keyword.value))

// 搜索仅临时接管展开状态，清空后恢复用户原来的分类浏览位置。
watch(normalizedKeyword, (value, previous) => {
  if (value) {
    if (!previous) {
      expandedBeforeSearch.value = [...expandedKeys.value]
    }
    expandedKeys.value = collectExpandableKeys(filteredTree.value)
    return
  }

  if (previous) {
    expandedKeys.value = expandedBeforeSearch.value || []
    expandedBeforeSearch.value = undefined
  }
})

watch(filteredTree, (nodes) => {
  if (normalizedKeyword.value) {
    expandedKeys.value = collectExpandableKeys(nodes)
  }
})

function handleExpand(keys: Array<string | number>) {
  expandedKeys.value = keys.map((key) => String(key))
}

function handleSelect(keys: string[]) {
  emit('select', keys[0])
}

function collectExpandableKeys(nodes: ProductCategoryTreeNode[]): string[] {
  const keys: string[] = []
  const visit = (items: ProductCategoryTreeNode[]) => {
    items.forEach((node) => {
      if (node.children?.length) {
        keys.push(node.id)
        visit(node.children)
      }
    })
  }
  visit(nodes)
  return keys
}

function filterTree(nodes: ProductCategoryTreeNode[], value: string): ProductCategoryTreeNode[] {
  const normalizedKeyword = value.trim().toLocaleLowerCase()
  if (!normalizedKeyword) {
    return nodes
  }

  // 命中子分类时保留父节点，保证本地搜索仍能表达原有树层级。
  return nodes.reduce<ProductCategoryTreeNode[]>((result, node) => {
    const children = filterTree(node.children || [], value)
    const name = String(node.i18nName || node.name || '').toLocaleLowerCase()
    if (name.includes(normalizedKeyword) || children.length) {
      result.push({ ...node, children })
    }
    return result
  }, [])
}
</script>

<style scoped lang="less">
.product-category-tree {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: var(--space-2);
  height: 100%;
  min-height: 0;
  overflow: hidden;

  &__search {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  &__content {
    min-height: 0;
    overflow: auto;
  }

  &__all,
  &__unclassified {
    display: block;
    width: 100%;
    padding: var(--space-2);
    color: var(--jet-theme-text-secondary);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;

    &.is-active {
      color: var(--jet-theme-primary);
      font-weight: 600;
    }

    &:not(.is-active):hover {
      color: var(--jet-theme-text);
      background: var(--ant-table-row-hover-bg, rgba(0, 0, 0, 0.02));
    }
  }

  &__unclassified {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--jet-theme-border, var(--ant-color-border));
    border-radius: var(--r-3);
    text-align: center;
  }

  &__label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__node {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }

  &__node-action {
    opacity: 0;
  }

  &__node:hover &__node-action,
  &__node:focus-within &__node-action {
    opacity: 1;
  }

  &__create-category {
    width: 100%;
    margin: 0;
    box-sizing: border-box;
  }

  :deep(.ant-tree-title) {
    display: block;
    flex: 1;
    min-width: 0;
    width: 100%;
  }

  :deep(.ant-tree) {
    margin-top: var(--space-1);
  }

  :deep(.ant-tree-node-content-wrapper) {
    text-align: left;
  }
}
</style>
