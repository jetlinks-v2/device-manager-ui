<template>
  <DeviceInstanceDetailOverlays :state="state" />
  <DeviceInstanceDetailContent v-if="props.contentOnly" :state="state" content-only />
  <div v-else class="device-detail-page-wrap" :class="{ 'device-detail-page-wrap--tab-skeleton': detailPageLoading }">
    <j-page-container :tabList="pageContainerTabList" :showBack="false" :tabActiveKey="pageContainerTabActiveKey" @tabChange="onTabChange">
      <template #title>
        <DeviceInstanceDetailHeader :state="state">
          <template v-if="$slots.activeDevice" #activeDevice><slot name="activeDevice" /></template>
          <template v-if="$slots.disconnect" #disconnect><slot name="disconnect" /></template>
          <template v-if="$slots.productName" #productName><slot name="productName" /></template>
        </DeviceInstanceDetailHeader>
      </template>
      <template #extra>
      <div v-if="detailPageLoading" class="device-detail-extra-skeleton">
        <div class="device-detail-extra-skeleton__btn" />
        <div class="device-detail-extra-skeleton__icon" />
      </div>
      <a-space v-else>
        <a-button
          @click="onClick"
          v-if="_arr.includes(instanceStore.current?.accessProvider || '') && userStore.isAdmin"
          type="primary"
          :disabled="instanceStore.current?.state?.value !== 'online'"
        >
          {{ $t('Detail.index.957187-10') }}
        </a-button>

        <a-tooltip :title="$t('Detail.index.957187-30')">
          <img
            @click="handleRefresh"
            :src="device.button"
            style="margin-right: 20px; cursor: pointer"
            alt=""
          />
        </a-tooltip>
      </a-space>
      </template>
      <full-page><DeviceInstanceDetailContent :state="state" /></full-page>
    </j-page-container>
  </div>
</template>

<script setup lang="ts">
import { reactive, toRefs } from 'vue'
import { device } from '../../../../assets'
import DeviceInstanceDetailHeader from './DeviceInstanceDetailHeader.vue'
import DeviceInstanceDetailOverlays from './DeviceInstanceDetailOverlays.vue'
import DeviceInstanceDetailContent from './DeviceInstanceDetailContent.vue'
import { useDeviceInstanceDetail } from './useDeviceInstanceDetail'

const props = defineProps({ contentOnly: { type: Boolean, default: false }, deviceId: { type: String, default: undefined } })
const emit = defineEmits<{ changed: [deviceId: string] }>()
const state = reactive(useDeviceInstanceDetail(props, deviceId => emit('changed', deviceId)))
const {
  $t,
  userStore,
  instanceStore,
  detailPageLoading,
  pageContainerTabList,
  pageContainerTabActiveKey,
  _arr,
  onTabChange,
  handleRefresh,
  onClick,
} = toRefs(state)

defineExpose({ refresh: state.handleRefresh, handleRefresh: state.handleRefresh, handleAction: state.handleAction, handleDisconnect: state.handleDisconnect, jumpProduct: state.jumpProduct })
</script>

<style scoped src="./DeviceInstanceDetailPage.css"></style>
