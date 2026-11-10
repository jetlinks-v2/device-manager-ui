<template>
  <a-modal open centered :width="880" :footer="null" :style="{ maxWidth: 'calc(100vw - 2rem)' }" class="gateway-outline-modal" @cancel="emit('closeDrawer')">
    <template #title>
      <div class="gateway-outline__title">
        <strong>{{ name }}</strong>
        <a-tag color="blue">{{ providerName }}</a-tag>
        <a-badge v-if="state" :status="status" :text="state.text || t('GatewayEditor.unconfigured')" />
      </div>
    </template>
    <div class="gateway-outline__body">
      <a-spin :spinning="loading">
        <a-alert v-if="hasError" type="warning" show-icon :message="t('GatewayOutline.partialError')" class="gateway-outline__error">
          <template #action><a-button type="link" size="small" @click="reload">{{ t('GatewayOutline.retry') }}</a-button></template>
        </a-alert>
        <OutlineSection v-for="section in sections" :key="section.key" :section="section" />
        <a-empty v-if="!loading && !sections.length && !hasError" :description="t('GatewayEditor.unconfigured')" />
      </a-spin>
    </div>
  </a-modal>
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import OutlineSection from './components/OutlineSection.vue'
import { useGatewayOutline } from './useGatewayOutline'
import type { GatewayRecord } from './types'
const props = defineProps({
  data: { type: Object as PropType<GatewayRecord>, default: () => ({}) },
  draft: { type: Boolean, default: false },
})
const emit = defineEmits<{ closeDrawer: [] }>()
const { t, loading, name, providerName, state, status, sections, hasError, reload } = useGatewayOutline(props)
</script>
<style scoped>
.gateway-outline__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding-right: var(--space-6); }
.gateway-outline__title strong { min-width: 0; max-width: 100%; overflow-wrap: anywhere; font-size: var(--fs-16); }
.gateway-outline__title .ant-tag { margin: 0; white-space: normal; overflow-wrap: anywhere; }
.gateway-outline__title .ant-badge { flex-shrink: 0; font-weight: 400; }
.gateway-outline__body { min-height: 6rem; max-height: calc(100vh - 12rem); min-width: 0; overflow-y: auto; overflow-x: hidden; padding-right: var(--space-2); }
.gateway-outline__error { margin-bottom: var(--space-4); }
@media (max-width: 575px) {
  .gateway-outline__body { max-height: calc(100vh - 14rem); padding-right: 0; }
}
</style>
