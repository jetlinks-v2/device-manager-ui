<template>
  <IotDeviceDetailOverlays :state="state" />
  <template v-if="device">
    <IotDeviceDetailHeader :state="state" />
    <FullPage v-if="detailContent" flex transparent-background>
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
  </template>
</template>

<script setup lang="ts">
import { reactive, toRefs } from 'vue'
import IotDeviceDetailHeader from './device-detail/IotDeviceDetailHeader.vue'
import IotDeviceDetailOverlays from './device-detail/IotDeviceDetailOverlays.vue'
import IotDeviceDefaultDetailContent from './IotDeviceDefaultDetailContent.vue'
import { useIotDeviceDetailView } from '../hooks/useIotDeviceDetailView'

// 统一头部负责设备摘要；业务 Provider 决定下方内容，页签与助手只由当前内容宿主管理。
const state = reactive(useIotDeviceDetailView())
const { device, detailContent, detailContentRef, onDetailContentChanged } = toRefs(state)
await state.ready
</script>
