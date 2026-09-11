<template>
        <DeviceDetailFishboneSkeleton v-if="detailPageLoading" mode="title" />
        <div v-else class="device-detail-title-row">
          <div class="device-detail-title-main">
            <div class="device-detail-name-wrap">
              <button
                type="button"
                class="device-detail-avatar-btn"
                @click="handleEditInstance"
              >
                <img
                  class="device-detail-avatar-img"
                  :src="avatarSrc"
                  alt=""
                  @error="avatarError = true"
                />
                <span
                  class="device-detail-avatar-edit-mask"
                  aria-hidden="true"
                >
                  <AIcon type="EditOutlined" />
                </span>
              </button>
              <a-tooltip
                v-if="!isEditingName"
                :title="instanceStore.current?.name"
              >
                <div class="deviceDetailHead">
                  {{ instanceStore.current?.name }}
                </div>
              </a-tooltip>
              <div
                v-else
                ref="nameEditorRef"
                class="deviceDetailHead deviceDetailHead--editable"
                contenteditable="true"
                @input="onNameInput"
                @keydown.enter.prevent="handleSaveName"
              ></div>
              <a-button
                v-if="isEditingName"
                type="text"
                size="small"
                class="device-detail-name-action"
                :loading="savingName"
                :title="$t('Detail.index.957187-33')"
                @click="handleSaveName"
              >
                <template #icon>
                  <AIcon type="CheckOutlined" />
                </template>
              </a-button>
              <a-tooltip
                v-else-if="permissionStore.hasPermission('device/Instance:update')"
                :title="$t('Detail.index.957187-34')"
              >
                <a-button
                  type="text"
                  size="small"
                  class="device-detail-name-action"
                  @click="handleEditName"
                >
                  <template #icon>
                    <AIcon type="EditOutlined" />
                  </template>
                </a-button>
              </a-tooltip>
              <span
                class="device-detail-meta__sep device-detail-name-status-sep"
                aria-hidden="true"
              >·</span>
              <span class="device-detail-status-inline">
                <span class="device-detail-status-text">
                  {{ $t('Detail.index.957187-0') }}
                  <a-badge :status="statusMap.get(instanceStore.current?.state?.value)" />
                  {{ instanceStore.current?.state?.text }}
                </span>
                <slot
                  v-if="instanceStore.current?.state?.value === 'notActive'"
                  name="activeDevice"
                ></slot>
                <j-permission-button
                  v-if="instanceStore.current?.state?.value === 'notActive' && !slots.activeDevice"
                  type="link"
                  class="device-detail-inline-action"
                  :popConfirm="{
                    title: $t('Detail.index.957187-1'),
                    onConfirm: handleAction
                  }"
                  hasPermission="device/Instance:action"
                >
                  {{ $t('Detail.index.957187-2') }}
                </j-permission-button>
                <slot
                  v-if="instanceStore.current?.state?.value === 'online'"
                  name="activeDevice"
                ></slot>
                <j-permission-button
                  v-if="instanceStore.current?.state?.value === 'online' && !slots.disconnect"
                  type="link"
                  class="device-detail-inline-action"
                  :popConfirm="{
                    title: $t('Detail.index.957187-3'),
                    onConfirm: handleDisconnect
                  }"
                  hasPermission="device/Instance:action"
                >
                  {{ $t('Detail.index.957187-4') }}
                </j-permission-button>
                <a-tooltip
                  v-if="
                    instanceStore.current?.accessProvider === 'child-device' &&
                    instanceStore.current?.state?.value === 'offline'
                  "
                  :title="
                    instanceStore.current?.features?.find((item) => item?.id === 'selfManageState')
                      ? $t('Detail.index.957187-7')
                      : $t('Detail.index.957187-8')
                  "
                >
                  <AIcon
                    type="QuestionCircleOutlined"
                    class="device-detail-offline-hint-icon"
                  />
                </a-tooltip>
              </span>
            </div>
            <div class="device-detail-meta">
              <span class="device-detail-meta__label">ID</span>
              <a-tooltip :title="$t('Detail.index.957187-35')">
                <span
                  class="device-detail-meta__id-text device-detail-meta__id-text--copy"
                  @click="handleCopyId"
                >
                  {{ instanceStore.current?.id }}
                </span>
              </a-tooltip>
  	          <DeviceIdMapping class="device-detail-meta__mapping" />
              <span
                class="device-detail-meta__sep"
                aria-hidden="true"
              >·</span>
              <span class="device-detail-meta__product">
                <slot name="productName"></slot>
                <j-permission-button
                  v-if="!slots.productName"
                  type="link"
                  class="device-detail-meta__product-link"
                  @click="jumpProduct"
                  hasPermission="device/Product:view"
                >
                  <j-ellipsis>{{ instanceStore.current?.productName }}</j-ellipsis>
                </j-permission-button>
              </span>
              <template v-if="deviceTags.length">
                <span
                  class="device-detail-meta__sep"
                  aria-hidden="true"
                >·</span>
                <div class="device-detail-meta__tags-inline">
                  <a-tooltip
                    v-for="(tag, idx) in visibleTags"
                    :key="tag.key ?? `tag-${idx}`"
                    :title="formatTagTooltipValueOnly(tag)"
                  >
                    <a-tag
                      :class="[
                        'device-detail-meta__tag-chip',
                        { 'device-detail-meta__tag-chip--empty': isTagValueEmpty(tag) }
                      ]"
                      size="small"
                      @click.stop="handleCopyTagValue(tag)"
                    >
                      <span class="device-detail-meta__tag-text">{{ formatTagLine(tag) }}</span>
                    </a-tag>
                  </a-tooltip>
                  <a-popover
                    v-if="deviceTags.length > TAG_PREVIEW_COUNT"
                    v-model:open="tagsPopoverOpen"
                    trigger="click"
                    placement="bottomRight"
                    :overlayStyle="{ zIndex: 2001 }"
                    :overlayInnerStyle="{ padding: '8px', maxWidth: 'min(520px, 92vw)' }"
                    overlayClassName="device-detail-tags-popover"
                    destroyTooltipOnHide
                  >
                    <template #content>
                      <div class="device-detail-tags-popover-inner">
                        <a-tooltip
                          v-for="(tag, idx) in moreTags"
                          :key="tag.key ?? `tag-more-${idx}`"
                          :title="formatTagTooltipValueOnly(tag)"
                        >
                          <a-tag
                            :class="[
                              'device-detail-meta__tag-chip',
                              { 'device-detail-meta__tag-chip--empty': isTagValueEmpty(tag) }
                            ]"
                            size="small"
                            @click.stop="handleCopyTagValue(tag)"
                          >
                            <span class="device-detail-meta__tag-text">{{
                              formatTagLine(tag)
                            }}</span>
                          </a-tag>
                        </a-tooltip>
                      </div>
                    </template>
                    <button
                      type="button"
                      class="device-detail-meta__tags-expand-btn"
                      aria-label="expand-tags"
                    >
                      <AIcon
                        type="DownOutlined"
                        :class="{
                          'device-detail-meta__tags-expand-caret--open': tagsPopoverOpen
                        }"
                      />
                    </button>
                  </a-popover>
                  <j-permission-button
                    v-if="deviceTags.length"
                    type="text"
                    class="device-detail-meta__tags-edit"
                    hasPermission="device/Instance:update"
                    :title="$t('Detail.index.957187-40')"
                    @click="() => { tagsPanelVisible = true; tagsPopoverOpen = false }"
                  >
                    <template #icon>
                      <AIcon type="EditOutlined" />
                    </template>
                  </j-permission-button>
                </div>
              </template>
            </div>
          </div>
        </div>
</template>

<script setup lang="ts">
import { toRefs, type PropType } from 'vue'
import DeviceDetailFishboneSkeleton from './DeviceDetailFishboneSkeleton.vue'
import DeviceIdMapping from './components/DeviceIdMapping.vue'

import type { DeviceInstanceDetailState } from './useDeviceInstanceDetail'

/** 旧版设备名称、状态、标识与标签摘要。 */
type ViewState = Pick<DeviceInstanceDetailState,
  '$t' | 'instanceStore' | 'slots' | 'statusMap' | 'isEditingName' | 'savingName' | 'nameEditorRef' | 'avatarError' | 'TAG_PREVIEW_COUNT' | 'tagsPopoverOpen' | 'tagsPanelVisible' | 'detailPageLoading' | 'deviceTags' | 'avatarSrc' | 'visibleTags' | 'moreTags' | 'isTagValueEmpty' | 'formatTagLine' | 'formatTagTooltipValueOnly' | 'handleCopyTagValue' | 'handleEditInstance' | 'permissionStore' | 'handleAction' | 'handleDisconnect' | 'jumpProduct' | 'handleEditName' | 'onNameInput' | 'handleCopyId' | 'handleSaveName'
>
const props = defineProps({ state: { type: Object as PropType<ViewState>, required: true } })
const {
  $t,
  instanceStore,
  slots,
  statusMap,
  isEditingName,
  savingName,
  nameEditorRef,
  avatarError,
  TAG_PREVIEW_COUNT,
  tagsPopoverOpen,
  tagsPanelVisible,
  detailPageLoading,
  deviceTags,
  avatarSrc,
  visibleTags,
  moreTags,
  isTagValueEmpty,
  formatTagLine,
  formatTagTooltipValueOnly,
  handleCopyTagValue,
  handleEditInstance,
  permissionStore,
  handleAction,
  handleDisconnect,
  jumpProduct,
  handleEditName,
  onNameInput,
  handleCopyId,
  handleSaveName,
} = toRefs(props.state)
</script>

<style scoped src="./DeviceInstanceDetailHeader.css"></style>
