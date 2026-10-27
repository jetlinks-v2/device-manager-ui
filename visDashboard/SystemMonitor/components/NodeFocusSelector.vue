<template>
  <div class="node-focus">
    <span class="node-focus__count">{{ t('components.NodeFocus.nodes') }} <b>{{ value.length }}/{{ options.length }}</b></span>
    <div ref="summary" class="node-focus__preview">
      <div class="node-focus__measure" aria-hidden="true">
        <span v-for="option in selectedOptions" :key="option.value" class="node-focus__tag" data-node-measure>
          <i /><span>{{ option.label }}</span>
        </span>
        <a-button type="text" size="small" class="node-focus__more" data-more-measure>+{{ selectedOptions.length }}</a-button>
      </div>
      <a-tooltip v-for="option in preview" :key="option.value" :title="option.label">
        <span class="node-focus__tag"><i :style="{ backgroundColor: option.color }" /><span>{{ option.label }}</span></span>
      </a-tooltip>
      <a-button v-if="remaining && showMore" type="text" size="small" class="node-focus__more"
        :aria-label="t('components.NodeFocus.more', [remaining])" @click="open = true">+{{ remaining }}</a-button>
    </div>
    <a-popover v-model:open="open" trigger="click" placement="topRight">
      <template #content>
        <div class="node-focus-picker" @keydown.esc.stop="open = false">
          <div class="node-focus-picker__header">
            <strong>{{ t('components.NodeFocus.choose') }}</strong>
            <span>{{ t('components.NodeFocus.selected', [value.length, options.length]) }}</span>
            <a-button type="text" size="small" @click="open = false">{{ t('components.NodeFocus.close') }}</a-button>
          </div>
          <a-input v-model:value="keyword" allow-clear :placeholder="t('components.NodeFocus.search')" :aria-label="t('components.NodeFocus.search')" />
          <div class="node-focus-picker__actions">
            <a-button type="link" size="small" @click="selectAll">{{ t('components.NodeFocus.selectAll') }}</a-button>
            <a-button type="link" size="small" @click="emit('reset')">{{ t('components.NodeFocus.reset') }}</a-button>
          </div>
          <div class="node-focus-picker__list">
            <a-checkbox v-for="option in filtered" :key="option.value" class="node-focus-picker__option"
              :checked="selected.has(option.value)" @change="toggle(option.value, $event.target.checked)">
              <span class="node-focus-picker__item">
                <i :style="{ backgroundColor: option.color }" />
                <!-- 布局类由本组件原生元素承载，避免 Tooltip 根节点丢失 scoped 标记。 -->
                <span class="node-focus-picker__name"><j-ellipsis>{{ option.label }}</j-ellipsis></span>
                <span v-if="option.metric" class="node-focus-picker__metric">{{ option.metric }}<small v-if="option.detail">{{ option.detail }}</small></span>
              </span>
            </a-checkbox>
            <div v-if="!filtered.length" class="node-focus-picker__empty">{{ t('components.NodeFocus.noMatch') }}</div>
          </div>
        </div>
      </template>
      <a-button size="small" class="node-focus__choose" :aria-label="t('components.NodeFocus.choose')" :aria-expanded="open" aria-haspopup="dialog" @keydown.esc="open = false">
        {{ t('components.NodeFocus.choose') }} <AIcon type="DownOutlined" />
      </a-button>
    </a-popover>
  </div>
</template>
<script lang="ts" setup name="NodeFocusSelector">
import { ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NodeOption } from '../types'
import { useNodeFocusSelector } from '../hooks/useNodeFocusSelector'
const props = defineProps({
  value: { type: Array as PropType<string[]>, default: () => [] },
  options: { type: Array as PropType<NodeOption[]>, default: () => [] },
})
const emit = defineEmits<{ 'update:value': [value: string[]]; reset: [] }>()
const { t } = useI18n()
const summary = ref<HTMLElement>()
const { open, keyword, selected, selectedOptions, preview, remaining, showMore, filtered, toggle, selectAll } = useNodeFocusSelector(
  () => props.value, () => props.options, ids => emit('update:value', ids), summary,
)
</script>
<style scoped lang="less">
.node-focus { box-sizing: border-box; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding-top: 10px; min-height: 44px; border-top: 1px solid var(--line, #f0f0f0); }
.node-focus__count { white-space: nowrap; font-size: 12px; color: var(--ink-3, #86909c); }
.node-focus__count b { font-weight: 500; color: var(--ink-1, #1d2129); font-variant-numeric: tabular-nums; }
.node-focus__preview { position: relative; display: flex; align-items: center; min-width: 0; gap: 4px; overflow: hidden; }
.node-focus__measure { position: absolute; inset: 0 auto auto 0; display: flex; gap: 4px; width: 100%; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.node-focus__measure .node-focus__tag { flex: none; }
.node-focus__tag { flex: none; display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 190px; background: var(--bg-2, #f5f7fa); color: var(--ink-1, #1d2129); border-radius: 3px; padding: 2px 5px; font-size: 12px; line-height: 18px; }
.node-focus__tag > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.node-focus__tag i, .node-focus-picker__item i { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.node-focus__more { flex: none; font-size: 12px; padding: 0 4px; font-variant-numeric: tabular-nums; color: var(--ink-3, #86909c); background: var(--bg-2, #f5f7fa); }
.node-focus__choose { font-size: 12px; border-radius: 4px; }
.node-focus-picker { width: min(360px, calc(100vw - 64px)); color: var(--ink-1, #1d2129); }
.node-focus-picker__header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.node-focus-picker__header strong { font-size: 13px; font-weight: 500; }
.node-focus-picker__header > span { margin-left: auto; font-size: 12px; color: var(--ink-3, #86909c); }
.node-focus-picker__header :deep(.ant-btn) { font-size: 12px; color: var(--ink-3, #86909c); }
.node-focus-picker__actions { display: flex; gap: 8px; margin: 6px 0; }
.node-focus-picker__actions :deep(.ant-btn) { padding: 0; font-size: 12px; }
.node-focus-picker__list { max-height: 256px; overflow-y: auto; overscroll-behavior: contain; }
.node-focus-picker__option { box-sizing: border-box; display: flex; align-items: center; min-height: 44px; margin: 0; padding: 6px 4px; border-radius: 4px; }
.node-focus-picker__option:hover { background: var(--primary-1, #eef5ff); }
.node-focus-picker__option :deep(.ant-checkbox + span) { flex: 1; min-width: 0; padding-right: 0; }
.node-focus-picker__item { display: flex; align-items: center; gap: 7px; min-width: 0; }
.node-focus-picker__name { flex: 1; min-width: 0; font-size: 12px; }
.node-focus-picker__metric { flex: none; text-align: right; white-space: nowrap; font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.node-focus-picker__metric small { display: block; line-height: 14px; color: var(--ink-3, #86909c); font-size: 11px; }
.node-focus-picker__empty { padding: 20px 8px; text-align: center; color: var(--ink-3, #86909c); font-size: 12px; }
</style>
