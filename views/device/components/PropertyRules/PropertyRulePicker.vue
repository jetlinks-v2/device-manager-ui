<template>
  <a-popover v-model:open="open" trigger="click" placement="bottomRight" :destroy-tooltip-on-hide="true">
    <template #content>
      <div class="rule-property-picker" role="dialog" :aria-label="$t('PropertyRules.addProperty')" @keydown.esc="open = false">
        <a-input ref="searchInput" v-model:value="keyword" allow-clear :placeholder="$t('PropertyRules.search')">
          <template #prefix><AIcon type="SearchOutlined" /></template>
        </a-input>
        <div class="rule-property-options">
          <a-empty v-if="!matches.length" :description="$t(keyword ? 'PropertyRules.noMatches' : 'PropertyRules.noUnconfigured')" />
          <a-button v-for="row in matches.slice(0, limit)" :key="row.id" type="text" block class="rule-property-option" :disabled="disabled" @click="select(row.id)">
            <span class="rule-property-option-text"><strong>{{ row.name }}</strong><span>{{ row.id }}</span></span>
            <a-tag v-if="row.source === 'disabled'">{{ $t('PropertyRules.source.disabled') }}</a-tag>
            <AIcon type="PlusOutlined" />
          </a-button>
          <a-button v-if="matches.length > limit" type="link" block @click="limit += 30">{{ $t('PropertyRules.showMore', { count: matches.length - limit }) }}</a-button>
        </div>
      </div>
    </template>
    <a-button class="rule-property-add" :disabled="disabled || !rows.length"><template #icon><AIcon type="PlusOutlined" /></template>{{ $t('PropertyRules.addProperty') }}</a-button>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { usePropertyRules } from './usePropertyRules'
const props = defineProps<{ rows: ReturnType<typeof usePropertyRules>['unconfiguredRows']['value']; disabled?: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t: $t } = useI18n()
const open = ref(false)
const keyword = ref('')
const limit = ref(30)
const searchInput = ref<{ focus: () => void }>()
const matches = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return props.rows.filter(row => `${row.name} ${row.id}`.toLowerCase().includes(query))
})
watch(keyword, () => { limit.value = 30 })
watch(open, async value => {
  if (!value) return
  keyword.value = ''
  limit.value = 30
  await nextTick()
  searchInput.value?.focus()
})
watch(() => props.disabled, value => { if (value) open.value = false })
function select(id: string) {
  if (props.disabled) return
  emit('select', id)
  open.value = false
}
</script>
<style scoped>
.rule-property-add { height: 32px; margin-inline-start: auto; font-size: 14px; }
.rule-property-picker { width: min(360px, calc(100vw - 64px)); font-size: 14px; }
.rule-property-options { max-height: 320px; overflow-y: auto; margin-top: var(--space-2); }
.rule-property-option { display: flex; align-items: center; gap: var(--space-2); height: auto; min-height: 52px; padding: var(--space-2); text-align: start; }
.rule-property-option-text { display: flex; flex: 1; flex-direction: column; min-width: 0; overflow: hidden; }
.rule-property-option-text strong, .rule-property-option-text > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-property-option-text strong { font-weight: 500; font-size: 14px; }
.rule-property-option-text > span { color: var(--jet-theme-text-secondary); font-size: 12px; }
.rule-property-option :deep(.ant-tag) { margin: 0; }
</style>
