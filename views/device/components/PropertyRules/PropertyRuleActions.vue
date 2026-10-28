<template>
  <span ref="root" class="rule-actions" role="group" :aria-label="$t('PropertyRules.actionsFor', { name: property.name || property.id })">
    <a-popover v-if="hasRules" :open="diagram.open" :trigger="[]" placement="bottomRight" :destroy-tooltip-on-hide="true">
      <template #content>
        <div ref="panel" role="dialog" :aria-label="$t('PropertyRules.diagram.title')" @keydown.esc.stop.prevent="escape" @mouseenter="enterPanel" @mouseleave="leavePanel" @focusin="focusPanel" @focusout="blurPanel">
          <PropertyRuleDiagram v-if="diagram.open && editor.draft" :draft="editor.draft" :property="property" @close="escape" />
        </div>
      </template>
      <a-button ref="trigger" type="text" size="small" :aria-label="`${property.name || property.id} · ${$t('PropertyRules.diagram.show')}`" :aria-expanded="diagram.open" aria-haspopup="dialog" @click="toggleDiagram" @keydown.down.stop.prevent="focusDiagram" @keydown.esc.stop.prevent="escape"><AIcon type="PartitionOutlined" />{{ $t('PropertyRules.diagram.show') }}</a-button>
    </a-popover>
    <a-button v-if="canWrite && (editor.pendingSave || editor.saving)" type="text" size="small" :disabled="editor.saving" @click="editor.discard"><AIcon type="UndoOutlined" />{{ $t('PropertyRules.undo') }}</a-button>
    <a-button v-if="canWrite && (editor.pendingSave || editor.saveState !== 'idle')" type="text" size="small" class="rule-save" :class="`rule-save-${editor.saveState}`" :disabled="editor.saving || editor.saveState === 'saved'" :aria-label="savePresentation.text" @click="editor.save"><AIcon :type="savePresentation.icon" :spin="editor.saving" /><span aria-live="polite">{{ savePresentation.text }}</span></a-button>
    <a-dropdown v-if="canClear || editor.hasOverride && editor.canSave" :trigger="['click']" :disabled="editor.saving || editor.loading">
      <a-button type="text" size="small"><AIcon type="MoreOutlined" />{{ $t('PropertyRules.more') }}<AIcon type="DownOutlined" class="rule-more-arrow" /></a-button>
      <template #overlay><a-menu>
        <a-menu-item v-if="editor.hasOverride && editor.canSave" key="restore" @click="editor.restore"><AIcon type="RollbackOutlined" /> {{ $t('PropertyRules.restore') }}</a-menu-item>
        <a-menu-item v-if="canClear" key="clear" @click="editor.clear"><AIcon type="DeleteOutlined" /> {{ $t(scope.deviceId ? 'PropertyRules.clearDevice' : 'PropertyRules.clearProduct') }}</a-menu-item>
      </a-menu></template>
    </a-dropdown>
  </span>
</template>
<script setup lang="ts">
import { computed, watch, type UnwrapNestedRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ThingModelProperty } from '../../alarm/types'
import type { RuleScope } from './service'
import type { usePropertyRuleEditor } from './usePropertyRuleEditor'
import { useRuleActions } from './useRuleActions'
import PropertyRuleDiagram from './PropertyRuleDiagram.vue'
const props = defineProps<{ editor: UnwrapNestedRefs<ReturnType<typeof usePropertyRuleEditor>>; property: ThingModelProperty; scope: RuleScope; previewRequest?: number }>()
const { t: $t } = useI18n()
const { root, panel, trigger, diagram, showDiagram, enterPanel, leavePanel, focusPanel, blurPanel, escape, focusDiagram, toggleDiagram } = useRuleActions()
const hasRules = computed(() => props.editor.parsed.editable && props.editor.steps.some(step => step.enabled))
const canWrite = computed(() => props.editor.custom && props.editor.canSave && props.editor.parsed.editable)
const canClear = computed(() => props.editor.custom && props.editor.canSave && hasRules.value)
const savePresentation = computed(() => ({
  idle: { icon: 'SaveOutlined', text: $t('PropertyRules.saveShort') },
  dirty: { icon: 'SaveOutlined', text: $t('PropertyRules.saveShort') },
  saving: { icon: 'LoadingOutlined', text: $t('PropertyRules.saving') },
  saved: { icon: 'CheckCircleOutlined', text: $t('PropertyRules.savedShort') },
  error: { icon: 'ExclamationCircleOutlined', text: $t('PropertyRules.retry') },
})[props.editor.saveState])
// A list preview activates this one editor first; no diagrams or timers are created per property.
watch(() => props.previewRequest, () => { if (hasRules.value) showDiagram() }, { flush: 'post' })
</script>
<style scoped>
.rule-actions { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-1); min-width: 0; }
.rule-actions :deep(.ant-btn) { display: inline-flex; align-items: center; gap: var(--space-1); padding-inline: var(--space-1); font-size: var(--fs-12); color: var(--jet-theme-text-secondary); }
.rule-actions :deep(.ant-btn > .anticon + span) { margin-inline-start: 0; }
.rule-actions :deep(.ant-btn:not(:disabled):hover) { color: var(--jet-theme-primary); }
.rule-actions :deep(.ant-btn:focus-visible) { outline: 1px solid var(--jet-theme-primary); outline-offset: 1px; }
.rule-actions :deep(.ant-btn:disabled) { color: var(--jet-theme-text-disabled); }
.rule-actions .rule-save { min-width: 54px; justify-content: center; color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.rule-actions .rule-save-saved { color: var(--jet-theme-success); background: var(--success-bg); }
.rule-actions .rule-save-error { color: var(--jet-theme-error); background: var(--danger-bg); }
.rule-more-arrow { font-size: 10px; }
.rule-save-saved :deep(.anticon) { animation: rule-saved 180ms ease-out; }
@keyframes rule-saved { from { transform: scale(.7); } to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .rule-save-saved :deep(.anticon) { animation: none; } }
@media (pointer: coarse) { .rule-actions :deep(.ant-btn) { min-height: 40px; } }
</style>
