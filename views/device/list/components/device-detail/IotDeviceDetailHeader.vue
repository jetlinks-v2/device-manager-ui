<template>
  <DetailHeader v-if="device" variant="summary" :title="deviceNameText">
    <template #icon>
      <IconValueView v-if="device.imageUrl" :value="device.imageUrl" :fallback-text="device.name" :size="56" />
      <AIcon v-else :type="categoryIcon" aria-hidden="true" />
    </template>
    <template #titleExtra>
      <StatusTag :status="deviceStatus ? statusTones[deviceStatus.tone] : 'default'" :text="deviceStatus?.label" />
      <AppTag :title="deviceTypeText">{{ deviceTypeText }}</AppTag>
    </template>
    <template #meta>
      <DetailMetaItem kind="id" :label="$t('IotDeviceDetail.detail.deviceId')" :tooltip="$t('DetailMetaItem.copyTooltip', { id: deviceSnText })">
        <a-button type="text" class="dd-summary-action" @click="copyDeviceId">{{ deviceSnText }}<AIcon type="CopyOutlined" /></a-button>
      </DetailMetaItem>
      <DetailMetaItem kind="product" :label="$t('IotDeviceDetail.detail.product')" :tooltip="productNameText">
        <a-button type="link" class="dd-summary-action" :disabled="!canOpenProductDetail" @click="openProductDetail">{{ productNameText }}</a-button>
      </DetailMetaItem>
      <DetailMetaItem kind="space" :label="$t('IotDeviceDetail.detail.area')" :value="regionText" :tooltip="regionFullText" />
      <DetailMetaItem kind="group" :label="$t('IotDeviceDetail.detail.businessGroup')" :value="businessGroupText" :tooltip="businessGroupFullText" />
      <DetailMetaItem kind="time" :label="$t('IotDeviceDetail.detail.lastReport')" :value="lastSeenText" :tooltip="lastSeenText" />
    </template>
    <template v-if="thingModelTags.length" #extra>
      <DeviceDetailTags :key="device.id" :state="state" />
    </template>
    <template #actions>
      <DeviceDetailActions
        :name="device.name"
        :disabled="isDeviceDisabled"
        :permissions="{ update: canDeviceAction('update'), action: canDeviceAction(isDeviceDisabled ? 'enable' : 'disable'), delete: canDeviceAction('delete') }"
        :busy-action="actionBusyId ? actionKind : ''"
        @edit="openEditDrawer" @toggle="toggleDeviceEnabled" @delete="confirmDeleteDevice"
      />
    </template>
  </DetailHeader>
</template>

<script setup lang="ts">
import { computed, toRefs, type PropType } from 'vue'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'
import DetailHeader from '@jetlinks-web-core/components/DetailHeader/index.vue'
import DetailMetaItem from '@jetlinks-web-core/components/DetailMetaItem'
import StatusTag from '@jetlinks-web-core/components/StatusTag/index.vue'
import { useIotDeviceMeta } from '../../hooks/useIotDeviceMeta'
import DeviceDetailActions from './DeviceDetailActions.vue'
import DeviceDetailTags from './tags/DeviceDetailTags.vue'
import type { IotDeviceDetailViewState } from '../../hooks/useIotDeviceDetailView'

/** 设备标识、范围、标签与快捷操作摘要。 */
type ViewState = Pick<IotDeviceDetailViewState,
  'canDeviceAction' |
  '$t' |
  'device' |
  'savingTags' |
  'saveTags' |
  'removeTag' |
  'canRemoveTag' |
  'tagEditorOpen' |
  'tagsListRef' |
  'tagsExpanded' |
  'tagsOverflow' |
  'actionBusyId' |
  'actionKind' |
  'canOpenProductDetail' |
  'copyDeviceId' |
  'openEditDrawer' |
  'openProductDetail' |
  'toggleDeviceEnabled' |
  'confirmDeleteDevice' |
  'deviceNameText' |
  'deviceSnText' |
  'productNameText' |
  'deviceTypeText' |
  'regionText' |
  'regionFullText' |
  'businessGroupText' |
  'businessGroupFullText' |
  'lastSeenText' |
  'isDeviceDisabled' |
  'thingModelTags' |
  'formatTagTooltipValueOnly' |
  'toggleTagsExpanded' |
  'categoryIcon'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true } })
const {
  $t,
  device,
  actionBusyId,
  actionKind,
  canOpenProductDetail,
  copyDeviceId,
  openEditDrawer,
  openProductDetail,
  toggleDeviceEnabled,
  confirmDeleteDevice,
  deviceNameText,
  deviceSnText,
  productNameText,
  deviceTypeText,
  regionText,
  regionFullText,
  businessGroupText,
  businessGroupFullText,
  lastSeenText,
  isDeviceDisabled,
  thingModelTags,
  categoryIcon,
  canDeviceAction,
} = toRefs(props.state)
const { statusMeta } = useIotDeviceMeta()
const deviceStatus = computed(() => device.value ? statusMeta(device.value.status) : undefined)
const statusTones = { ok: 'success', warn: 'warning', err: 'error', info: 'info', muted: 'disabled' } as const
</script>

<style scoped src="../../styles/IotDeviceDetailHeader.css"></style>
