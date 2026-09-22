import { computed, ref, watch } from 'vue'
import type { TreeProps } from 'ant-design-vue'

export interface ProductCategoryTreeNode {
  id: string
  name: string
  i18nName?: string
  children?: ProductCategoryTreeNode[]
  [key: string]: unknown
}

interface ProductCategoryDisplayNode extends ProductCategoryTreeNode {
  key: string
  categoryLevel: number
  children: ProductCategoryDisplayNode[]
}

interface ProductCategoryTreeOptions {
  treeData: () => ProductCategoryTreeNode[]
  activeId: () => string | undefined
  allLabel: () => string
  unclassifiedLabel: () => string
  onSelect: (id?: string) => void
  onSelectUnclassified: () => void
}

const allScopeId = '__product-all__'
const unclassifiedScopeId = '__product-unclassified__'

/** 管理产品分类树的本地展示和搜索状态，通过回调交给页面执行筛选。 */
export function useProductCategoryTree(options: ProductCategoryTreeOptions) {
  const keyword = ref('')
  const expandedKeys = ref<string[]>([])
  const expandedBeforeSearch = ref<string[]>()
  const fieldNames = { title: 'name', key: 'id', children: 'children' }
  const selectedKeys = computed(() => {
    const id = options.activeId()
    return [id || allScopeId]
  })
  const normalizedKeyword = computed(() => keyword.value.trim())

  // 虚拟筛选范围仅加入展示副本，始终作为树顶部节点参与搜索。
  const filteredTree = computed(() => filterTree([
    { id: allScopeId, name: options.allLabel(), isLeaf: true, icon: 'icon-quanbu' },
    { id: unclassifiedScopeId, name: options.unclassifiedLabel(), isLeaf: true, icon: 'icon-shujiedian-weifenlei' },
    ...options.treeData(),
  ], normalizedKeyword.value))

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

  // 分类刷新或语言切换时，同步搜索结果的展开状态。
  watch(filteredTree, (nodes) => {
    if (normalizedKeyword.value) {
      expandedKeys.value = collectExpandableKeys(nodes)
    }
  })

  function handleExpand(keys: Array<string | number>): void {
    expandedKeys.value = keys.map(String)
  }

  const handleSelect: NonNullable<TreeProps['onSelect']> = (keys, info) => {
    // 再次点击已选节点时 keys 为空，按事件节点保留虚拟筛选范围的语义。
    if (info.node.key === allScopeId) {
      options.onSelect()
      return
    }
    if (info.node.key === unclassifiedScopeId) {
      options.onSelectUnclassified()
      return
    }
    options.onSelect(keys[0] === undefined ? undefined : String(keys[0]))
  }

  return {
    keyword,
    expandedKeys,
    selectedKeys,
    filteredTree,
    fieldNames,
    isScopeNode: (id: string) => id === allScopeId || id === unclassifiedScopeId,
    handleExpand,
    handleSelect,
  }
}

/** 只收集可展开的分类，叶子节点不进入展开列表。 */
function collectExpandableKeys(nodes: ProductCategoryTreeNode[]): string[] {
  return nodes.flatMap((node) => node.children?.length
    ? [node.id, ...collectExpandableKeys(node.children)]
    : [])
}

/** 按展示名称过滤并补齐树控件的 key；命中子分类时保留祖先。 */
function filterTree(nodes: ProductCategoryTreeNode[], value: string, level = 1): ProductCategoryDisplayNode[] {
  const normalizedKeyword = value.trim().toLocaleLowerCase()

  return nodes.reduce<ProductCategoryDisplayNode[]>((result, node) => {
    const children = filterTree(node.children || [], value, level + 1)
    const name = String(node.i18nName || node.name || '').toLocaleLowerCase()
    if (!normalizedKeyword || name.includes(normalizedKeyword) || children.length) {
      result.push({ ...node, key: node.id, categoryLevel: level, children })
    }
    return result
  }, [])
}
