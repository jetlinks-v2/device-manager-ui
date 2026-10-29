<template>
  <div class="rule-alarm-inline">
    <a-tooltip :title="editor.resources.levelsFailed ? $t('PropertyRules.resourcesFailed') : $t('DeviceAlarm.form.level')">
      <a-dropdown :trigger="['click']" :disabled="!editor.editable" @open-change="$event && editor.resources.loadLevels()">
        <a-button type="text" size="small" class="rule-level-trigger" :aria-label="$t('DeviceAlarm.form.level')"><a-tag :color="levelTone(editor.draft!.alarm.level)" :title="levelLabel"><AIcon v-if="editor.resources.levelsLoading || editor.resources.levelsFailed" :type="editor.resources.levelsLoading ? 'LoadingOutlined' : 'ExclamationCircleOutlined'" :spin="editor.resources.levelsLoading" /><span class="rule-level-name">{{ levelLabel }}</span><AIcon type="DownOutlined" /></a-tag></a-button>
        <template #overlay><a-menu :selected-keys="[editor.draft!.alarm.level]"><a-menu-item v-for="option in editor.levelOptions" :key="option.value" @click="editor.draft!.alarm.level = option.value"><a-badge :status="levelTone(option.value)" />{{ option.label }}</a-menu-item></a-menu></template>
      </a-dropdown>
    </a-tooltip>
  </div>
</template>
<script setup lang="ts">
import { computed, type UnwrapNestedRefs } from 'vue'
import { useI18n } from 'vue-i18n'
import type { usePropertyRuleEditor } from './usePropertyRuleEditor'
import { levelTone } from '../../alarm/utils'
const props = defineProps<{ editor: UnwrapNestedRefs<ReturnType<typeof usePropertyRuleEditor>> }>()
const { t: $t } = useI18n()
const levelLabel = computed(() => props.editor.levelOptions.find(option => option.value === props.editor.draft!.alarm.level)?.label ?? String(props.editor.draft!.alarm.level))
</script>
<style scoped>
.rule-alarm-inline { display: flex; align-items: center; gap: var(--space-1); }
.rule-level-trigger { padding: 0; height: auto; }
.rule-level-trigger :deep(.ant-tag) { display: inline-flex; align-items: center; max-width: 72px; gap: 2px; margin: 0; padding-inline: var(--space-1); font-size: var(--fs-12); }
.rule-level-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-level-trigger :deep(.anticon) { flex-shrink: 0; font-size: 10px; }
@media (pointer: coarse) { .rule-level-trigger { min-height: 40px; } }
</style>
