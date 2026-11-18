<template>
  <section class="device-batch-product">
    <a-alert v-if="showHint" type="info" show-icon :message="$t('Import.product.411796-0')" />
    <IotAddDeviceProductStep
      :category-tree="categoryTree"
      :category-loading="categoryLoading"
      :total-product-count="totalProductCount"
      :unclassified-product-count="unclassifiedProductCount"
      :selected-category-id="selectedCategoryId"
      :products="products"
      :selected-product-key="rowKey"
      :filter-terms="filterTerms"
      :total="total"
      :page-index="pageIndex"
      :page-size="pageSize"
      :loading="loading"
      :message="message"
      @select-product="selectProduct"
      @select-category="selectCategory"
      @select-unclassified="selectUnclassified"
      @query-change="loadProducts"
    />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import IotAddDeviceProductStep from '../../list/components/IotAddDeviceProductStep.vue'
import { useIotDeviceProductPicker } from '../../list/hooks/useIotDeviceProductPicker'

const props = withDefaults(defineProps<{
  rowKey?: string
  enabledOnly?: boolean
  showHint?: boolean
}>(), { rowKey: '', enabledOnly: true, showHint: true })
const emit = defineEmits<{
  (e: 'update:rowKey', id: string): void
  (e: 'change', product: IotDeviceProductTemplate): void
}>()
const { t: $t } = useI18n()
const {
  categoryTree, categoryLoading, totalProductCount, unclassifiedProductCount, selectedCategoryId,
  products, filterTerms, total, pageIndex, pageSize, loading, message, loadProducts, selectCategory, selectUnclassified,
} = useIotDeviceProductPicker(props)

function selectProduct(id: string) {
  const product = products.value.find(item => item.id === id)
  if (!product) return
  emit('update:rowKey', id)
  emit('change', product)
}
</script>

<style scoped>
.device-batch-product {
  display: grid;
  gap: var(--space-4);
}
</style>
