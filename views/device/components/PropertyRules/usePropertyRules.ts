import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty, ThingPropertyPreprocess } from '../../alarm/types'
import { propertyIdOf, propertyNameOf } from '../../alarm/utils'
import { isEmptyRule, parseRule } from './codec'
import { loadRules, type RuleScope } from './service'
import { summarizeRuleRows } from './summary'

export function usePropertyRules(props: { scope: RuleScope; properties: ThingModelProperty[] }) {
  const permission = useAuthStore()
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const loading = ref(false)
  const failed = ref(false)
  const keyword = ref('')
  const configuredOnly = ref(false)
  const expandedGroups = ref<string[]>([])
  const visibleCounts = ref<Record<string, number>>({})
  const product = ref<ThingPropertyPreprocess[]>([])
  const device = ref<ThingPropertyPreprocess[]>([])
  const editorOpen = ref(false)
  const selected = ref<ThingModelProperty>()
  let generation = 0
  const canSave = computed(() => props.scope.canUpdate ?? permission.hasPermission(props.scope.deviceId ? 'device/Instance:update' : 'device/Product:update'))
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
  const rows = computed(() => propertyRows.value.filter(row => (!configuredOnly.value || row.raw)
    && `${row.id} ${row.name}`.toLowerCase().includes(keyword.value.trim().toLowerCase())))
  const groups = computed(() => {
    const grouped = new Map<string, { id: string; name: string; rows: typeof rows.value }>()
    for (const row of rows.value) {
      const { groupId, groupName } = row.property.expands ?? {}
      const id = groupId ? `id:${groupId}` : groupName ? `name:${groupName}` : 'unclassified'
      let group = grouped.get(id)
      if (!group) {
        group = { id, name: groupName || t(groupId ? 'PropertyRules.unnamedCategory' : 'PropertyRules.unclassified'), rows: [] }
        grouped.set(id, group)
      }
      group.rows.push(row)
    }
    return [...grouped.values()].map(group => ({ ...group,
      visibleRows: group.rows.slice(0, visibleCounts.value[group.id] ?? 30),
      remaining: Math.max(0, group.rows.length - (visibleCounts.value[group.id] ?? 30)),
    }))
  })
  // 搜索涵盖所有分类；大量同组属性只按需呈现摘要，不创建编辑表单。
  watch([() => groups.value.map(group => group.id).join('\0'), keyword, configuredOnly], () => {
    expandedGroups.value = groups.value.map(group => group.id)
    visibleCounts.value = {}
  }, { immediate: true })
  function showMore(groupId: string) {
    visibleCounts.value = { ...visibleCounts.value, [groupId]: (visibleCounts.value[groupId] ?? 30) + 30 }
  }
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
    void load()
  }, { immediate: true })
  watch(() => [route.query.ruleProperty, props.properties, loading.value], () => {
    if (!route.query.ruleProperty || loading.value || failed.value) return
    const property = props.properties.find((item) => propertyIdOf(item) === route.query.ruleProperty)
    if (property) {
      // Old deep links must reveal rows beyond the first chunk as well as collapsed categories.
      const group = groups.value.find(item => item.rows.some(row => row.id === propertyIdOf(property)))
      if (group) {
        if (!expandedGroups.value.includes(group.id)) expandedGroups.value.push(group.id)
        visibleCounts.value = { ...visibleCounts.value, [group.id]: Math.max(visibleCounts.value[group.id] ?? 30, group.rows.findIndex(row => row.id === propertyIdOf(property)) + 1) }
      }
      selected.value = property
      editorOpen.value = true
    }
  }, { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { loading, failed, keyword, configuredOnly, rows, groups, expandedGroups, showMore, canSave, selected, selectedRow, editorOpen, load, open, close }
}
