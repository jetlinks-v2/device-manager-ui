<template>
  <aside class="access-guide-doc">
    <div class="access-guide-doc__sticky">
      <a-tabs
        v-model:activeKey="guideTab"
        class="access-guide-doc__tabs"
        size="small"
      >
        <a-tab-pane key="guide" :tab="$t('IotDeviceAccess.guide.tab')">
          <a-spin :spinning="accessGuideLoading">
            <div
              v-if="accessGuideDocument"
              class="access-guide-doc__body markdown-body"
              @click="$emit('guide-click', $event)"
            >
              <div v-html="accessGuideDocument" />
            </div>
            <CloudEmpty
              v-else-if="!accessGuideLoading"
              class="access-guide-doc__empty"
              :description="accessGuideLoadFailed ? $t('IotDeviceAccess.guide.loadFailed') : $t('IotDeviceAccess.guide.empty')"
            />
            <div v-else class="access-guide-doc__empty" />
          </a-spin>
        </a-tab-pane>
        <a-tab-pane
          v-if="protocolDocument"
          key="protocol"
          :tab="$t('IotDeviceAccess.protocol.tab')"
        >
          <div
            class="access-guide-doc__body markdown-body"
            v-html="protocolDocument"
            @click="$emit('protocol-click', $event)"
          />
        </a-tab-pane>
      </a-tabs>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps({
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
const guideTab = ref<'guide' | 'protocol'>('guide')
</script>

<style scoped>
.access-guide-doc {
  min-width: 0;
}

.access-guide-doc__sticky {
  position: sticky;
  top: 0;
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius);
  background: var(--jet-theme-bg-container);
  padding: var(--space-3);
}

.access-guide-doc__tabs :deep(.ant-tabs-nav) {
  margin-bottom: var(--space-3);
}

.access-guide-doc__body,
.access-guide-doc__empty {
  max-height: 32.5rem;
  overflow: auto;
  font-size: var(--fs-14);
}

.access-guide-doc__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 16rem;
}
</style>
