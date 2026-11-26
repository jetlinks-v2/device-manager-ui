<template>
  <DefineSelectionCard v-slot="{ layout }">
    <DeviceMapSelectionCard
      :view="selection.view"
      :layout="layout"
      @close="selection.close"
      @back="selection.closeDetail"
      @search="selection.search"
      @page="selection.changePage"
      @select="selection.selectDevice"
      @retry-states="selection.refreshStates"
      @retry-detail="selection.refreshDetail"
      @open-detail="selection.openDetailPage"
    />
  </DefineSelectionCard>
  <div
    class="device-map-card"
    :class="{ 'device-map-card--embedded': config.embedded }"
    :style="style"
  >
    <SectionHeader v-if="!config.embedded" :title="title">
      <template #extra>
        <div v-if="distribution || config.showStatus" class="device-map-legend">
          <span v-for="state in legendStates" :key="state">
            <i :style="{ background: distributionColors[state] }" />
            {{ t(`components.DeviceMap.${state === 'unknown' ? 'unknownState' : state}`) }}
          </span>
        </div>
      </template>
    </SectionHeader>
    <div ref="container" class="device-map-card__body">
      <!-- 宿主提供标题栏时复用同一份实时图例，避免复制状态与颜色规则。 -->
      <Teleport v-if="config.embedded && (distribution || config.showStatus)"
        :to="config.legendTarget || 'body'" :disabled="!config.legendTarget">
        <div class="device-map-legend" :class="{ 'device-map-legend--embedded': !config.legendTarget }">
          <span v-for="state in legendStates" :key="state"><i :style="{ background: distributionColors[state] }" />{{ t(`components.DeviceMap.${state === 'unknown' ? 'unknownState' : state}`) }}</span>
        </div>
      </Teleport>
      <a-spin
        :spinning="loading"
        :tip="t('components.DeviceMap.loading')"
        wrapper-class-name="device-map-card__spin"
      >
        <div
          v-if="configurationMessage"
          class="device-map-card__status error"
        >
          <CloudEmpty :description="configurationMessage">
            <MapConfigAction :can-configure="canConfigureMap" @configure="openMapConfig" />
          </CloudEmpty>
        </div>
        <div v-else-if="error && !points.length" class="device-map-card__status error">
          <CloudEmpty :description="t('components.DeviceMap.loadError')">
            <a-button size="small" @click="refresh">{{ t('components.DeviceMap.retry') }}</a-button>
          </CloudEmpty>
        </div>
        <DeviceDistributionMap v-else-if="distribution" :points="points" @select="onPointSelect" />
        <a-map-component
          v-else
          class="device-map-card__map"
          @init="onMapInit"
        >
          <template #error-guide="{ error: mapError }">
            <MapConfigAction :error="mapError" :can-configure="canConfigureMap" @configure="openMapConfig" />
          </template>
          <el-amap-marker-cluster
            v-if="points.length"
            :points="points"
            :extraOptions="extraOptions"
            @click="onClusterClick"
          />
          <ElAmapMarker v-if="selection.view.detailDevice" :position="selection.view.detailDevice.lnglat"
            anchor="center" :clickable="false" :z-index="300">
            <span class="device-map-card__selected-ring" />
          </ElAmapMarker>
          <ElAmapInfoWindow v-if="selection.view.visible" :position="selection.view.position"
            :visible="true" :is-custom="true" :auto-move="true" :avoid="[12, 12, 12, 12]"
            :anchor="popup.anchor" :offset="popup.offset" :close-when-click-map="true"
            @update:visible="!$event && selection.close()">
            <ReuseSelectionCard :layout="popup" />
          </ElAmapInfoWindow>
        </a-map-component>
        <a-alert
          v-if="isEdit && !configurationMessage && !loading && !error && !points.length"
          class="device-map-card__notice"
          type="info"
          show-icon
          :message="t('components.DeviceMap.editPlaceholder')"
        />
        <ReuseSelectionCard v-if="distribution" />
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import MapConfigAction from './MapConfigAction.vue'
import { computed, ref, toRef, type CSSProperties, type PropType } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { ElAmapInfoWindow, ElAmapMarker, ElAmapMarkerCluster } from '@vuemap/vue-amap'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import SectionHeader from '../components/SectionHeader.vue'
import { useDeviceMap } from '../hooks/useDeviceMap'
import DeviceMapSelectionCard from './DeviceMapSelectionCard.vue'
import DeviceDistributionMap from './DeviceDistributionMap.vue'
import { distributionColors, distributionState, type DistributionState } from './distribution'
import type { DashboardCardInfo } from '../shared'
import type { DeviceMapPopupLayout } from '../hooks/useDeviceMapViewport'

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
const container = ref<HTMLElement>()
// 两种底图共用同一摘要卡事件契约，高德模式交给原生信息窗定位和避让。
const [DefineSelectionCard, ReuseSelectionCard] = createReusableTemplate<{ layout?: DeviceMapPopupLayout }>()

const isMapEnabled = computed(() => {
  const { apiKey, secretKey } = system.systemInfo.amap || {}
  return !!(apiKey?.trim() && secretKey?.trim())
})
const { config, distribution, points, loading, error, extraOptions, selection, popup, refresh, onMapInit, onClusterClick, onPointSelect, canConfigureMap, openMapConfig } = useDeviceMap(
  infoRef,
  isEditRef,
  isMapEnabled,
  container,
)
const configurationMessage = computed(() => distribution.value || isMapEnabled.value ? '' : t('components.DeviceMap.missingKey'))
const legendStates = computed<DistributionState[]>(() => ['online', 'offline',
  ...(['disabled', 'unknown'] as const).filter(state => points.value.some(point => distributionState(point) === state)),
])
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

/* 嵌入宿主卡片时只提供地图内容，保持其他独立消费者的默认外观。 */
.device-map-card--embedded { padding: 0; background: transparent; }
.device-map-card--embedded .device-map-card__body { min-height: 0; }

.device-map-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px 12px; font-size: 12px; color: var(--ant-color-text-secondary, #64748b); }
.device-map-legend > span { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.device-map-legend i { width: 7px; height: 7px; border-radius: 50%; }
.device-map-legend--embedded { position: absolute; z-index: 300; top: 8px; right: 8px; padding: 4px 8px; border-radius: 4px; background: var(--ant-color-bg-container, #fff); pointer-events: none; }

/* Spin 的满高样式绑定外层容器，避免内容高度随转圈结束归零。 */
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

.device-map-card__notice {
  position: absolute;
  top: var(--space-3, 12px);
  right: var(--space-3, 12px);
  left: var(--space-3, 12px);
  z-index: 200;
}

.device-map-card__selected-ring {
  display: block;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--ant-primary-color, var(--accent));
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
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
.device-dashboard-marker-dot { display: block; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; box-sizing: border-box; box-shadow: 0 1px 4px rgb(0 0 0 / 25%); }
</style>
