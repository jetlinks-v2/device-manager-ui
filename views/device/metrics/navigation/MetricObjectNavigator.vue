<template>
  <div class="metric-object-navigation">
    <a-input-search v-model:value="state.keyword.value" :placeholder="t('DeviceMetrics.searchObjects')" allow-clear @search="state.search" />
    <a-alert v-if="state.error.value" type="error" :message="t('DeviceMetrics.objectLoadError')">
      <template #action><a-button size="small" @click="state.retry">{{ t('DeviceMetrics.retry') }}</a-button></template>
    </a-alert>
    <a-spin :spinning="state.loading.value">
      <a-tree v-if="tree && state.visibleNodes.value.length" :tree-data="state.visibleNodes.value" :field-names="{ key: 'ownerId', title: 'label' }" :selected-keys="selectedId ? [selectedId] : []" block-node default-expand-all @select="selectTree" />
      <ul v-else-if="!tree && state.nodes.value.length" class="metric-object-navigation__list">
        <li v-for="node in state.nodes.value" :key="node.ownerId">
          <button type="button" :aria-pressed="selectedId === node.ownerId" :disabled="state.loading.value || state.error.value" @click="state.select(node.ownerId)">{{ node.label }}</button>
        </li>
      </ul>
      <a-empty v-else-if="!state.loading.value && !state.error.value" :description="t('DeviceMetrics.noObjects')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    </a-spin>
    <a-pagination v-if="!tree && state.total.value > 20" size="small" :current="state.page.value" :total="state.total.value" :page-size="20" :show-size-changer="false" @change="state.changePage" />
  </div>
</template>
<script setup lang="ts">
import { toRef } from 'vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { MetricObjectSelection } from '@jetlinks-web-core/components'
import { useMetricNavigator, type MetricNavigationQuery } from './useMetricNavigator'
const props = defineProps<{ selectedId?: string; tree?: boolean; query: MetricNavigationQuery }>()
const emit = defineEmits<{ select: [selection?: MetricObjectSelection] }>()
const { t } = useI18n()
const state = useMetricNavigator(props.query, toRef(props, 'selectedId'), selection => emit('select', selection), props.tree)
function selectTree(keys: (string | number)[]) { if (keys.length) state.select(String(keys[0])) }
</script>
<style scoped>
.metric-object-navigation { display: grid; align-content: start; gap: 12px; min-width: 0; }
.metric-object-navigation__list { list-style: none; margin: 0; padding: 0; }
.metric-object-navigation__list button { width: 100%; text-align: left; border: 0; background: transparent; padding: 10px 12px; border-radius: 4px; cursor: pointer; overflow-wrap: anywhere; }
.metric-object-navigation__list button:hover, .metric-object-navigation__list button[aria-pressed="true"] { background: var(--ant-primary-color-deprecated-bg, #e6f7ff); }
.metric-object-navigation__list button[aria-pressed="true"] { color: var(--ant-primary-color, #1677ff); }
.metric-object-navigation :deep(.ant-spin-nested-loading) { max-height: min(60vh, 600px); overflow: auto; }
@media (max-width: 760px) { .metric-object-navigation :deep(.ant-spin-nested-loading) { max-height: 220px; } }
</style>
