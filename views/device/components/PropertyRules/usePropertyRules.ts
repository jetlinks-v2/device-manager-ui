import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty, ThingPropertyPreprocess } from '../../alarm/types'
import { propertyIdOf, propertyNameOf } from '../../alarm/utils'
import { isEmptyRule, parseRule } from './codec'
import { loadRules, type RuleScope } from './service'
import { summarizeRuleRows } from './summary'

export function usePropertyRules(props: { scope: RuleScope; properties: ThingModelProperty[]; presentation?: 'inline' | 'detail' }) {
  const permission = useAuthStore()
  const menu = useMenuStore()
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const failed = ref(false)
  const keyword = ref('')
  const configurationFilter = ref<'all' | 'configured' | 'unconfigured'>('all')
  const expandedGroups = ref<string[]>([])
  const visibleCounts = ref<Record<string, number>>({})
  const product = ref<ThingPropertyPreprocess[]>([])
  const device = ref<ThingPropertyPreprocess[]>([])
  const editorOpen = ref(false)
  const selected = ref<ThingModelProperty>()
  const addedIds = ref<string[]>([])
  const draftIds = ref<string[]>([])
  const detail = computed(() => props.presentation === 'detail')
  let revealedLink = ''
  let generation = 0
  const canSave = computed(() => props.scope.canUpdate ?? permission.hasPermission(props.scope.deviceId ? 'device/Instance:update' : 'device/Product:update'))
  // Only offer the owning scene page when its menu is accessible; do not guess object associations.
  const sceneMenu = computed(() => ['iot-user/scene-linkage', 'rule-engine/Scene'].find(code => menu.hasMenu(code)))
  function openScene() {
    if (sceneMenu.value) menu.jumpPage(sceneMenu.value)
  }
  const propertyRows = computed(() => {
    const productMap = new Map(product.value.map((item) => [item.property, item]))
    const deviceMap = new Map(device.value.map((item) => [item.property, item]))
    return props.properties.map((property) => {
      const id = propertyIdOf(property)
      const own = deviceMap.get(id)
      const raw = own ?? productMap.get(id)
      const source = own ? (isEmptyRule(own) ? 'disabled' : 'device') : raw ? 'product' : 'none'
      const rule = parseRule(raw)
      return { id, property, name: propertyNameOf(property), raw, hasOverride: Boolean(own), source, rule,
        effects: summarizeRuleRows(rule, property, t) }
    })
  })
  const selectedRow = computed(() => propertyRows.value.find(row => row.id === propertyIdOf(selected.value ?? {})))
  type PropertyRow = typeof propertyRows.value[number]
  // An empty device override still suppresses inheritance; hiding it must never delete it.
  const configured = (row: PropertyRow) => Boolean(row.raw && !isEmptyRule(row.raw))
  const configuredCount = computed(() => propertyRows.value.filter(configured).length)
  const unconfiguredRows = computed(() => propertyRows.value.filter(row => !configured(row) && !addedIds.value.includes(row.id) && !draftIds.value.includes(row.id)))
  const unconfiguredCount = computed(() => propertyRows.value.length - configuredCount.value)
  function orderRows(rows: PropertyRow[]) {
    if (!detail.value) return rows
    // Only the saved snapshot participates in sorting; typing must not move a card.
    return [...rows].sort((a, b) => {
      const aPin = addedIds.value.indexOf(a.id), bPin = addedIds.value.indexOf(b.id)
      if (aPin >= 0 || bPin >= 0) return aPin < 0 ? 1 : bPin < 0 ? -1 : aPin - bPin
      const count = (row: PropertyRow) => row.rule.editable ? Object.keys(row.rule.nodes).length : 0
      return count(b) - count(a)
    })
  }
  const searchedRows = computed(() => {
    const query = keyword.value.trim().toLowerCase()
    return propertyRows.value.filter(row => `${row.id} ${row.name}`.toLowerCase().includes(query))
  })
  const matchesConfiguration = (row: PropertyRow) => detail.value
    ? configured(row) || addedIds.value.includes(row.id) || draftIds.value.includes(row.id)
    : configurationFilter.value === 'all' || Boolean(row.raw) === (configurationFilter.value === 'configured')
  const rows = computed(() => orderRows(searchedRows.value.filter(matchesConfiguration)))
  const groups = computed(() => {
    const grouped = new Map<string, { id: string; name: string; rows: typeof rows.value; total: number; configured: number }>()
    // Product counts retain explicit overrides; detail counts only effective rules before filtering.
    for (const row of searchedRows.value) {
      const { groupId, groupName } = row.property.expands ?? {}
      const id = groupId ? `id:${groupId}` : groupName ? `name:${groupName}` : 'unclassified'
      let group = grouped.get(id)
      if (!group) {
        group = { id, name: groupName || t(groupId ? 'PropertyRules.unnamedCategory' : 'PropertyRules.unclassified'), rows: [], total: 0, configured: 0 }
        grouped.set(id, group)
      }
      group.total++
      if (detail.value ? configured(row) : row.raw) group.configured++
      if (matchesConfiguration(row)) group.rows.push(row)
    }
    return [...grouped.values()].filter(group => group.rows.length).map(group => {
      const ordered = orderRows(group.rows)
      return { ...group, rows: ordered, visibleRows: ordered.slice(0, visibleCounts.value[group.id] ?? 30),
        remaining: Math.max(0, ordered.length - (visibleCounts.value[group.id] ?? 30)) }
    })
  })
  // 搜索涵盖所有分类；大量同组属性只按需呈现摘要，不创建编辑表单。
  watch([() => groups.value.map(group => group.id).join('\0'), keyword, configurationFilter], () => {
    const current = expandedGroups.value[0]
    const next = groups.value.find(group => group.id === current) ?? groups.value[0]
    expandedGroups.value = next ? [next.id] : []
    visibleCounts.value = {}
  }, { immediate: true })
  function setExpandedGroup(key: string | number | (string | number)[]) {
    const value = Array.isArray(key) ? key[0] : key
    expandedGroups.value = value == null || value === '' ? [] : [String(value)]
  }
  function showMore(groupId: string) {
    visibleCounts.value = { ...visibleCounts.value, [groupId]: (visibleCounts.value[groupId] ?? 30) + 30 }
  }
  function revealProperty(id: string) {
    const group = groups.value.find(item => item.rows.some(row => row.id === id))
    if (!group) return
    expandedGroups.value = [group.id]
    visibleCounts.value = { ...visibleCounts.value, [group.id]: Math.max(visibleCounts.value[group.id] ?? 30, group.rows.findIndex(row => row.id === id) + 1) }
  }
  async function addProperty(id: string) {
    if (!detail.value || !canSave.value || loading.value || failed.value || !unconfiguredRows.value.some(row => row.id === id)) return
    addedIds.value = [id, ...addedIds.value]
    keyword.value = ''
    await nextTick()
    revealProperty(id)
  }
  function finishAdding(id: string) { addedIds.value = addedIds.value.filter(value => value !== id) }
  async function load() {
    const token = ++generation
    if (!props.scope.productId) return
    loading.value = true
    failed.value = false
    try {
      const result = await loadRules(props.scope)
      if (token !== generation) return
      product.value = result.product
      device.value = result.device
    } catch { if (token === generation) failed.value = true }
    finally { if (token === generation) loading.value = false }
  }
  function open(property: ThingModelProperty) {
    selected.value = property
    editorOpen.value = true
    return router.replace({ query: { ...route.query, ruleProperty: propertyIdOf(property) } })
  }
  function close(open: boolean) {
    editorOpen.value = open
    if (!open) {
      const query = { ...route.query }
      delete query.ruleProperty
      void router.replace({ query })
    }
  }
  watch([() => props.scope.productId, () => props.scope.deviceId], (_value, previous) => {
    if (previous?.length) close(false)
    visibleCounts.value = {}
    addedIds.value = []
    draftIds.value = []
    revealedLink = ''
    expandedGroups.value = groups.value[0] ? [groups.value[0].id] : []
    void load()
  }, { immediate: true })
  watch(() => [route.query.ruleProperty, props.properties, loading.value], () => {
    if (!route.query.ruleProperty) { revealedLink = ''; return }
    if (loading.value || failed.value) return
    const property = props.properties.find((item) => propertyIdOf(item) === route.query.ruleProperty)
    if (property) {
      const link = JSON.stringify([props.scope.productId, props.scope.deviceId, route.query.ruleProperty])
      if (detail.value) {
        if (revealedLink === link) return
        revealedLink = link
        const id = propertyIdOf(property)
        if (!rows.value.some(row => row.id === id)) {
          keyword.value = ''
          addedIds.value = [id, ...addedIds.value.filter(value => value !== id)]
        }
      }
      // An explicit property deep link must remain reachable even if a previous filter hid it.
      if (!rows.value.some(row => row.id === propertyIdOf(property))) {
        keyword.value = ''
        configurationFilter.value = 'all'
      }
      // Old deep links must reveal rows beyond the first chunk as well as collapsed categories.
      revealProperty(propertyIdOf(property))
      selected.value = property
      editorOpen.value = true
    }
  }, { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { loading, failed, keyword, configurationFilter, propertyRows, rows, groups, expandedGroups, setExpandedGroup, showMore, canSave, sceneMenu, openScene, selected, selectedRow, editorOpen, load, open, close,
    addedIds, draftIds, addProperty, finishAdding, configuredCount, unconfiguredCount, unconfiguredRows }
}
