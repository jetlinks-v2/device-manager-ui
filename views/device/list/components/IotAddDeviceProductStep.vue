<template>
  <section class="add-device-product-picker">
    <ProductCategoryTree
      class="add-device-product-picker__categories"
      :tree-data="categoryTree"
      :active-id="selectedCategoryId"
      :loading="categoryLoading"
      @select="emit('select-category', $event)"
      @select-unclassified="emit('select-unclassified')"
    />
    <section class="add-device-product-picker__content">
      <IotDeviceAssetSearchBar
        :filter-fields="filterFields"
        :common-filter-fields="commonFilterFields"
        :filter-terms="filterTerms"
        :placeholder="$t('IotDeviceList.add.productSearch')"
        @update:filter-terms="handleFilterTermsUpdate"
        @search="handleFilterSearch"
      />
      <p v-if="message" class="add-device__inline-message">{{ message }}</p>
      <a-spin :spinning="loading">
        <div v-if="products.length" class="add-device-library__grid">
          <IotAddDeviceLibraryCard
            v-for="product in products"
            :key="product.id"
            :template="product"
            :selected="product.id === selectedProductKey"
            @select="emit('select-product', $event)"
          />
        </div>
        <CloudEmpty v-else class="add-device-library__empty" :description="$t('IotDeviceList.add.productEmpty')" />
        <div v-if="total > pageSize" class="add-device-library__pager">
          <a-pagination
            :current="pageIndex + 1"
            size="small"
            :total="total"
            :page-size="pageSize"
            :show-size-changer="false"
            show-less-items
            @change="handlePageChange"
          />
        </div>
      </a-spin>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceQueryTerm, IotDeviceProductTemplate } from '@device-manager-ui/api/device'
import ProductCategoryTree, { type ProductCategoryTreeNode } from '@device-manager-ui/views/device/Product/components/ProductCategoryTree.vue'
import IotAddDeviceLibraryCard from './IotAddDeviceLibraryCard.vue'
import IotDeviceAssetSearchBar from './IotDeviceAssetSearchBar.vue'
import type { ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'

const props = defineProps({
  categoryTree: { type: Array as PropType<ProductCategoryTreeNode[]>, default: () => [] },
  categoryLoading: { type: Boolean, default: false },
  selectedCategoryId: { type: String, default: undefined },
  products: { type: Array as PropType<IotDeviceProductTemplate[]>, required: true },
  selectedProductKey: { type: String, required: true },
  total: { type: Number, default: 0 },
  pageIndex: { type: Number, default: 0 },
  pageSize: { type: Number, default: 6 },
  loading: { type: Boolean, default: false },
  message: { type: String, default: '' },
})

const emit = defineEmits<{
  (event: 'select-product', id: string): void
  (event: 'select-category', id?: string): void
  (event: 'select-unclassified'): void
  (event: 'query-change', query: { terms?: DeviceQueryTerm[]; pageIndex?: number }): void
}>()

const { t: $t } = useI18n()
const filterTerms = ref<ConditionFilterTerm[]>([])
const filterFields = computed<ConditionFilterField[]>(() => [
  {
    title: $t('Product.index.660348-7'),
    dataIndex: 'name',
    search: { type: 'string', defaultTermType: 'like' },
  },
  {
    title: $t('Product.index.660348-4'),
    dataIndex: 'deviceType',
    search: {
      type: 'select',
      defaultTermType: 'eq',
      options: [
        { label: $t('Product.index.660348-30'), value: 'device' },
        { label: $t('Product.index.660348-31'), value: 'childrenDevice' },
        { label: $t('Product.index.660348-32'), value: 'gateway' },
      ],
    },
  },
  {
    title: $t('Product.index.660348-29'),
    dataIndex: 'accessProvider',
    search: { type: 'string', defaultTermType: 'like' },
  },
])
const commonFilterFields = ['name', 'deviceType', 'accessProvider']

function handleFilterTermsUpdate(terms: ConditionFilterTerm[] = []) {
  filterTerms.value = terms
}

function handleFilterSearch(payload: { terms?: ConditionFilterTerm[] }) {
  emit('query-change', {
    terms: (payload.terms ?? filterTerms.value) as DeviceQueryTerm[],
    pageIndex: 0,
  })
}

function handlePageChange(page: number) {
  emit('query-change', { pageIndex: Math.max(0, page - 1) })
}
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
