<template>
  <section
    v-if="view.visible"
    class="device-map-selection"
    :aria-label="t('components.DeviceMap.nearby')"
  >
    <header class="device-map-selection__header">
      <a-button
        v-if="view.detailDevice && view.count > 1"
        type="text"
        size="small"
        :aria-label="t('components.DeviceMap.back')"
        @click="emit('back')"
      >
        <ArrowLeftOutlined />
      </a-button>
      <strong>
        {{
          view.detailDevice
            ? t('components.DeviceMap.detail')
            : t('components.DeviceMap.nearbyCount', { count: view.count })
        }}
      </strong>
      <a-button
        class="device-map-selection__close"
        type="text"
        size="small"
        :aria-label="t('components.DeviceMap.close')"
        @click="emit('close')"
      >
        <CloseOutlined />
      </a-button>
    </header>

    <div
      v-if="view.detailDevice ? view.detailError : view.error"
      class="device-map-selection__message"
      role="alert"
    >
      <span>{{ t(view.detailDevice ? 'components.DeviceMap.detailError' : 'components.DeviceMap.stateError') }}</span>
      <a-button
        size="small"
        @click="view.detailDevice ? emit('retryDetail') : emit('retryStates')"
      >
        {{ t('components.DeviceMap.retry') }}
      </a-button>
    </div>

    <template v-if="view.detailDevice">
      <div class="device-map-selection__detail-name">
        {{ view.detail?.deviceName || view.detailDevice.label || view.detailDevice.deviceId }}
      </div>
      <div class="device-map-selection__coordinate">{{ view.detailDevice.lnglat.join(', ') }}</div>
      <a-spin :spinning="view.detailLoading">
        <a-descriptions
          v-if="!view.detailError"
          :column="1"
          size="small"
          class="device-map-selection__details"
        >
          <a-descriptions-item
            v-for="field in view.detailFields"
            :key="field.label"
            :label="field.label"
          >
            {{ field.value }}
          </a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </template>

    <template v-else>
      <a-input-search
        :value="view.keyword"
        allow-clear
        :placeholder="t('components.DeviceMap.search')"
        class="device-map-selection__search"
        @update:value="emit('search', $event)"
      />
      <a-spin :spinning="view.loading">
        <a-empty
          v-if="!view.rows.length"
          :description="t('components.DeviceMap.noMatches')"
        />
        <ul
          v-else
          class="device-map-selection__list"
        >
          <li
            v-for="device in view.rows"
            :key="device.deviceId"
          >
            <button
              type="button"
              class="device-map-selection__device"
              @click="emit('select', device)"
            >
              <span class="device-map-selection__identity">
                <strong :title="device.label">{{ device.label || device.deviceId }}</strong>
                <span :title="device.deviceId">{{ device.deviceId }}</span>
              </span>
              <a-badge
                :status="device.badge"
                :text="view.loading ? t('components.DeviceMap.loadingState') : device.stateText"
              />
              <RightOutlined />
            </button>
          </li>
        </ul>
      </a-spin>
      <a-pagination
        v-if="view.total > view.pageSize"
        size="small"
        simple
        :current="view.page"
        :page-size="view.pageSize"
        :total="view.total"
        :show-size-changer="false"
        class="device-map-selection__pagination"
        @change="emit('page', $event)"
      />
    </template>

    <footer
      v-if="view.count > 1"
      class="device-map-selection__footer"
    >
      <InfoCircleOutlined />
      <span>{{ t('components.DeviceMap.tooClose', { count: view.count }) }}</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeftOutlined, CloseOutlined, InfoCircleOutlined, RightOutlined } from '@ant-design/icons-vue'
import type { DeviceMapSelectionView } from '../hooks/useDeviceMapSelection'
import type { DeviceMapPoint } from '../shared'

defineProps({ view: { type: Object as PropType<DeviceMapSelectionView>, required: true } })
const emit = defineEmits<{
  close: []
  back: []
  search: [value: string]
  page: [value: number]
  select: [device: DeviceMapPoint]
  retryStates: []
  retryDetail: []
}>()
const { t } = useI18n()
</script>

<style scoped lang="less">
.device-map-selection {
  position: absolute;
  z-index: 20;
  top: 12px;
  right: 12px;
  width: 360px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text, #1f2329);
  background: var(--bg, #fff);
  border: 1px solid var(--border-color, #e5e6eb);
  border-radius: var(--r-3, 8px);
  box-shadow: 0 6px 24px rgb(0 0 0 / 16%);
}
.device-map-selection > :deep(.ant-spin-nested-loading) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.device-map-selection > :not(.ant-spin-nested-loading) {
  flex-shrink: 0;
}
.device-map-selection__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #e5e6eb);
}
.device-map-selection__header strong {
  flex: 1;
}
.device-map-selection__search {
  display: flex;
  width: calc(100% - 32px);
  margin: 12px 16px;
}
.device-map-selection__list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.device-map-selection__device {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--border-color, #e5e6eb);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.device-map-selection__device:hover,
.device-map-selection__device:focus-visible {
  background: var(--bg-hover, #f5f7fa);
}
.device-map-selection__identity {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.device-map-selection__identity strong,
.device-map-selection__identity span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.device-map-selection__identity span,
.device-map-selection__coordinate {
  color: var(--text-3, #86909c);
  font-size: 12px;
}
.device-map-selection__device :deep(.ant-badge) {
  flex-shrink: 0;
}
.device-map-selection__message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  color: var(--error, #f5222d);
}
.device-map-selection__pagination {
  padding: 12px 16px;
  text-align: right;
}
.device-map-selection__footer {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  color: var(--text-3, #86909c);
  background: var(--bg-hover, #f5f7fa);
  font-size: 12px;
}
.device-map-selection__footer > :first-child {
  margin-top: 3px;
}
.device-map-selection__detail-name {
  padding: 16px 16px 4px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.device-map-selection__coordinate {
  padding: 0 16px 12px;
}
.device-map-selection__details {
  min-height: 100px;
  padding: 0 16px 12px;
  overflow-wrap: anywhere;
}
</style>
