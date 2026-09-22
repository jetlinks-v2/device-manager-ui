<template>
  <div class="product-category-tree" :aria-label="$t('Product.index.660348-36')">
    <header class="product-category-tree__header">
      <strong>{{ $t('Product.index.660348-36') }}</strong>
    </header>
    <a-input
      v-model:value="keyword"
      class="product-category-tree__search"
      :placeholder="$t('Product.index.660348-37')"
      allow-clear
    >
      <template #prefix><AIcon type="icon-gaojingzhongxin-zhinengsousuo-sousuo" /></template>
    </a-input>

    <div class="product-category-tree__content">
      <a-spin :spinning="loading">
        <a-tree
          v-if="filteredTree.length"
          :selected-keys="selectedKeys"
          :expanded-keys="expandedKeys"
          block-node
          :show-line="{ showLeafIcon: false }"
          :tree-data="filteredTree"
          :field-names="fieldNames"
          @expand="handleExpand"
          @select="handleSelect"
        >
          <template #leafIcon="{ dataRef }">
            <span
              v-if="isScopeNode(dataRef.id)"
              class="product-category-tree__scope-dot"
              aria-hidden="true"
            />
            <AIcon v-else class="ant-tree-switcher-line-icon" type="FileOutlined" aria-hidden="true" />
          </template>
          <template #title="node">
            <span class="product-category-tree__node">
              <span class="product-category-tree__node-content">
                <AIcon
                  class="product-category-tree__node-icon"
                  :type="node.icon || (node.isLeaf ? 'icon-shu-chanpinfenlei-hui' : 'icon-shu-chanpinfenlei')"
                  aria-hidden="true"
                />
                <span class="product-category-tree__label">{{ node.i18nName || node.name }}</span>
              </span>
              <a-dropdown
                v-if="!isScopeNode(node.id) && (canAdd || canUpdate || canDelete)"
                :trigger="['click']"
              >
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
    <a-button
      v-if="canAdd"
      class="product-category-tree__create-category"
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
import { useI18n } from 'vue-i18n'
import { useProductCategoryTree, type ProductCategoryTreeNode } from '../hooks/useProductCategoryTree'

export type { ProductCategoryTreeNode } from '../hooks/useProductCategoryTree'

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

const { t: $t } = useI18n()
const {
  keyword,
  expandedKeys,
  selectedKeys,
  filteredTree,
  fieldNames,
  isScopeNode,
  handleExpand,
  handleSelect,
} = useProductCategoryTree({
  treeData: () => props.treeData,
  activeId: () => props.activeId,
  allLabel: () => $t('Product.index.660348-38'),
  unclassifiedLabel: () => $t('Product.index.660348-42'),
  onSelect: (id) => emit('select', id),
  onSelectUnclassified: () => emit('select-unclassified'),
})
</script>

<style scoped lang="less">
.product-category-tree {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
  overflow: hidden;

  &__header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    min-height: 0;

    strong {
      color: var(--jet-theme-text-title);
      font-size: var(--fs-18);
      font-weight: 600;
      line-height: var(--lh-24);
    }
  }

  &__search {
    width: 100%;
    min-width: 0;
    flex: 0 0 auto;
    box-sizing: border-box;
  }

  &__content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  &__label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__scope-dot {
    display: inline-block;
    width: 0.375rem;
    height: 0.375rem;
    vertical-align: middle;
    background: #DDE4ED;
    border-radius: 50%;
  }

  &__node {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }

  &__node-content {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }

  &__node-icon {
    flex: 0 0 auto;
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
