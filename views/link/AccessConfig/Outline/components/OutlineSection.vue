<template>
  <ContentPanel :padding="0" :background="false" class="gateway-outline-section" :data-section="section.key">
    <template #title>
      <div class="gateway-outline-section__title">
        <span>{{ section.title }}</span>
        <a-tag v-if="section.tag">{{ section.tag }}</a-tag>
        <a-tag v-if="section.builtin" color="blue">{{ t('GatewayEditor.builtin') }}</a-tag>
      </div>
    </template>
    <KvGrid :items="section.rows" cols="stacked" cell-layout="inline" :gap="0" label-width="8rem" />
    <a-empty v-if="section.emptyChildren" :description="t('GatewayOutline.emptyChildren')" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
    <OutlineProtocol v-for="(document, index) in section.documents" :key="index" :document="document" :show-document="section.showDocument !== false" />
  </ContentPanel>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { Empty } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { ContentPanel } from '@jetlinks-web-core/components'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import OutlineProtocol from './OutlineProtocol.vue'
import type { OutlineSection } from '../types'
defineProps({ section: { type: Object as PropType<OutlineSection>, required: true } })
const { t } = useI18n()
</script>
<style scoped>
.gateway-outline-section { height: auto; min-width: 0; overflow: visible; margin-bottom: var(--space-6); }
.gateway-outline-section__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); font-size: var(--fs-14); font-weight: 600; }
.gateway-outline-section__title > span:first-child { border-left: 3px solid var(--primary-color); padding-left: var(--space-2); overflow-wrap: anywhere; }
.gateway-outline-section__title .ant-tag { max-width: 100%; margin: 0; white-space: normal; overflow-wrap: anywhere; }
.gateway-outline-section :deep(.kv-cell) { padding-block: var(--space-2); }
.gateway-outline-section :deep(.kv-cell dd) { text-align: right; white-space: pre-line; }
@media (max-width: 575px) {
  .gateway-outline-section :deep(.kv-cell) { grid-template-columns: 6rem minmax(0, 1fr); }
}
</style>
