<template>
  <div
    class="device-map-card"
    :style="style"
  >
    <SectionHeader :title="title" />
    <div class="device-map-card__body">
      <a-spin
        :spinning="loading"
        :tip="t('components.DeviceMap.loading')"
        class="device-map-card__spin"
      >
        <div
          v-if="supportMessage"
          class="device-map-card__status error"
        >
          <CloudEmpty :description="supportMessage" />
        </div>
        <div
          v-else-if="error"
          class="device-map-card__status error"
        >
          <CloudEmpty :description="t('components.DeviceMap.loadError')">
            <a-button
              size="small"
              @click="refresh"
            >
              {{ t('components.DeviceMap.retry') }}
            </a-button>
          </CloudEmpty>
        </div>
        <div
          v-else-if="!points.length"
          class="device-map-card__status"
        >
          <CloudEmpty :description="t(isEdit ? 'components.DeviceMap.editPlaceholder' : 'components.DeviceMap.empty')" />
        </div>
        <a-map-component
          v-else
          class="device-map-card__map"
          @init="onMapInit"
        >
          <el-amap-marker-cluster
            :points="points"
            :extraOptions="extraOptions"
            @click="onClusterClick"
          />
        </a-map-component>
        <DeviceMapSelectionCard
          :view="selection.view"
          @close="selection.close"
          @back="selection.closeDetail"
          @search="selection.search"
          @page="selection.changePage"
          @select="selection.selectDevice"
          @retry-states="selection.refreshStates"
          @retry-detail="selection.refreshDetail"
        />
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import { computed, toRef, type CSSProperties, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElAmapMarkerCluster } from '@vuemap/vue-amap'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import SectionHeader from '../components/SectionHeader.vue'
import { useDeviceMap } from '../hooks/useDeviceMap'
import DeviceMapSelectionCard from './DeviceMapSelectionCard.vue'
import type { DashboardCardInfo } from '../shared'

defineOptions({
  name: 'DeviceMapCard'
})

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<CSSProperties>,
    default: () => ({})
  },
  isEdit: { type: Boolean, default: false }
})

const infoRef = toRef(props, 'info')
const isEditRef = toRef(props, 'isEdit')
const system = useSystemStore()
const { t } = useI18n()

const hasMapKey = computed(() => !!system.systemInfo.amap?.apiKey)
const supportMessage = computed(() => {
  if (!hasMapKey.value) {
    return t('components.DeviceMap.missingKey')
  }

  if (!isNoCommunity) {
    return t('components.DeviceMap.unsupported')
  }

  return ''
})

const isMapEnabled = computed(() => !supportMessage.value)

const { config, points, loading, error, extraOptions, selection, refresh, onMapInit, onClusterClick } = useDeviceMap(
  infoRef,
  isEditRef,
  isMapEnabled
)
const title = computed(() =>
  !config.value.topTitle || config.value.topTitle === '设备地图'
    ? t('components.DeviceMap.title')
    : config.value.topTitle
)
</script>

<style scoped lang="less">
.device-map-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;
  background-color: var(--bg, #fff);
}

.device-map-card__body {
  position: relative;
  flex: 1;
  min-height: 320px;
}

.device-map-card__spin,
.device-map-card__spin :deep(.ant-spin-container),
.device-map-card__map {
  width: 100%;
  height: 100%;
}

.device-map-card__status {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.device-map-card__status.error {
  color: #ff4d4f;
}
</style>

<style lang="less">
.device-dashboard-cluster {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 3px solid rgb(255 255 255 / 85%);
  border-radius: 50%;
  background: var(--ant-primary-color, #1677ff);
  color: #fff;
  box-shadow: 0 2px 8px rgb(0 0 0 / 20%);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.device-dashboard-marker-content {
  position: relative;

  .device-dashboard-marker-label {
    position: absolute;
    top: 0;
    left: 50%;
    width: 120px;
    padding: 4px 8px;
    overflow: hidden;
    text-align: center;
    word-break: break-all;
    vertical-align: bottom;
    background-color: #fff;
    border-radius: 4px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
    transform: translate(-50%, -120%);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
}
</style>
