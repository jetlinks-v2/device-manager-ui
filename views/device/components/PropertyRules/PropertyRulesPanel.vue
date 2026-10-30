<template>
  <section class="property-rules">
    <div class="property-rules-heading">
      <span class="property-rules-scope"><AIcon type="CloudUploadOutlined" /> {{ $t('PropertyRules.propertyReports') }}<RuleNotice kind="info" :message="$t('PropertyRules.help.processing')" :label="$t('PropertyRules.help.title')"><div class="property-rules-help"><strong>{{ $t('PropertyRules.help.title') }}</strong><p>{{ $t('PropertyRules.help.processing') }}</p><p>{{ $t(scope.deviceId ? 'PropertyRules.help.device' : 'PropertyRules.help.product') }}</p></div></RuleNotice></span>
      <span class="property-rules-scope-hint">{{ $t(scope.deviceId ? 'PropertyRules.scope.device' : 'PropertyRules.scope.product') }}</span>
      <a-popover v-if="sceneMenu" :trigger="['hover', 'focus']" placement="bottomRight">
        <template #content><p class="property-rules-scene-help">{{ $t('PropertyRules.scene.hint') }}</p></template>
        <a-button type="text" size="small" class="property-rules-scene" @click="openScene"><AIcon type="ApartmentOutlined" />{{ $t('PropertyRules.scene.title') }}<AIcon type="ExportOutlined" /></a-button>
      </a-popover>
    </div>
    <div class="property-rules-toolbar">
      <a-input v-model:value="keyword" allow-clear :placeholder="$t('PropertyRules.search')" style="max-width: 280px">
        <template #prefix><AIcon type="SearchOutlined" /></template>
      </a-input>
      <a-radio-group v-model:value="configurationFilter" size="small" button-style="solid">
        <a-radio-button value="all">{{ $t('PropertyRules.allProperties') }}</a-radio-button>
        <a-radio-button value="configured">{{ $t('PropertyRules.configured') }}</a-radio-button>
        <a-radio-button value="unconfigured">{{ $t('PropertyRules.unconfigured') }}</a-radio-button>
      </a-radio-group>
    </div>
    <a-result v-if="failed" status="error" :title="$t('PropertyRules.loadFailed')">
      <template #extra><a-button @click="load">{{ $t('PropertyRules.retry') }}</a-button></template>
    </a-result>
    <a-spin v-else :spinning="loading">
      <a-empty v-if="!groups.length" :description="$t(keyword || configurationFilter !== 'all' ? 'PropertyRules.noMatches' : 'PropertyRules.noProperties')" />
      <a-collapse v-else :active-key="expandedGroups[0]" accordion ghost :destroy-inactive-panel="true" class="property-rule-groups" @change="setExpandedGroup">
        <a-collapse-panel v-for="group in groups" :key="group.id" collapsible="header" :show-arrow="false">
          <template #header>
            <span class="property-rule-group-name"><AIcon type="RightOutlined" :rotate="expandedGroups[0] === group.id ? 90 : 0" aria-hidden="true" /><AIcon type="FolderOutlined" /> {{ group.name }}<span class="property-rule-group-count">{{ $t('PropertyRules.group.configured', { configured: group.configured, total: group.total }) }}</span></span>
          </template>
          <a-list :data-source="group.visibleRows" class="property-rule-list">
            <template #renderItem="{ item }">
              <a-list-item :key="item.id" class="property-rule-row" :class="{ 'property-rule-row-active': editorOpen && selectedId === item.id, 'property-rule-row-configured': item.effects.length && item.rule.editable, 'property-rule-row-empty': !item.effects.length && !(editorOpen && selectedId === item.id) }">
                <div class="property-rule-header">
                <div class="property-rule-identity">
                  <div class="property-rule-identity-title"><span class="property-rule-name" :title="item.name">{{ item.name }}</span><PropertyRuleMetadata :property="item.property" /></div>
                  <a-tag v-if="scope.deviceId && item.raw && !(editorOpen && selectedId === item.id)" :color="item.source === 'device' ? 'blue' : undefined"><AIcon :type="item.source === 'disabled' ? 'StopOutlined' : item.source === 'device' ? 'HddOutlined' : 'CloudOutlined'" /> {{ $t(`PropertyRules.source.${item.source}`) }}</a-tag>
                  <span class="property-rule-id">{{ item.id }}</span>
                </div>
                <span class="property-rule-actions property-rule-action-group">
                  <PropertyRuleStatistics v-if="statisticsTargets.has(item.id)" :target="statisticsTargets.get(item.id)!" :entry="statistics.entries[item.id] ?? {}" :open="statistics.openProperty.value === item.id" :dirty="editorOpen && selectedId === item.id && editor.pendingSave" :inherited="!!scope.deviceId && item.source === 'product'" @toggle="statistics.toggle(item.id, $event)" @refresh="statistics.refresh" />
                  <PropertyRuleActions v-if="editorOpen && selectedId === item.id" :editor="editor" :property="item.property" :scope="scope" :preview-request="previewRequest" :statistics-open="!!statistics.openProperty.value" @preview="statistics.close" />
                  <a-button v-else-if="item.effects.length && item.rule.editable" type="text" size="small" class="property-rule-preview" :aria-label="`${item.name} · ${$t('PropertyRules.diagram.show')}`" :disabled="editor.saving" @click="previewProperty(item.property)"><AIcon type="PartitionOutlined" />{{ $t('PropertyRules.diagram.show') }}</a-button>
                </span>
                </div>
                <div class="property-rule-content">
                  <PropertyRuleFields v-if="editorOpen && selectedId === item.id" :editor="editor" :scope="scope" :property="item.property" :with-actions="false" />
                  <div v-else class="property-rule-effects">
                    <a-button v-if="!item.rule.editable" type="text" size="small" @click="selectProperty(item.property)"><AIcon type="LockOutlined" /> {{ $t('PropertyRules.legacy') }}</a-button>
                    <PropertyRuleSummary v-else-if="item.effects.length" :rows="item.effects" interactive @edit="selectProperty(item.property)" />
                    <RuleAddMenu v-if="canSave && item.rule.editable && availableRuleParts(item.property, item.rule.nodes, editor.alarmAvailable).length" :parts="availableRuleParts(item.property, item.rule.nodes, editor.alarmAvailable)" :disabled="loading || editor.saving" @add="selectProperty(item.property, $event)" />
                    <a-button v-else-if="item.rule.editable && !item.effects.length" type="text" size="small" @click="selectProperty(item.property)"><AIcon :type="canSave ? 'EditOutlined' : 'EyeOutlined'" />{{ $t(canSave ? 'PropertyRules.configure' : 'PropertyRules.view') }}</a-button>
                  </div>
                </div>
              </a-list-item>
            </template>
          </a-list>
          <a-button v-if="group.remaining" type="link" @click="showMore(group.id)">
            <AIcon type="DownOutlined" /> {{ $t('PropertyRules.showMore', { count: group.remaining }) }}
          </a-button>
        </a-collapse-panel>
      </a-collapse>
    </a-spin>
  </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@jetlinks-web-core/store'
import { computed, nextTick, reactive, ref } from 'vue'
import type { ThingModelProperty } from '../../alarm/types'
import { propertyIdOf } from '../../alarm/utils'
import type { RuleScope } from './service'
import { usePropertyRules } from './usePropertyRules'
import { usePropertyRuleEditor } from './usePropertyRuleEditor'
import PropertyRuleFields from './PropertyRuleFields.vue'
import RuleAddMenu from './RuleAddMenu.vue'
import PropertyRuleSummary from './PropertyRuleSummary.vue'
import PropertyRuleMetadata from './PropertyRuleMetadata.vue'
import PropertyRuleActions from './PropertyRuleActions.vue'
import RuleNotice from './RuleNotice.vue'
import PropertyRuleStatistics from './statistics/PropertyRuleStatistics.vue'
import { useRuleStatistics } from './statistics/useRuleStatistics'
import { canReadStatistics, type StatisticsTarget } from './statistics/model'
import { availableRuleParts, type RuleAddPart } from './codec'
const props = defineProps<{ scope: RuleScope; properties: ThingModelProperty[] }>()
const { t: $t } = useI18n()
const { loading, failed, keyword, configurationFilter, groups, expandedGroups, setExpandedGroup, showMore, canSave, sceneMenu, openScene, selected, selectedRow, editorOpen, load, open, close } = usePropertyRules(props)
const selectedId = computed(() => propertyIdOf(selected.value ?? {}))
const previewRequest = ref(0)
const permission = useAuthStore()
const statisticsTargets = computed(() => {
  const rows = groups.value.find(group => group.id === expandedGroups.value[0])?.visibleRows ?? []
  return new Map(rows.filter(row => row.raw).map(row => [row.id, {
    property: row.id, source: row.source as StatisticsTarget['source'],
    permitted: canReadStatistics(row.source, props.scope, permission.hasPermission('device/Product:view')),
  }]))
})
const statistics = useRuleStatistics(reactive({ scope: computed(() => props.scope), targets: computed(() => [...statisticsTargets.value.values()]) }))
// Keep one editor outside the filtered/collapsed DOM so hiding a row never discards its draft.
const editor = reactive(usePropertyRuleEditor(reactive({
  open: editorOpen, scope: computed(() => props.scope), property: computed(() => selected.value ?? {}),
  snapshot: computed(() => selectedRow.value && { raw: selectedRow.value.raw, hasOverride: selectedRow.value.hasOverride }), inline: true,
}), () => close(false), async () => { await load(); statistics.reset() }))
async function selectProperty(property: ThingModelProperty, part?: RuleAddPart) {
  if (!editorOpen.value || selectedId.value !== propertyIdOf(property)) {
    if (!await editor.prepareLeave()) return false
    // Finish URL guards before creating the new draft; otherwise they see the new edits as an old draft.
    await open(property)
    await nextTick()
  }
  if (part) {
    // Choosing a rule on an inherited device row explicitly starts its local override.
    if (!editor.custom) editor.customize()
    editor.addPart(part)
  }
  return true
}
async function previewProperty(property: ThingModelProperty) {
  statistics.close()
  if (await selectProperty(property)) previewRequest.value++
}
</script>
<style scoped>
.property-rules { container: property-rules / inline-size; padding: var(--space-4); border: 1px solid var(--line); border-radius: 8px; }
.property-rule-action-group { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-1); }
.property-rules-heading { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-4); margin-bottom: var(--space-3); }
.property-rules-scope-hint { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.property-rules-scene { display: inline-flex; align-items: center; gap: var(--space-1); margin-inline-start: auto; color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.property-rules-scene :deep(.anticon + span), .property-rules-scene :deep(span + .anticon) { margin-inline-start: 0; }
.property-rules-scene-help { max-width: 280px; margin: 0; font-size: var(--fs-12); line-height: 1.7; }
.property-rules-help p { margin: var(--space-2) 0 0; }
.property-rules-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-4); padding-bottom: var(--space-3); margin-bottom: var(--space-2); border-bottom: 1px solid var(--line); }
.property-rules-scope, .property-rule-group-name { display: inline-flex; align-items: center; gap: var(--space-2); font-weight: 500; }
.property-rules-scope { white-space: nowrap; }
.property-rules-scope > :deep(.anticon) { color: var(--jet-theme-primary); }
.property-rule-group-count { margin-inline-start: var(--space-2); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); font-weight: normal; }
.property-rule-groups :deep(.ant-collapse-header) { padding-inline: 0 !important; }
.property-rule-groups :deep(.ant-collapse-header-text) { flex: none !important; width: auto; }
.property-rule-groups :deep(.ant-collapse-content-box) { padding: 0 0 var(--space-3) !important; }
.property-rule-list :deep(.ant-list-items) { display: grid; grid-template-columns: minmax(0, 1fr); column-gap: var(--space-6); align-items: stretch; }
.property-rule-row { display: grid; grid-template-columns: 208px minmax(0, 1fr); min-width: 0; justify-content: start; align-content: start; align-items: start; column-gap: var(--space-4); row-gap: var(--space-1); padding: var(--space-3) var(--space-2); }
.property-rule-header { display: contents; }
.property-rule-row-empty { align-items: center; padding-block: var(--space-2); }
.property-rule-row-active { background: var(--jet-theme-primary-soft); outline: 1px solid var(--line); border-radius: 6px; }
.property-rule-identity { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); min-width: 0; grid-column: 1; grid-row: 1 / 3; }
.property-rule-identity-title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1) var(--space-2); min-width: 0; max-width: 100%; }
.property-rule-name { font-weight: 500; overflow-wrap: anywhere; }
.property-rule-id, .property-rule-unit { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); font-weight: normal; overflow-wrap: anywhere; }
.property-rule-content { min-width: 0; grid-column: 2; grid-row: 1; }
.property-rule-row-active .property-rule-content, .property-rule-row-configured .property-rule-content { grid-row: 2; }
.property-rule-actions { grid-column: 2; grid-row: 1; justify-self: end; }
.property-rule-preview { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); padding-inline: var(--space-1); }
.property-rule-preview :deep(.anticon + span) { margin-inline-start: 0; }
.property-rule-preview:focus-visible { outline: 1px solid var(--jet-theme-primary); }
.property-rule-effects { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); color: var(--jet-theme-text-secondary); }
@container property-rules (min-width: 1360px) {
  .property-rule-list :deep(.ant-list-items) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .property-rule-row { grid-template-columns: minmax(0, 1fr); padding: var(--space-3); row-gap: var(--space-2); }
  .property-rule-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); grid-column: 1; grid-row: 1; }
  .property-rule-identity { flex: 1; }
  .property-rule-actions { flex-shrink: 0; margin-inline-start: auto; }
  .property-rule-content { grid-column: 1; grid-row: 2; }
  .property-rule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
}
@container property-rules (max-width: 680px) {
  .property-rule-row { grid-template-columns: minmax(0, 1fr); gap: var(--space-2); }
  .property-rule-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-2); grid-column: 1; grid-row: 1; }
  .property-rule-identity { flex: 1 1 160px; flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); }
  .property-rule-actions { margin-inline-start: auto; }
  .property-rule-content { grid-column: 1; grid-row: 2; }
}
</style>
