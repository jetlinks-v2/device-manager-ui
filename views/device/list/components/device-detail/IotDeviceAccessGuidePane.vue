<template>
  <a-spin :spinning="accessLoading">
    <CloudEmpty
      v-if="!accessDetail?.id && !accessLoading"
      class="access-empty"
      :description="$t('IotDeviceDetail.accessGuide.noConfig')"
    />
    <div
      v-else
      class="access-guide-layout"
      :class="{ 'access-guide-layout--with-doc': showRightGuide }"
    >
      <div class="access-guide-main">
        <a-alert
          class="access-guide-tip"
          :type="accessGuideTip.type"
          show-icon
          :message="accessGuideTip.message"
        />
        <a-list
          class="access-item-list"
          item-layout="vertical"
          :split="true"
          size="small"
        >
          <a-list-item class="access-list-item">
            <a-list-item-meta>
              <template #title>
                <div class="access-meta-title">
                        <div class="title-before" aria-hidden="true" />
                  <span>{{ $t('IotDeviceDetail.accessGuide.accessMode') }}</span>
                </div>
              </template>
              <template #description>
                <div class="access-method-card">
                  <div class="access-method-card__row">
                    <a-tooltip :title="accessModeText">
                      <span class="access-method-name">{{ accessModeText }}</span>
                    </a-tooltip>
                    <a-tooltip v-if="transportText !== '--'" :title="transportText">
                      <a-tag class="access-method-tag access-method-tag--transport">{{ transportText }}</a-tag>
                    </a-tooltip>
                  </div>
                  <div v-if="accessModeDescription !== '--'" class="access-method-card__desc">{{ accessModeDescription }}</div>
                </div>
              </template>
            </a-list-item-meta>
          </a-list-item>

          <a-list-item class="access-list-item">
            <a-list-item-meta>
              <template #title>
                <div class="access-meta-title">
                  <div class="title-before" aria-hidden="true" />
                  <span>{{ $t('IotDeviceDetail.accessGuide.accessAddress') }}</span>
                </div>
              </template>
              <template #description>
                <div
                  v-if="addressRows.length"
                  class="address-list"
                >
                  <div
                    v-for="addr in addressRows"
                    :key="addr.address"
                    class="address-item"
                    @click="copyText(addr.address)"
                  >
                    <a-badge
                      :color="addr.health === -1 ? 'red' : 'green'"
                      :text="addr.address"
                    />
                    <AIcon type="CopyOutlined" />
                  </div>
                </div>
                <CloudEmpty v-else :description="$t('IotDeviceDetail.accessGuide.noAddress')" />
              </template>
            </a-list-item-meta>
          </a-list-item>

          <IotDeviceAccessConfigSection
            v-if="configGroups.length"
            :config-groups="configGroups"
            :get-config-value="getConfigValue"
            :render-config-value="renderConfigValue"
            @copy="copyText"
            @edit="openConfigEditor"
          />

          <IotDeviceAccessPrincipalSection
            v-if="principalRows.length"
            :principal-rows="principalRows"
            :resetting="resettingPrincipal"
            @copy="copyText"
            @reset="resetPrincipal"
          />
        </a-list>
      </div>

      <IotDeviceAccessGuideAside
        v-if="showRightGuide"
        :access-guide-document="accessGuideDocument"
        :access-guide-loading="accessGuideLoading"
        :access-guide-load-failed="accessGuideLoadFailed"
        :protocol-document="protocolDocument"
        @guide-click="onProtocolDocClick"
        @protocol-click="onProtocolDocClick"
      />
    </div>
  </a-spin>

  <a-modal
    v-model:open="configEditorOpen"
    :title="$t('IotDeviceDetail.accessGuide.editConfig')"
    :confirm-loading="savingConfig"
    @ok="saveConfig"
  >
    <a-form
      layout="vertical"
      :model="configDraft"
    >
      <template
        v-for="group in configGroups"
        :key="group.name"
      >
        <a-form-item
          v-for="item in group.properties"
          :key="item.property"
          :label="item.name"
          :type="item.property"
        >
          <a-select
            v-if="item.type?.type === 'enum'"
            v-model:value="configDraft[item.property]"
            :options="(item.type.elements || []).map((option) => ({ label: option.text, value: option.value }))"
          />
          <a-switch
            v-else-if="item.type?.type === 'boolean'"
            v-model:checked="configDraft[item.property]"
          />
          <a-input-password
            v-else-if="item.type?.type === 'password'"
            v-model:value="configDraft[item.property]"
          />
          <a-input
            v-else
            v-model:value="configDraft[item.property]"
          />
        </a-form-item>
      </template>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceTemplate } from '../../services/device-library/types'
import { useIotDeviceAccessDetail } from '../../hooks/useIotDeviceAccessDetail'
import type { IotDevice } from '../../types'
import IotDeviceAccessConfigSection from './IotDeviceAccessConfigSection.vue'
import IotDeviceAccessGuideAside from './IotDeviceAccessGuideAside.vue'
import IotDeviceAccessPrincipalSection from './IotDeviceAccessPrincipalSection.vue'

const emit = defineEmits<{
  (e: 'accessDetailChange', value: Record<string, any>): void
}>()

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  productTemplate: { type: Object as PropType<DeviceTemplate | null>, default: null },
})

const { t: $t } = useI18n()
const accessLoading = ref(false)
const {
  accessDetail,
  accessGuideDocument,
  accessGuideLoadFailed,
  accessGuideLoading,
  addressRows,
  configDraft,
  configEditorOpen,
  configGroups,
  copyText,
  loadAll,
  onProtocolDocClick,
  openConfigEditor,
  principalRows,
  protocolDocument,
  providerDescription,
  getConfigValue,
  renderConfigValue,
  resetAccessState,
  resetPrincipal,
  resettingPrincipal,
  saveConfig,
  savingConfig,
} = useIotDeviceAccessDetail(props)

const showRightGuide = computed(() => Boolean(accessDetail.value?.id))
const isDisabled = computed(() => props.device.status === 'disabled' || props.device.connectionStatus === 'disabled')
const isOnline = computed(() => props.device.status === 'online' || props.device.status === 'alarm')
const accessModeText = computed(() => displayText(accessDetail.value?.name || props.device.accessName || props.device.accessMode))
const transportText = computed(() => displayText(accessDetail.value?.transport || props.device.transport))
const accessModeDescription = computed(() => {
  const text = displayText(accessDetail.value?.description || providerDescription.value || $t('IotDeviceDetail.accessGuide.accessModeDefaultDesc'))
  const normalizedText = text.toLowerCase()
  if ([accessModeText.value, transportText.value].some((value) => value !== '--' && value.toLowerCase() === normalizedText)) {
    return '--'
  }
  return text
})
const accessGuideTip = computed(() => {
  if (isDisabled.value) {
    return {
      type: 'warning' as const,
      message: $t('IotDeviceDetail.accessGuide.disabledTip'),
    }
  }

  if (!isOnline.value) {
    return {
      type: 'warning' as const,
      message: $t('IotDeviceDetail.accessGuide.offlineTip'),
    }
  }

  return {
    type: 'success' as const,
    message: $t('IotDeviceDetail.accessGuide.onlineTip'),
  }
})

function displayText(value?: string | null) {
  return value && String(value).trim() ? String(value) : '--'
}

async function loadAccess() {
  resetAccessState()
  accessLoading.value = true
  try {
    await loadAll()
  } finally {
    accessLoading.value = false
  }
}

watch(
  accessDetail,
  (value) => emit('accessDetailChange', value || {}),
  { deep: true, immediate: true },
)

watch(
  () => props.device.id,
  () => {
    void loadAccess()
  },
  { immediate: true },
)
</script>

<style lang="less" scoped>
.access-empty {
  padding: var(--space-8) 0;
  color: var(--jet-theme-text-disabled);
  text-align: center;
}

.access-guide-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);

  &--with-doc {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.access-guide-main,
.access-guide-doc {
  min-width: 0;
}

.access-list-item {
  padding: var(--space-3) 0 !important;
}

.access-guide-tip {
  margin-bottom: var(--space-3);
  font-size: var(--fs-12);
  line-height: 1.45;
}

.access-guide-tip :deep(.ant-alert-message) {
  font-size: var(--fs-12);
  line-height: 1.45;
}

.access-meta-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.title-before {
  width: 0.1875rem;
  height: var(--space-3);
  border-radius: var(--r-1);
  background: var(--jet-theme-primary);
}

.item-style,
.address-list,
.access-method-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.access-method-card {
  align-items: flex-start;
}

.access-method-card__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.access-method-name {
  display: inline-block;
  max-width: 24rem;
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-14);
  line-height: 1.5;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.access-method-tag {
  display: inline-flex;
  align-items: center;
  max-width: 18rem;
  min-height: 1.5rem;
  margin-inline-end: 0;
  font-weight: 500;
}

.access-method-tag :deep(.ant-tag) {
  min-width: 0;
}

.access-method-tag--transport {
  border-color: var(--jet-theme-border-secondary);
  background: var(--jet-theme-bg-layout);
  color: var(--jet-theme-text-secondary);
}

.access-method-card__desc {
  max-width: 100%;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.6;
}

.address-item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

@media (max-width: 75rem) {
  .access-guide-layout--with-doc {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 75rem) {
  .access-guide-layout--with-doc {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
