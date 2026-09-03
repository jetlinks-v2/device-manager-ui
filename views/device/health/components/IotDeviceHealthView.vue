<template>
  <section class="iot-health" :aria-label="$t('IotHealthPage.aria')">
    <PageHeader
        :title="$t('IotWorkbench.route.health')"
    >
              <div class="iot-health__actions">
                <a-segmented v-model:value="activeWindow" :options="windowOptions" />
              </div>
    </PageHeader>
<!--    <header class="iot-health__hero">-->
<!--      <h1>{{ $t('IotWorkbench.route.health') }}</h1>-->

<!--    </header>-->

    <a-alert v-if="error" class="iot-health__alert" type="error" :message="error" show-icon />

    <a-spin :spinning="loading">
      <CloudEmpty type="page" v-if="!loading && !hasDevices" :description="$t('IotHealthPage.empty')" />
      <template v-else>
        <EqualHeightColumns
          v-if="selected"
          class="iot-health__layout"
          height="calc(100vh - 9rem)"
          left-width="15rem"
          right-width="1fr"
        >
          <template #left>
            <IotHealthTree
              :nodes="treeNodes"
              :summary="averageSummary"
              :selected-device-id="selectedDeviceId"
              @select="selectDevice"
            />
          </template>
          <template #right>
            <IotHealthDetailPanel
              :item="selected"
              :tone="selectedTone"
              :dimensions="dimensions"
              :info-items="infoItems"
              :trend="trend"
              :trend-labels="trendLabels"
              :events="events"
              :alarms="alarms"
              :window-label="currentWindowLabel"
              :connection-label="connectionLabel(selected.device)"
              :connection-tone="connectionTone(selected.device)"
              :health-level="healthLevel(selected.score)"
            />
          </template>
        </EqualHeightColumns>
      </template>
    </a-spin>
  </section>
</template>

<script setup lang="ts">
import IotHealthDetailPanel from './IotHealthDetailPanel.vue'
import IotHealthTree from './IotHealthTree.vue'
import { useIotDeviceHealthPage } from '../hooks/useIotDeviceHealthPage'
import { PageHeader } from '@jetlinks-web-core/components'

const {
  activeWindow,
  alarms,
  averageSummary,
  connectionLabel,
  connectionTone,
  currentWindowLabel,
  dimensions,
  error,
  events,
  hasDevices,
  healthLevel,
  infoItems,
  loading,
  selectDevice,
  selected,
  selectedDeviceId,
  selectedTone,
  treeNodes,
  trend,
  trendLabels,
  windowOptions,
} = useIotDeviceHealthPage()
</script>

<style scoped>
.iot-health {
  --iot-health-layout-offset: 10.75rem;
  display: grid;
  min-width: 0;
}

.iot-health__breadcrumb {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
}

.iot-health__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.iot-health__hero h1 {
  margin: 0;
  color: var(--jet-theme-text-title);
  font-size: var(--fs-h1);
  font-weight: 700;
}

.iot-health__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.iot-health__alert {
  width: 100%;
}

.iot-health__layout {
  min-height: 0;
}

.iot-health__layout :deep(.equal-height-columns__pane) {
  min-height: 0 !important;
  overflow: hidden;
}

@media (max-width: 75rem) {
  .iot-health__layout {
    grid-template-columns: 1fr;
    height: auto;
  }

  .iot-health__layout :deep(.equal-height-columns__pane) {
    height: auto;
    min-height: 0 !important;
  }
}

@media (max-width: 48rem) {
  .iot-health {
    padding: var(--space-4);
  }

  .iot-health__actions {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>
