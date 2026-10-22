<template>
  <section ref="host" class="device-overview-dashboard" :aria-label="t('IotDeviceDetail.overview.aria')">
    <div v-if="loading" class="device-overview-state"><a-spin /></div>
    <CloudEmpty v-else-if="errors.length" :description="t('deviceDetailDashboard.loadError')">
      <a-button @click="reload">{{ t('deviceDetailDashboard.retry') }}</a-button>
    </CloudEmpty>
    <DashBoardCanvas v-else :key="storageKey" :model-value="dashboard" :catalog="catalog"
      :editable="false" :layout-editable="true" :storage-key="storageKey" :preview-mode="false" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementSize } from '@vueuse/core'
import { DashBoardCanvas } from '@jetlinks-web-core/components/DashBoardCanvas'
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import type { IotDevice } from '../../types'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'
import { provideDeviceDetailContext } from '@device-manager-ui/visDashboard/DeviceDetail/hooks/context'
import { useDeviceDetailDashboard } from '@device-manager-ui/visDashboard/DeviceDetail/hooks/useDeviceDetailDashboard'
const props = defineProps({ device: { type: Object as PropType<IotDevice>, required: true }, properties: { type: Array as PropType<RealtimePropertyRow[]>, required: true } })
const { t } = useI18n(), host = ref<HTMLElement>()
const { width } = useElementSize(host)
const context = provideDeviceDetailContext(computed(() => props.device.id), computed(() => props.properties))
const { catalog, dashboard, storageKey, loading, errors, reload } = useDeviceDetailDashboard(context, width)
</script>
<style scoped>
.device-overview-dashboard { min-width: 0; width: 100%; }
.device-overview-state { display: grid; place-items: center; min-height: 20rem; }
.device-overview-dashboard :deep(.dashboard-card-layout), .device-overview-dashboard :deep(.dashboard-card-content) { height: auto; overflow: visible; }
.device-overview-dashboard :deep(.dashboard-grid) { min-height: 0; overflow-x: clip; overflow-y: visible; }
</style>
