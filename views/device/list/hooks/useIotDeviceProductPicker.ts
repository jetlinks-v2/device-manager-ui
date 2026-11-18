import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  queryDeviceProductCategoryTree_api,
  queryDeviceProductPage_api,
  type IotDeviceProductTemplate,
  type TreeNodeResponse,
} from '@device-manager-ui/api/device'
import type { ProductCategoryTreeNode } from '../../Product/components/ProductCategoryTree.vue'
import type { ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import { collectProductCategoryScopeIds } from '@device-manager-ui/utils/deviceCreationSources'

const UNCLASSIFIED_CATEGORY_ID = '__product-unclassified__'
type ProductQuery = { terms?: ConditionFilterTerm[]; pageIndex?: number }

function normalizeCategories(nodes: TreeNodeResponse[]): ProductCategoryTreeNode[] {
  return nodes.map(node => ({
    ...node,
    id: String(node.id),
    name: String(node.name ?? ''),
    children: normalizeCategories(node.children ?? node._children ?? []),
  }))
}

/** 导入、导出共用接入设备的分类和分页查询；卸载或连续筛选时丢弃旧响应。 */
export function useIotDeviceProductPicker(props: { enabledOnly: boolean }) {
  const { t } = useI18n()
  const categoryTree = ref<ProductCategoryTreeNode[]>([])
  const categoryLoading = ref(false)
  const totalProductCount = ref(0)
  const unclassifiedProductCount = ref(0)
  const selectedCategoryId = ref<string>()
  const products = ref<IotDeviceProductTemplate[]>([])
  const filterTerms = ref<ConditionFilterTerm[]>([])
  const total = ref(0)
  const pageIndex = ref(0)
  const pageSize = 6
  const loading = ref(false)
  const categoryError = ref('')
  const productError = ref('')
  const message = computed(() => categoryError.value || productError.value)
  let requestVersion = 0
  let active = true

  async function loadCategories() {
    categoryLoading.value = true
    categoryError.value = ''
    try {
      const statistics = await queryDeviceProductCategoryTree_api()
      if (!active) return
      categoryTree.value = normalizeCategories(statistics.categories)
      totalProductCount.value = statistics.total
      unclassifiedProductCount.value = statistics.unclassified
    } catch {
      if (active) categoryError.value = t('IotDeviceList.add.productLoadFailed')
    } finally {
      if (active) categoryLoading.value = false
    }
  }

  async function loadProducts(query: ProductQuery = {}) {
    if (query.terms !== undefined) filterTerms.value = query.terms
    if (query.pageIndex !== undefined) pageIndex.value = query.pageIndex
    const version = ++requestVersion
    loading.value = true
    productError.value = ''
    try {
      const page = await queryDeviceProductPage_api({
        enabledOnly: props.enabledOnly,
        pageIndex: pageIndex.value,
        pageSize,
        // 将用户 OR 条件整体 AND 到启用状态、分类范围内，避免扩大候选范围。
        terms: filterTerms.value.length ? [{ type: 'and', terms: filterTerms.value }] : [],
        classifiedIds: selectedCategoryId.value && selectedCategoryId.value !== UNCLASSIFIED_CATEGORY_ID
          ? collectProductCategoryScopeIds(categoryTree.value, selectedCategoryId.value)
          : undefined,
        unclassified: selectedCategoryId.value === UNCLASSIFIED_CATEGORY_ID,
      })
      if (!active || version !== requestVersion) return
      products.value = page.data
      total.value = page.total
      pageIndex.value = page.pageIndex
    } catch {
      if (active && version === requestVersion) {
        products.value = []
        total.value = 0
        productError.value = t('IotDeviceList.add.productLoadFailed')
      }
    } finally {
      if (active && version === requestVersion) loading.value = false
    }
  }

  function selectCategory(id?: string) {
    selectedCategoryId.value = id
    void loadProducts({ pageIndex: 0 })
  }

  onMounted(() => {
    void loadCategories()
    void loadProducts()
  })
  onBeforeUnmount(() => { active = false; ++requestVersion })

  return {
    categoryTree, categoryLoading, totalProductCount, unclassifiedProductCount, selectedCategoryId,
    products, filterTerms, total, pageIndex, pageSize, loading, message, loadProducts, selectCategory,
    selectUnclassified: () => selectCategory(UNCLASSIFIED_CATEGORY_ID),
  }
}
