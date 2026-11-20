<template>
  <aside class="access-guide-doc">
    <header class="access-guide-doc__header">
      <strong>{{ $t(guideTab === 'guide' ? 'IotDeviceAccess.guide.tab' : 'IotDeviceAccess.protocol.tab') }}</strong>
      <a-segmented v-if="showAccessGuide" v-model:value="guideTab" size="small" :options="documentOptions" />
    </header>
    <div class="access-guide-doc__content">
      <template v-if="guideTab === 'guide' && showAccessGuide">
        <a-spin :spinning="accessGuideLoading">
          <div v-if="accessGuideDocument" class="access-guide-doc__body markdown-body" @click="$emit('guide-click', $event)">
            <div v-html="accessGuideDocument" />
          </div>
          <CloudEmpty v-else-if="!accessGuideLoading" class="access-guide-doc__empty"
            :description="accessGuideLoadFailed ? $t('IotDeviceAccess.guide.loadFailed') : $t('IotDeviceAccess.guide.empty')" />
        </a-spin>
      </template>
      <div v-else-if="protocolDocument" class="access-guide-doc__body markdown-body" v-html="protocolDocument" @click="$emit('protocol-click', $event)" />
      <CloudEmpty v-else class="access-guide-doc__empty" :description="$t('deviceDetailOptimization.protocolEmpty')" />
    </div>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
const props = defineProps({
  showAccessGuide: { type: Boolean, default: true },
  accessGuideDocument: { type: String, default: '' },
  accessGuideLoading: { type: Boolean, default: false },
  accessGuideLoadFailed: { type: Boolean, default: false },
  protocolDocument: { type: String, default: '' },
})
defineEmits<{
  (e: 'guide-click', event: MouseEvent): void
  (e: 'protocol-click', event: MouseEvent): void
}>()
const { t: $t } = useI18n()
const guideTab = ref<'guide' | 'protocol'>('protocol')
const documentOptions = computed(() => [
  { label: $t('IotDeviceAccess.protocol.tab'), value: 'protocol' },
  { label: $t('IotDeviceAccess.guide.tab'), value: 'guide' },
])
watch(() => props.showAccessGuide, enabled => { if (!enabled) guideTab.value = 'protocol' })
</script>
<style scoped>
.access-guide-doc { display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; border: 1px solid var(--jet-theme-border-secondary); border-radius: var(--r-2); background: var(--jet-theme-bg-container); }
.access-guide-doc__header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); flex-shrink: 0; padding: var(--space-4); border-bottom: 1px solid var(--jet-theme-border-secondary); }
.access-guide-doc__header strong { color: var(--jet-theme-text); font-size: var(--fs-14); }
.access-guide-doc__content { flex: 1; min-height: 0; overflow: auto; }
.access-guide-doc__body { padding: var(--space-4); color: var(--jet-theme-text); font-size: var(--fs-14); overflow-wrap: anywhere; }
.access-guide-doc__body :deep(table) { width: 100%; }
.access-guide-doc__content :deep(.ant-spin-nested-loading), .access-guide-doc__content :deep(.ant-spin-container) { height: 100%; }
.access-guide-doc__empty { display: grid; place-content: center; min-height: 16rem; height: 100%; padding: var(--space-4); }
</style>
