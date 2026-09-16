<template>
  <a-button
    v-if="!embedded && device"
    class="iot-device-detail__back"
    type="text"
    @click="state.backToDeviceList"
  >
    <template #icon><AIcon type="LeftOutlined" /></template>
    {{ state.$t('IotDeviceDetail.common.backToDeviceList') }}
  </a-button>
  <ContentPanel>
	  <IotDeviceDefaultDetailContent v-if="embedded && device" :state="state" embedded />
	  <a-alert v-else-if="embedded" type="error" show-icon :message="state.$t('UnifiedDeviceList.loadFailed')" />
	  <IotDeviceDetailOverlays v-if="!embedded" :state="state" />
	  <main v-if="!embedded && device" class="iot-device-detail">
		  <div class="iot-device-detail__content">
			  <div class="iot-device-detail__summary-card" :padding="16">
				  <IotDeviceDetailHeader :state="state" />
			  </div>

			  <div class="iot-device-detail__content-card" :padding="0">
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
			  </div>
		  </div>
	  </main>
  </ContentPanel>
</template>

<script setup lang="ts">
import { reactive, toRefs, type PropType } from 'vue'
import IotDeviceDetailHeader from './device-detail/IotDeviceDetailHeader.vue'
import IotDeviceDetailOverlays from './device-detail/IotDeviceDetailOverlays.vue'
import IotDeviceDefaultDetailContent from './IotDeviceDefaultDetailContent.vue'
import { useDeviceDetailAgent } from '../agent/useDeviceDetailAgent'
import { useIotDeviceDetailView } from '../hooks/useIotDeviceDetailView'
import type { DeviceInstance } from '@device-manager-ui/types/Instance'

interface IotDeviceDetailViewProps {
  embedded?: {
    deviceId: string
    deviceDetail?: Partial<DeviceInstance>
    panel: 'thing-model' | 'data'
    updatePermission: boolean
  }
}

// 统一头部负责设备摘要；业务 Provider 决定下方内容。助手挂在详情页宿主，自定义内容区仍切换气泡。
// 网关详情嵌入时由页面级 DeviceDetailAgentHost 持有助手，避免切离物模型/数据页签时 release。
const props = defineProps({
  embedded: Object as PropType<IotDeviceDetailViewProps['embedded']>,
})
const emit = defineEmits<{ 'metadata-changed': [] }>()
const state = reactive(useIotDeviceDetailView(props, () => emit('metadata-changed')))
const { device, detailContent, detailContentRef, onDetailContentChanged } = toRefs(state)
useDeviceDetailAgent({
  device,
  enabled: () => !props.embedded,
})
await state.ready
</script>

<style scoped src="../styles/IotDeviceDetailView.css"></style>
