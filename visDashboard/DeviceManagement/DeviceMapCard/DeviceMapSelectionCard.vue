<template>
  <section
    v-if="view.visible"
    class="device-map-selection"
    :class="{ 'device-map-selection--floating': layout, 'device-map-selection--below': layout?.placement === 'below' }"
    :style="layout?.style"
    :aria-label="t(view.detailDevice ? 'components.DeviceMap.detail' : 'components.DeviceMap.nearby')"
    @click.stop
    @dblclick.stop
    @mousedown.stop
    @wheel.stop
  >
    <header class="device-map-selection__header">
      <a-button v-if="view.detailDevice && view.count > 1" type="text" size="small"
        :aria-label="t('components.DeviceMap.back')" @click="emit('back')">
        <ArrowLeftOutlined />
      </a-button>
      <div class="device-map-selection__heading">
        <div class="device-map-selection__name">
          <DeploymentUnitOutlined v-if="view.detailDevice" class="device-map-selection__icon" />
          <strong>{{ view.detailDevice
            ? view.detail?.deviceName || view.detailDevice.label || view.detailDevice.deviceId
            : t('components.DeviceMap.nearbyCount', { count: view.count }) }}</strong>
        </div>
        <a-badge v-if="view.detailDevice" :color="view.detailStatus.color" :text="view.detailStatus.text" />
      </div>
      <a-button class="device-map-selection__close" type="text" size="small"
        :aria-label="t('components.DeviceMap.close')" @click="emit('close')">
        <CloseOutlined />
      </a-button>
    </header>

    <div v-if="view.detailDevice ? view.detailError : view.error" class="device-map-selection__message" role="alert">
      <span>{{ t(view.detailDevice ? 'components.DeviceMap.detailError' : 'components.DeviceMap.stateError') }}</span>
      <a-button size="small" @click="view.detailDevice ? emit('retryDetail') : emit('retryStates')">
        {{ t('components.DeviceMap.retry') }}
      </a-button>
    </div>

    <a-spin v-if="view.detailDevice" :spinning="view.detailLoading">
      <div class="device-map-selection__body">
        <a-descriptions v-if="!view.detailError" :column="1" size="small" class="device-map-selection__details">
          <a-descriptions-item v-for="field in view.detailFields" :key="field.label" :label="field.label">
            <a-typography-text v-if="field.copyable" :copyable="{ text: field.value }">
              {{ field.value }}
              <template #copyableTooltip="{ copied }">
                {{ t(copied ? 'components.DeviceMap.copied' : 'components.DeviceMap.copyId') }}
              </template>
            </a-typography-text>
            <j-ellipsis v-else :title="field.value">{{ field.value }}</j-ellipsis>
          </a-descriptions-item>
        </a-descriptions>
        <div class="device-map-selection__coordinate">
          <EnvironmentOutlined />{{ view.detailDevice.lnglat.join(', ') }}
        </div>
      </div>
    </a-spin>

    <template v-else>
      <a-input-search :value="view.keyword" allow-clear :placeholder="t('components.DeviceMap.search')"
        class="device-map-selection__search" @update:value="emit('search', $event)" />
      <a-spin :spinning="view.loading">
        <CloudEmpty v-if="!view.rows.length" :description="t('components.DeviceMap.noMatches')" />
        <ul v-else class="device-map-selection__list">
          <li v-for="device in view.rows" :key="device.deviceId">
            <button type="button" class="device-map-selection__device" @click="emit('select', device)">
              <span class="device-map-selection__identity">
                <strong :title="device.label">{{ device.label || device.deviceId }}</strong>
                <span :title="device.deviceId">{{ device.deviceId }}</span>
              </span>
              <a-badge :status="device.badge" :text="view.loading ? t('components.DeviceMap.loadingState') : device.stateText" />
              <RightOutlined />
            </button>
          </li>
        </ul>
      </a-spin>
      <a-pagination v-if="view.total > view.pageSize" size="small" simple :current="view.page"
        :page-size="view.pageSize" :total="view.total" :show-size-changer="false"
        class="device-map-selection__pagination" @change="emit('page', $event)" />
    </template>

    <footer v-if="view.detailDevice && view.hasDetailRoute" class="device-map-selection__actions">
      <a-button type="primary" block :disabled="!view.canOpenDetail" :loading="view.openingDetail" @click="emit('openDetail')">
        {{ t('components.DeviceMap.openDetail') }}<ArrowRightOutlined />
      </a-button>
    </footer>
    <footer v-else-if="view.count > 1" class="device-map-selection__footer">
      <InfoCircleOutlined /><span>{{ t('components.DeviceMap.tooClose', { count: view.count }) }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeftOutlined, ArrowRightOutlined, CloseOutlined, DeploymentUnitOutlined, EnvironmentOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { DeviceMapSelectionView } from '../hooks/useDeviceMapSelection'
import type { DeviceMapPopupLayout } from '../hooks/useDeviceMapViewport'
import type { DeviceMapPoint } from '../shared'

// 摘要与同坐标选择共用一个纯展示组件；地图 SDK 的定位样式由宿主传入。
defineProps({
  view: { type: Object as PropType<DeviceMapSelectionView>, required: true },
  layout: { type: Object as PropType<DeviceMapPopupLayout>, default: undefined },
})
const emit = defineEmits<{
  close: []
  back: []
  search: [value: string]
  page: [value: number]
  select: [device: DeviceMapPoint]
  retryStates: []
  retryDetail: []
  openDetail: []
}>()
const { t } = useI18n()
</script>

<style scoped lang="less" src="./DeviceMapSelectionCard.less"></style>
