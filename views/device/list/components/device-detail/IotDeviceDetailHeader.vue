<template>
  <DetailHeader v-if="device" variant="summary" compact :meta-label="$t('components.DetailHeader.moreInfo')" :meta-title="$t('IotDeviceDetail.header.deviceInfo')" :title="deviceNameText">
    <template #icon>
      <DeviceDetailIcon :device-id="device.id" :project-id="projectId" :value="device.imageUrl" :name="deviceNameText" :fallback-icon="typeIcon" :type-label="deviceTypeText" :allowed="canInlineEditDeviceMetadata" :disabled="!!actionBusyId" :refresh="onDetailContentChanged" />
    </template>
    <template #title><DeviceDetailName :device-id="device.id" :project-id="projectId" :name="device.name" :i18n-messages="device.i18nMessages" :allowed="canInlineEditDeviceMetadata" :disabled="!!actionBusyId" :refresh="onDetailContentChanged" /></template>
    <template #identifier><DetailIdentifier :value="deviceSnText" @copy="copyDeviceId"><template v-if="device.accessProvider === 'plugin_gateway'" #after><DeviceIdMapping icon-only :device="device" :can-update="canDeviceAction('update')" @saved="onDetailContentChanged" /></template></DetailIdentifier></template>
    <template #status><DeviceConnectionStatus :observation="observation" :device-id="device.id" :status="device.connectionStatus || device.status" :label="deviceStatus?.label || ''" :online-at="device.onlineAt" :offline-at="device.offlineAt" :last-report-at="device.lastReportAt" /></template>
    <template v-if="(device.connectionStatus || device.status) === 'online'" #observation><DeviceConnectionMetrics :observation="observation" @open="observation.open = !observation.open" /></template>
    <template #context><DeviceConnectionContext :observation="observation" :status="device.connectionStatus || device.status" @open="observation.open = !observation.open" @close="observation.open = false" /></template>
    <template #meta="{ expanded }">
      <DetailMetaItem v-if="expanded" kind="id" label="ID" :value="deviceSnText" multiline />
      <DetailMetaItem kind="product" :show-label="expanded" merged-tooltip :label="$t('IotDeviceDetail.detail.product')" :tooltip="productNameText">
        <a-button type="link" class="dd-summary-action" :disabled="!canOpenProductDetail" @click="openProductDetail">{{ productNameText }}</a-button>
      </DetailMetaItem>
      <DetailMetaItem v-if="device.productModel && device.productModel !== '--' && device.productModel !== productNameText" kind="model" data-priority="secondary" :show-label="expanded" merged-tooltip :label="$t('UnifiedDeviceList.model')" :value="device.productModel" />
      <DetailMetaItem v-if="device.accessName" kind="access" data-priority="secondary" :show-label="expanded" merged-tooltip :label="$t('IotDeviceList.filter.accessMode')" :value="device.accessName" />
      <DetailMetaItem kind="group" :show-label="expanded" :label="$t('IotDeviceDetail.detail.businessGroup')">
        <DeviceDetailScopeField :device-id="device.id" :project-id="projectId" kind="group" :text="device.groupBindings?.map(group => group.name).join(' / ') || ''" :allowed="canInlineEditDeviceMetadata" :disabled="!!actionBusyId" :refresh="onDetailContentChanged" />
      </DetailMetaItem>
      <DetailMetaItem kind="space" :show-label="expanded" :label="$t('IotDeviceDetail.detail.area')">
        <DeviceDetailScopeField :device-id="device.id" :project-id="projectId" kind="area" :text="device.areaBindings?.map(area => area.area).join(' / ') || ''" :allowed="canInlineEditDeviceMetadata" :disabled="!!actionBusyId" :refresh="onDetailContentChanged" />
      </DetailMetaItem>
      <DetailMetaItem kind="description" :show-label="expanded" :label="$t('IotDeviceList.basicFields.label.description')"><DeviceDetailDescription :device-id="device.id" :project-id="projectId" :description="device.summary && device.summary !== '--' ? device.summary : ''" :i18n-messages="device.i18nMessages" :compact="!expanded" :allowed="canInlineEditDeviceMetadata" :disabled="!!actionBusyId" :refresh="onDetailContentChanged" /></DetailMetaItem>
      <DetailMetaItem v-if="parentDeviceId" kind="category" :show-label="expanded" merged-tooltip :label="$t('IotDeviceDetail.detail.parentDevice')" :tooltip="parentDeviceName">
        <a-button type="link" class="dd-summary-action" @click="openParentDevice">{{ parentDeviceName }}</a-button>
      </DetailMetaItem>
    </template>
    <template v-if="thingModelTags.length" #auxiliary="{ inline }">
      <DeviceDetailTags :key="device.id" :state="state" :trigger="!inline" />
    </template>
    <template #actions>
      <DeviceDetailActions
        compact
        :name="device.name"
        :disabled="isDeviceDisabled"
        :permissions="{ update: canDeviceAction('update'), action: canDeviceAction(isDeviceDisabled ? 'enable' : 'disable'), delete: canDeviceAction('delete') }"
        :busy-action="actionBusyId ? actionKind : ''"
        :edit-mode="canInlineEditDeviceMetadata ? 'hidden' : 'settings'"
        @edit="openEditDrawer" @toggle="toggleDeviceEnabled" @delete="confirmDeleteDevice"
      />
    </template>
  </DetailHeader>
</template>

<script setup lang="ts">
import { computed, toRefs, type PropType } from 'vue'
import DetailHeader from '@jetlinks-web-core/components/DetailHeader/index.vue'
import { DetailIdentifier } from '@jetlinks-web-core/components/DetailHeader'
import DetailMetaItem from '@jetlinks-web-core/components/DetailMetaItem'
import DeviceDetailName from '../../../../../components/device-detail/DeviceDetailName.vue'
import DeviceDetailDescription from '../../../../../components/device-detail/DeviceDetailDescription.vue'
import DeviceDetailIcon from '../../../../../components/device-detail/DeviceDetailIcon.vue'
import DeviceDetailScopeField from '../../../../../components/device-detail/DeviceDetailScopeField.vue'
import DeviceConnectionStatus from '../../../../../components/device-detail/DeviceConnectionStatus.vue'
import DeviceConnectionMetrics from '../../../../../components/device-detail/DeviceConnectionMetrics.vue'
import DeviceConnectionContext from '../../../../../components/device-detail/DeviceConnectionContext.vue'
import { useDeviceConnectionHeader } from '../../../../../deviceDetailConnection'
import { useIotDeviceMeta, getIotDeviceTypeIcon } from '../../hooks/useIotDeviceMeta'
import DeviceDetailActions from './DeviceDetailActions.vue'
import DeviceIdMapping from '../../../Instance/Detail/components/DeviceIdMapping.vue'
import DeviceDetailTags from './tags/DeviceDetailTags.vue'
import type { IotDeviceDetailViewState } from '../../hooks/useIotDeviceDetailView'

/** 设备标识、范围、标签与快捷操作摘要。 */
type ViewState = Pick<IotDeviceDetailViewState,
  'canDeviceAction' |
  'canInlineEditDeviceMetadata' |
  'projectId' |
  'onDetailContentChanged' |
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
  'parentDeviceId' |
  'parentDeviceName' |
  'openParentDevice' |
  'toggleDeviceEnabled' |
  'confirmDeleteDevice' |
  'deviceNameText' |
  'deviceSnText' |
  'productNameText' |
  'deviceTypeText' |
  'isDeviceDisabled' |
  'thingModelTags' |
  'formatTagTooltipValueOnly' |
  'toggleTagsExpanded'
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
  parentDeviceId,
  parentDeviceName,
  openParentDevice,
  toggleDeviceEnabled,
  confirmDeleteDevice,
  deviceNameText,
  deviceSnText,
  productNameText,
  deviceTypeText,
  isDeviceDisabled,
  thingModelTags,
  canDeviceAction,
  canInlineEditDeviceMetadata,
  projectId,
  onDetailContentChanged,
} = toRefs(props.state)
const { statusMeta } = useIotDeviceMeta()
const deviceStatus = computed(() => device.value ? statusMeta(device.value.connectionStatus || device.value.status) : undefined)
const observation = useDeviceConnectionHeader({ get deviceId() { return device.value?.id || '' }, get projectId() { return projectId.value }, get status() { return device.value?.connectionStatus || device.value?.status || 'disabled' } })
const typeIcon = computed(() => getIotDeviceTypeIcon(device.value?.deviceTypeValue || device.value?.deviceType))
</script>

<style scoped src="../../styles/IotDeviceDetailHeader.css"></style>
