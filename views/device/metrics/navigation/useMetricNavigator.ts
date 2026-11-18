import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { MetricObjectSelection, MetricSelectionOrigin } from '@jetlinks-web-core/components'

export type MetricNavigationNode = MetricObjectSelection & {
  children?: MetricNavigationNode[]
  productName?: string
  photoUrl?: string
  state?: string | { value: string; text?: string }
}
export type MetricNavigationPage = { data: MetricNavigationNode[]; total: number }
export type MetricNavigationQuery = (keyword: string, pageIndex: number, exactId?: string) => Promise<MetricNavigationPage>

export function findMetricNode(nodes: MetricNavigationNode[], id: string): MetricNavigationNode | undefined {
  for (const node of nodes) {
    if (node.ownerId === id) return node
    const child = node.children && findMetricNode(node.children, id)
    if (child) return child
  }
}

export function filterMetricTree(nodes: MetricNavigationNode[], keyword: string): MetricNavigationNode[] {
  const text = keyword.trim().toLocaleLowerCase()
  if (!text) return nodes
  return nodes.flatMap(node => {
    if (node.label.toLocaleLowerCase().includes(text)) return [node]
    const children = node.children && filterMetricTree(node.children, text)
    return children?.length ? [{ ...node, children }] : []
  })
}

/** 分页查询和已选 ID 的授权校验分别隔离，搜索失败不会冒充“没有对象”。 */
export function useMetricNavigator(query: MetricNavigationQuery, selectedId: Ref<string | undefined>, emit: (selection?: MetricObjectSelection, origin?: MetricSelectionOrigin) => void, tree = false) {
  const nodes = ref<MetricNavigationNode[]>([])
  const keyword = ref('')
  const page = ref(1)
  const total = ref(0)
  const loading = ref(false)
  const listError = ref(false)
  const selectionError = ref(false)
  let listVersion = 0
  let selectionVersion = 0
  let retryId: string | undefined
  let pendingList: Promise<MetricNavigationPage> | undefined
  const visibleNodes = computed(() => tree ? filterMetricTree(nodes.value, keyword.value) : nodes.value)
  const error = computed(() => listError.value || selectionError.value)

  async function search() {
    const version = ++listVersion
    loading.value = true
    listError.value = false
    try {
      pendingList = query(keyword.value, page.value - 1)
      const result = await pendingList
      if (version !== listVersion) return
      nodes.value = result.data
      total.value = result.total
    } catch { if (version === listVersion) listError.value = true }
    finally { if (version === listVersion) loading.value = false }
  }
  async function validate(id = selectedId.value) {
    const version = ++selectionVersion
    selectionError.value = false
    if (!id) { emit(undefined, 'validation'); return }
    retryId = id
    try {
      const result = await (tree && loading.value && pendingList ? pendingList : query('', 0, id))
      if (version !== selectionVersion) return
      const node = findMetricNode(result.data, id)
      retryId = undefined
      emit(node && { ownerId: node.ownerId, label: node.label, targetType: node.targetType, targetId: node.targetId }, 'validation')
    } catch {
      if (version === selectionVersion) { selectionError.value = true; emit(undefined, 'validation') }
    }
  }
  function select(id: string) {
    const node = findMetricNode(nodes.value, id)
    if (!node || loading.value || listError.value) return false
    selectionVersion += 1
    retryId = undefined
    selectionError.value = false
    emit({ ownerId: node.ownerId, label: node.label, targetType: node.targetType, targetId: node.targetId }, 'user')
    return true
  }
  function changePage(value: number) { page.value = value; return search() }
  function submitSearch() { page.value = 1; return tree ? Promise.resolve() : search() }
  async function retry() { await Promise.all([search(), validate(selectedId.value || retryId)]) }
  void search()
  watch(selectedId, id => { if (id || !selectionError.value) void validate(id) }, { immediate: true })
  onScopeDispose(() => { listVersion += 1; selectionVersion += 1 })
  return { nodes, visibleNodes, keyword, page, total, loading, error, search: submitSearch, changePage, select, retry }
}
