<template>
  <section class="cv-model-panel">
    <a-alert
      v-if="errorMessage"
      show-icon
      type="error"
      :message="$t('GatewayCvModelPanel.loadFailed')"
      :description="errorMessage"
    />
    <a-alert
      v-else-if="!canReadModels"
      show-icon
      type="warning"
      :message="$t('GatewayCvModelPanel.offlineTitle')"
      :description="$t('GatewayCvModelPanel.offlineDescription')"
    />

    <a-spin :spinning="loading">
      <div class="cv-model-panel__body">
        <div
          class="cv-model-panel__toolbar"
          :class="{ 'cv-model-panel__toolbar--actions-only': !showOverview }"
        >
          <GatewayCvModelOverview v-if="showOverview" :summary="summary" />
          <div class="cv-model-panel__actions">
            <a-space wrap>
              <a-button
                type="primary"
                :disabled="!canBatchCheck"
                :loading="actionLoading"
                @click="batchCheckUpgrade"
              >
                <template #icon><AIcon type="SyncOutlined" /></template>
                {{ $t('GatewayCvModelPanel.batchCheck') }}
              </a-button>
            </a-space>
          </div>
        </div>

        <CloudEmpty
          v-if="!errorMessage && !items.length && !loading"
          :description="emptyDescription"
        />

        <div v-else class="cv-model-panel__grid">
          <GatewayCvModelCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :loading="actionLoading"
            @check-upgrade="checkUpgrade"
            @open-upgrade-diff="openUpgradeDiff"
            @upgrade="upgrade"
            @open-used-sources="openUsedSources"
            @open-versions="openVersions"
            @toggle-state="toggleModelState"
          />
        </div>
      </div>
    </a-spin>

    <GatewayCvModelUsedSourcesDrawer
      :open="usedSourcesOpen"
      :model="selectedModel"
      :usage="usage"
      :loading="usageLoading"
      @close="closeUsedSources"
    />
    <GatewayCvModelVersionDrawer
      :open="versionsOpen"
      :model="selectedModel"
      :loading="versionLoading || actionLoading"
      @close="closeVersions"
      @rollback="rollback"
      @clean="clean"
    />
    <GatewayCvModelUpgradeDiffDrawer
      :open="upgradeDiffOpen"
      :model="selectedModel"
      @close="closeUpgradeDiff"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import GatewayCvModelCard from './GatewayCvModelCard.vue'
import GatewayCvModelOverview from './GatewayCvModelOverview.vue'
import GatewayCvModelUpgradeDiffDrawer from './GatewayCvModelUpgradeDiffDrawer.vue'
import GatewayCvModelUsedSourcesDrawer from './GatewayCvModelUsedSourcesDrawer.vue'
import GatewayCvModelVersionDrawer from './GatewayCvModelVersionDrawer.vue'
import { useGatewayCvModels } from '../hooks/useGatewayCvModels'
import type { RuntimeGatewayDevice } from '../gatewayCvModel.types'

const props = defineProps({
  gateway: {
    type: Object as PropType<RuntimeGatewayDevice>,
    required: true,
  },
})

const { t: $t } = useI18n()
const canReadModels = computed(() => isGatewayOnline(props.gateway))
const emptyDescription = computed(() => !canReadModels.value
  ? $t('GatewayCvModelPanel.offlineEmpty')
  : $t('GatewayCvModelPanel.empty'))
const {
  loading,
  usageLoading,
  versionLoading,
  actionLoading,
  errorMessage,
  items,
  summary,
  canBatchCheck,
  selectedModel,
  usage,
  usedSourcesOpen,
  versionsOpen,
  upgradeDiffOpen,
  load,
  batchCheckUpgrade,
  openUsedSources,
  openVersions,
  closeUsedSources,
  closeVersions,
  openUpgradeDiff,
  closeUpgradeDiff,
  rollback,
  clean,
  checkUpgrade,
  upgrade,
  toggleModelState,
} = useGatewayCvModels(() => props.gateway)
const showOverview = computed(() => !errorMessage.value && (canReadModels.value || loading.value || items.value.length > 0))

onMounted(() => load())
// 父级会轮询替换 gateway 对象，只在关键身份或在线状态真实变化时重新读边端模型。
watch(
  [
    () => props.gateway.id,
    () => statusValue(props.gateway),
  ],
  () => load(true),
)

function statusValue(gateway?: RuntimeGatewayDevice) {
  const state = gateway?.state
  if (state && typeof state === 'object') return state.value
  return state
}

function isGatewayOnline(gateway?: RuntimeGatewayDevice) {
  return statusValue(gateway) === 'online'
}
</script>

<style scoped lang="less">
.cv-model-panel {
  display: grid;
  min-width: 0;
  gap: var(--space-4);
}

.cv-model-panel__body {
  display: grid;
  min-width: 0;
  gap: var(--space-4);
}

.cv-model-panel__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding-block: var(--space-2);
  border-top: var(--jet-theme-stroke-width) solid var(--jet-theme-border);
  border-bottom: var(--jet-theme-stroke-width) solid var(--jet-theme-border);
}

.cv-model-panel__toolbar--actions-only {
  display: flex;
  justify-content: flex-end;
  padding-block: 0;
  border-block: 0;
}

.cv-model-panel__actions {
  display: flex;
  justify-content: flex-end;
}

.cv-model-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

@media (max-width: 56.25rem) {
  .cv-model-panel__toolbar {
    grid-template-columns: 1fr;
  }

  .cv-model-panel__actions {
    justify-content: flex-start;
  }

  .cv-model-panel__grid {
    grid-template-columns: 1fr;
  }
}
</style>
