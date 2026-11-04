<template>
  <section class="property-rules" :class="{ 'property-rules-detail': presentation === 'detail' }">
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
      <a-radio-group v-model:value="configurationFilter" :size="presentation === 'detail' ? 'default' : 'small'" button-style="solid">
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
              <template v-for="rowEditor in [editorFor(item.id)]" :key="item.id">
              <a-list-item class="property-rule-row" :class="{ 'property-rule-row-active': !!rowEditor, 'property-rule-row-configured': item.effects.length && item.rule.editable, 'property-rule-row-empty': rowEditor ? presentation === 'detail' && !rowEditor.steps.some(step => step.enabled) : !item.effects.length }">
                <div class="property-rule-header">
                <div class="property-rule-identity">
                  <div class="property-rule-identity-title"><span class="property-rule-name" :title="item.name">{{ item.name }}</span><PropertyRuleMetadata :property="item.property" /></div>
                  <template v-if="scope.deviceId && (item.raw || presentation === 'detail') && (presentation === 'detail' || !rowEditor)">
                    <a-tag v-for="source in [rowEditor ? rowEditor.displaySource : item.source]" :key="source" :color="source === 'device' ? 'blue' : undefined"><AIcon :type="source === 'disabled' ? 'StopOutlined' : source === 'device' ? 'HddOutlined' : 'CloudOutlined'" /> {{ $t(`PropertyRules.source.${source}`) }}</a-tag>
                  </template>
                  <span class="property-rule-id">{{ item.id }}</span>
                </div>
                <span class="property-rule-actions property-rule-action-group">
                  <PropertyRuleStatistics v-if="statisticsTargets.has(item.id)" :target="statisticsTargets.get(item.id)!" :entry="statistics.entries[item.id] ?? {}" :open="statistics.openProperty.value === item.id" :dirty="!!rowEditor?.pendingSave" :inherited="!!scope.deviceId && item.source === 'product'" @toggle="statistics.toggle(item.id, $event)" @refresh="statistics.refresh" />
                  <PropertyRuleActions v-if="rowEditor" :editor="rowEditor" :property="item.property" :scope="scope" :preview-request="previewRequest" :statistics-open="!!statistics.openProperty.value" @preview="statistics.close" />
                  <a-button v-else-if="item.effects.length && item.rule.editable" type="text" size="small" class="property-rule-preview" :aria-label="`${item.name} · ${$t('PropertyRules.diagram.show')}`" :disabled="busy" @click="previewProperty(item.property)"><AIcon type="PartitionOutlined" />{{ $t('PropertyRules.diagram.show') }}</a-button>
                </span>
                </div>
                <div class="property-rule-content">
                  <PropertyRuleFields v-if="rowEditor" :editor="rowEditor" :scope="scope" :property="item.property" :with-actions="false" :with-source="presentation !== 'detail'" :card="presentation === 'detail'" />
                  <div v-else class="property-rule-effects">
                    <a-button v-if="!item.rule.editable" type="text" size="small" @click="selectProperty(item.property)"><AIcon type="LockOutlined" /> {{ $t('PropertyRules.legacy') }}</a-button>
                    <PropertyRuleSummary v-else-if="item.effects.length" :rows="item.effects" interactive @edit="selectProperty(item.property)" />
                    <RuleAddMenu v-if="canSave && item.rule.editable && availableRuleParts(item.property, item.rule.nodes, alarmAvailable).length" :parts="availableRuleParts(item.property, item.rule.nodes, alarmAvailable)" :disabled="loading || busy" @add="selectProperty(item.property, $event)" />
                    <a-button v-else-if="item.rule.editable && !item.effects.length" type="text" size="small" @click="selectProperty(item.property)"><AIcon :type="canSave ? 'EditOutlined' : 'EyeOutlined'" />{{ $t(canSave ? 'PropertyRules.configure' : 'PropertyRules.view') }}</a-button>
                  </div>
                </div>
              </a-list-item>
              </template>
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
import { usePropertyRuleCards } from './cards/usePropertyRuleCards'
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
const props = defineProps<{ scope: RuleScope; properties: ThingModelProperty[]; presentation?: 'inline' | 'detail' }>()
const { t: $t } = useI18n()
const { loading, failed, keyword, configurationFilter, propertyRows, groups, expandedGroups, setExpandedGroup, showMore, canSave, sceneMenu, openScene, selected, selectedRow, editorOpen, load, open, close } = usePropertyRules(props)
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
// Product inline layout keeps one selected editor; device cards retain their own drafts below.
const editor = props.presentation === 'detail' ? undefined : reactive(usePropertyRuleEditor(reactive({
  open: editorOpen, scope: computed(() => props.scope), property: computed(() => selected.value ?? {}),
  snapshot: computed(() => selectedRow.value && { raw: selectedRow.value.raw, hasOverride: selectedRow.value.hasOverride }), inline: true,
}), () => close(false), async () => { await load(); statistics.reset() }))
const visibleRows = computed(() => groups.value.find(group => group.id === expandedGroups.value[0])?.visibleRows ?? [])
const cards = props.presentation === 'detail' ? usePropertyRuleCards(reactive({
  scope: computed(() => props.scope), rows: propertyRows, visibleRows, loading,
}), async () => { await load(); statistics.reset() }) : undefined
const busy = computed(() => cards?.saving.value ?? editor?.saving ?? false)
const alarmAvailable = computed(() => cards?.alarmAvailable.value ?? editor?.alarmAvailable ?? false)
function editorFor(id: string) {
  return cards ? cards.editors.get(id)?.editor : editorOpen.value && selectedId.value === id ? editor : undefined
}
async function selectProperty(property: ThingModelProperty, part?: RuleAddPart) {
  if (!editorOpen.value || selectedId.value !== propertyIdOf(property)) {
    if (!editor || !await editor.prepareLeave()) return false
    // Finish URL guards before creating the new draft; otherwise they see the new edits as an old draft.
    await open(property)
    await nextTick()
  }
  if (part) {
    // Choosing a rule on an inherited device row explicitly starts its local override.
    if (!editor?.custom) editor?.customize()
    editor?.addPart(part)
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
<style scoped lang="less">
.property-rules.property-rules-detail {
  padding: 0;
  border: 0;
  border-radius: 0;

  .property-rules-heading { margin-bottom: var(--space-4); }
  .property-rules-scope { font-size: var(--fs-16); font-weight: 600; }
  .property-rules-toolbar { gap: var(--space-3); margin-bottom: 0; padding-bottom: var(--space-4); }
  .property-rule-list :deep(.ant-list-items) { grid-template-columns: minmax(0, 1fr); gap: var(--panel-gap); }
  .property-rule-row { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); padding: var(--panel-padding); border: 1px solid var(--line); border-radius: var(--panel-radius); background: var(--panel-background); }
  .property-rule-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); grid-column: 1; grid-row: 1; }
  .property-rule-identity { display: grid; grid-template-columns: minmax(0, auto) auto; align-items: center; justify-content: start; gap: var(--space-1) var(--space-3); min-width: 0; }
  .property-rule-identity-title { grid-column: 1; gap: var(--space-2); }
  .property-rule-identity > .ant-tag { grid-column: 2; margin: 0; white-space: nowrap; }
  .property-rule-id { grid-column: 1 / -1; }
  .property-rule-name { white-space: normal; overflow-wrap: anywhere; }
  .property-rule-actions { flex: none; margin: 0; }
  .property-rule-content { grid-column: 1; grid-row: 2; }
  .property-rule-row-empty { row-gap: var(--space-2); }
  .property-rule-row-active { outline: none; }
  .property-rule-effects { padding-top: var(--space-1); }
  :deep(.rule-add-trigger) { height: 32px; padding-inline: var(--space-2); color: var(--jet-theme-primary); }
  :deep(.rule-summary) { max-width: 100%; }
  :deep(.rule-line) { --rule-control-height: 28px; --rule-row-height: 36px; font-size: var(--fs-14); }
  :deep(.rule-stage-lines) { gap: var(--space-2); }
  :deep(.rule-source) { padding-inline-end: 0; }
}

@container property-rules (min-width: 1100px) {
  .property-rules.property-rules-detail .property-rule-list :deep(.ant-list-items) { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; align-items: stretch; }
}

@container property-rules (max-width: 680px) {
  .property-rules.property-rules-detail {
    .property-rule-row { padding: var(--space-3) var(--space-2); }
    .property-rule-header { flex-wrap: wrap; align-items: flex-start; }
    .property-rule-identity { flex: 1 1 100%; }
    .property-rule-identity-title { flex-wrap: wrap; }
    .property-rule-actions { justify-content: flex-start; }
    .property-rule-group-count { margin-inline-start: 0; }
    .property-rule-group-name { flex-wrap: wrap; }
    .property-rules-scene { margin-inline-start: 0; }
  }
}
</style>
