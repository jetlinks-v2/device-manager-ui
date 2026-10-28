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
            <IotTreeNodeRow
              :count="Math.max(0, Number(node.productCount) || 0)"
              :count-tooltip="$t('Product.index.660348-44', { count: Math.max(0, Number(node.productCount) || 0) })"
              :show-action="!isScopeNode(node.id) && (canAdd || canUpdate || canDelete)"
              :reserve-action-space="canAdd || canUpdate || canDelete"
              :action-aria-label="$t('Category.index.779033-4')"
            >
              <template #icon>
                <AIcon
                  class="product-category-tree__node-icon"
                  :type="node.icon || (node.isLeaf ? 'icon-shu-chanpinfenlei-hui' : 'icon-shu-chanpinfenlei')"
                  aria-hidden="true"
                />
              </template>
              <template #label>{{ node.i18nName || node.name }}</template>
              <template #action>
                <a-menu-item v-if="canAdd" @click="emit('add-root')">
                  <AIcon type="PlusOutlined" aria-hidden="true" />
                  {{ $t('Category.index.779033-15') }}
                </a-menu-item>
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
              </template>
            </IotTreeNodeRow>
          </template>
        </a-tree>
        <CloudEmpty v-else :description="$t('Product.index.660348-39')" />
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
import { useI18n } from 'vue-i18n'
import IotTreeNodeRow from '@device-manager-ui/components/IotTreeNodeRow.vue'
import { useProductCategoryTree, type ProductCategoryTreeNode } from '../hooks/useProductCategoryTree'

export type { ProductCategoryTreeNode } from '../hooks/useProductCategoryTree'

const props = withDefaults(defineProps<{
  treeData?: ProductCategoryTreeNode[]
  activeId?: string
  loading?: boolean
  totalProductCount?: number
  unclassifiedProductCount?: number
  canAdd?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}>(), {
  treeData: () => [],
  activeId: undefined,
  loading: false,
  totalProductCount: 0,
  unclassifiedProductCount: 0,
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
  totalProductCount: () => props.totalProductCount,
  unclassifiedProductCount: () => props.unclassifiedProductCount,
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

  &__content:has(.cloud-empty) {
    display: flex;
    flex-direction: column;

    :deep(.ant-spin-nested-loading),
    :deep(.ant-spin-container) {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      justify-content: safe center;
    }
  }

  &__scope-dot {
    display: inline-block;
    width: 0.375rem;
    height: 0.375rem;
    vertical-align: middle;
    background: #DDE4ED;
    border-radius: 50%;
  }

  &__node-icon {
    flex: 0 0 auto;
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
