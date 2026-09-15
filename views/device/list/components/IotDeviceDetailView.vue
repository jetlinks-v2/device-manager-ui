<template>
  <IotDeviceDefaultDetailContent v-if="embedded && device" :state="state" embedded />
  <a-alert v-else-if="embedded" type="error" show-icon :message="state.$t('UnifiedDeviceList.loadFailed')" />
  <IotDeviceDetailOverlays v-if="!embedded" :state="state" />
  <main v-if="!embedded && device" class="iot-device-detail">
    <div class="iot-device-detail__content">
      <ContentPanel class="iot-device-detail__summary-card" :padding="16">
        <IotDeviceDetailHeader :state="state" />
      </ContentPanel>

      <ContentPanel class="iot-device-detail__content-card" :padding="0">
        <FullPage v-if="detailContent" class="iot-device-detail__legacy-content" flex transparent-background>
          <component
            :is="detailContent.component"
            ref="detailContentRef"
            :key="device.id"
            :device-id="device.id"
            v-bind="detailContent.props?.(device)"
            @changed="onDetailContentChanged"
          />
        </FullPage>
        <IotDeviceDefaultDetailContent v-else :state="state" />
      </ContentPanel>
    </div>
  </main>
</template>

<script setup lang="ts">
import { reactive, toRefs, type PropType } from 'vue'
import IotDeviceDetailHeader from './device-detail/IotDeviceDetailHeader.vue'
import IotDeviceDetailOverlays from './device-detail/IotDeviceDetailOverlays.vue'
import IotDeviceDefaultDetailContent from './IotDeviceDefaultDetailContent.vue'
import { useIotDeviceDetailView, type IotDeviceDetailViewProps } from '../hooks/useIotDeviceDetailView'

// 统一头部负责设备摘要；业务 Provider 决定下方内容，页签与助手只由当前内容宿主管理。
const props = defineProps({
  embedded: Object as PropType<IotDeviceDetailViewProps['embedded']>,
})
const emit = defineEmits<{ 'metadata-changed': [] }>()
const state = reactive(useIotDeviceDetailView(props, () => emit('metadata-changed')))
const { device, detailContent, detailContentRef, onDetailContentChanged } = toRefs(state)
await state.ready
</script>

<style scoped src="../styles/IotDeviceDetailView.css"></style>
