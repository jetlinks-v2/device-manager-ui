<template>
  <template v-if="device">
    <section
      class="dd-hero"
      :class="{ 'is-tags-expanded': tagsExpanded }"
      :style="{ '--dd-tags-expanded-shift': `${-tagsExpandedOffset / 2}px` }"
    >
      <a-button class="dd-hero__back" type="text" @click="backToDeviceList">
        <template #icon><AIcon type="LeftOutlined" /></template>
        {{ $t('IotDeviceDetail.common.back') }}
      </a-button>
      <div class="dd-hero__icon" :data-category="categoryKey ?? 'sensor'">
        <IconValueView v-if="device.imageUrl" :value="device.imageUrl" :fallback-text="device.name" :size="52" />
        <AIcon v-else :type="categoryIcon" aria-hidden="true" />
      </div>
      <div class="dd-hero__main">
        <div class="dd-hero__headline">
          <a-tooltip :title="deviceNameText">
            <h1>{{ deviceNameText }}</h1>
          </a-tooltip>
          <IotDeviceStatusPill :status="device.status" />
        </div>
        <div class="dd-hero__summary">
          <div class="dd-summary-line">
            <div class="dd-summary-row dd-summary-row--id">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.deviceId') }}</span>
              <a-tooltip :title="deviceSnText">
                <span class="dd-summary-value">{{ deviceSnText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.product') }}</span>
              <a-tooltip :title="productNameText">
                <span class="dd-summary-value">{{ productNameText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.deviceType') }}</span>
              <a-tooltip :title="deviceTypeAccessText">
                <span class="dd-summary-value">{{ deviceTypeAccessText }}</span>
              </a-tooltip>
            </div>
          </div>
          <div class="dd-summary-line">
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.area') }}</span>
              <a-tooltip :title="regionFullText">
                <span class="dd-summary-value">{{ regionText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.businessGroup') }}</span>
              <a-tooltip :title="businessGroupFullText">
                <span class="dd-summary-value">{{ businessGroupText }}</span>
              </a-tooltip>
            </div>
            <div class="dd-summary-row">
              <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.lastReport') }}</span>
              <a-tooltip :title="lastSeenText">
                <span class="dd-summary-value">{{ lastSeenText }}</span>
              </a-tooltip>
            </div>
          </div>
          <div v-if="thingModelTags.length" class="dd-summary-line">
            <div class="dd-summary-row dd-summary-row--tags">
              <div class="dd-tags-title">
                <span class="dd-summary-label">{{ $t('IotDeviceDetail.detail.tags') }}</span>
                <a-tooltip v-if="canDeviceAction('update')" :title="$t('IotDeviceDetail.detail.editThingModelTags')">
                  <a-button
                    type="text"
                    size="small"
                    class="dd-tags-edit-action"
                    :aria-label="$t('IotDeviceDetail.detail.editThingModelTags')"
                    @click="tagEditorOpen = true"
                  >
                    <template #icon><AIcon type="EditOutlined" /></template>
                  </a-button>
                </a-tooltip>
              </div>
              <div
                ref="tagsListRef"
                class="dd-tags-list"
                :class="{ 'is-expanded': tagsExpanded }"
              >
                <a-tooltip v-for="tag in thingModelTags" :key="getTagKey(tag)" :title="formatTagTooltipValueOnly(tag)">
                  <span class="dd-tag-text">{{ formatTagLine(tag) }}</span>
                </a-tooltip>
              </div>
              <a-button
                v-if="tagsOverflow"
                type="text"
                size="small"
                class="dd-tags-action"
                @click="toggleTagsExpanded"
              >
                {{ tagsExpanded ? $t('IotDeviceDetail.detail.collapseTags') : $t('IotDeviceDetail.detail.expandTags') }}
              </a-button>
            </div>
          </div>
        </div>
      </div>
      <div class="dd-hero__actions">
        <a-button v-if="canDeviceAction('update')" size="small" :disabled="Boolean(actionBusyId)" @click="openEditDrawer">
          <template #icon><AIcon type="EditOutlined" /></template>
          {{ $t('IotDeviceDetail.detail.edit') }}
        </a-button>
        <a-popconfirm
          v-if="canDeviceAction(isDeviceDisabled ? 'enable' : 'disable')"
          :title="isDeviceDisabled
            ? $t('IotDeviceList.confirm.enableOne', { name: device.name })
            : $t('IotDeviceList.confirm.disableOne', { name: device.name })"
          :ok-button-props="{ loading: actionBusyId === device.id && actionKind === 'toggle' }"
          @confirm="toggleDeviceEnabled"
        >
          <a-button
            size="small"
            :loading="actionBusyId === device.id && actionKind === 'toggle'"
            :disabled="Boolean(actionBusyId && actionKind !== 'toggle')"
          >
            <template #icon><AIcon :type="isDeviceDisabled ? 'CheckSquareOutlined' : 'StopOutlined'" /></template>
            {{ isDeviceDisabled ? $t('IotDeviceDetail.detail.enable') : $t('IotDeviceDetail.detail.disable') }}
          </a-button>
        </a-popconfirm>
        <a-popconfirm
          v-if="canDeviceAction('delete')"
          :title="$t('IotDeviceList.confirm.deleteOne', { name: device.name })"
          :disabled="deleteActionDisabled"
          :ok-button-props="{ loading: actionBusyId === device.id && actionKind === 'delete' }"
          @confirm="confirmDeleteDevice"
        >
          <a-button
            size="small"
            danger
            :loading="actionBusyId === device.id && actionKind === 'delete'"
            :disabled="deleteActionDisabled"
          >
            <template #icon><AIcon type="DeleteOutlined" /></template>
            {{ $t('IotDeviceDetail.detail.delete') }}
          </a-button>
        </a-popconfirm>
      </div>
    </section>
  </template>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import { IconValueView } from '@jetlinks-web-core/components/IconValue'
import IotDeviceStatusPill from '../IotDeviceStatusPill.vue'
import type { IotDeviceDetailViewState } from '../../hooks/useIotDeviceDetailView'

/** 设备标识、范围、标签与快捷操作摘要。 */
type ViewState = Pick<IotDeviceDetailViewState,
  'canDeviceAction' |
  '$t' |
  'deviceId' |
  'device' |
  'tagEditorOpen' |
  'tagsListRef' |
  'tagsExpanded' |
  'tagsOverflow' |
  'tagsExpandedOffset' |
  'actionBusyId' |
  'actionKind' |
  'openEditDrawer' |
  'backToDeviceList' |
  'toggleDeviceEnabled' |
  'confirmDeleteDevice' |
  'deviceNameText' |
  'deviceSnText' |
  'productNameText' |
  'deviceTypeAccessText' |
  'regionText' |
  'regionFullText' |
  'businessGroupText' |
  'businessGroupFullText' |
  'lastSeenText' |
  'isDeviceDisabled' |
  'deleteActionDisabled' |
  'thingModelTags' |
  'getTagKey' |
  'formatTagLine' |
  'formatTagTooltipValueOnly' |
  'toggleTagsExpanded' |
  'categoryKey' |
  'categoryIcon'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true } })
const {
  $t,
  deviceId,
  device,
  tagEditorOpen,
  tagsListRef,
  tagsExpanded,
  tagsOverflow,
  tagsExpandedOffset,
  actionBusyId,
  actionKind,
  openEditDrawer,
  backToDeviceList,
  toggleDeviceEnabled,
  confirmDeleteDevice,
  deviceNameText,
  deviceSnText,
  productNameText,
  deviceTypeAccessText,
  regionText,
  regionFullText,
  businessGroupText,
  businessGroupFullText,
  lastSeenText,
  isDeviceDisabled,
  deleteActionDisabled,
  thingModelTags,
  getTagKey,
  formatTagLine,
  formatTagTooltipValueOnly,
  toggleTagsExpanded,
  categoryKey,
  categoryIcon,
  canDeviceAction,
} = toRefs(props.state)
</script>

<style scoped src="../../styles/IotDeviceDetailHeader.css"></style>
