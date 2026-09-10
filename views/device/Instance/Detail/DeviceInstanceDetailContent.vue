<template>
  <div class="device-instance-detail-content" :class="{ 'device-instance-detail-content--embedded': contentOnly, 'device-detail-page-wrap--tab-skeleton': detailPageLoading }">
    <a-tabs v-if="contentOnly" class="device-instance-detail-content__tabs" :active-key="pageContainerTabActiveKey" @change="key => onTabChange(String(key))">
      <a-tab-pane v-for="tab in pageContainerTabList" :key="tab.key" :tab="tab.tab" />
    </a-tabs>
    <div v-if="detailPageLoading" class="device-detail-content-wrap device-detail-content-wrap--skeleton">
      <DeviceDetailFishboneSkeleton mode="page" />
    </div>
    <a-alert v-else-if="detailError" type="error" show-icon :message="detailError">
      <template #action><a-button @click="handleRefresh">{{ $t('Detail.index.957187-30') }}</a-button></template>
    </a-alert>
    <div v-else :style="contentStyle" class="device-detail-content-wrap">
      <component v-if="activeExtension" :is="activeExtension.component" ref="componentRef"
        :key="resolvedDeviceId + ':' + activeExtension.key" :device-id="resolvedDeviceId"
        v-bind="activeExtension.props?.(instanceStore.current)" />
      <RegistryComponent v-else :key="resolvedDeviceId" code="detail-tabs" :activeKey="instanceStore.tabActiveKey">
        <component ref="componentRef" :key="instanceStore.tabActiveKey" :is="activeBuiltinComponent"
          v-bind="{ type: 'device', isRefresh }" @onJump="onTabChange" />
      </RegistryComponent>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import DeviceDetailFishboneSkeleton from './DeviceDetailFishboneSkeleton.vue'
import type { DeviceInstanceDetailState } from './useDeviceInstanceDetail'

/** 复用旧页签内容，嵌入模式仅增加同款文字页签导航。 */
type ViewState = Pick<DeviceInstanceDetailState,
  '$t' | 'instanceStore' | 'componentRef' | 'detailPageLoading' | 'isRefresh' | 'pageContainerTabList' | 'pageContainerTabActiveKey' | 'contentStyle' | 'onTabChange' | 'handleRefresh' | 'detailError' | 'activeExtension' | 'activeBuiltinComponent' | 'resolvedDeviceId'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true }, contentOnly: { type: Boolean, default: false } })
const {
  $t,
  instanceStore,
  componentRef,
  detailPageLoading,
  isRefresh,
  pageContainerTabList,
  pageContainerTabActiveKey,
  contentStyle,
  onTabChange,
  handleRefresh,
  detailError,
  activeExtension,
  activeBuiltinComponent,
  resolvedDeviceId,
} = toRefs(props.state)
</script>

<style scoped src="./DeviceInstanceDetailContent.css"></style>
