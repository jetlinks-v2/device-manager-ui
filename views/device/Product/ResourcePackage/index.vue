<template>
  <a-modal
    v-model:open="visible"
    :title="$t('Product.transfer.001-0')"
    :width="900"
    :mask-closable="false"
    :confirm-loading="importing"
    @cancel="close"
  >
    <a-steps :current="visibleStep" size="small" class="resource-package-steps" @change="changeStep">
      <a-step
        v-for="(item, index) in visibleSteps"
        :key="item.key"
        :title="$t(item.label)"
        :class="{ 'resource-package-step--clickable': canJumpToStep(index) }"
        @click="changeStep(index)"
      />
    </a-steps>

    <template v-if="step === 0">
      <div class="resource-package-type" role="radiogroup">
        <a-tooltip v-for="option in importOptions" :key="option.type" :title="permissionTip(!option.disabled)">
          <button
            type="button"
            class="resource-package-type__card"
            :class="{
              'is-selected': selectedImportType === option.type,
              'is-disabled': option.disabled,
            }"
            :disabled="option.disabled"
            :aria-pressed="selectedImportType === option.type"
            @click="selectImportType(option.type)"
          >
            <span class="resource-package-type__icon"><AIcon :type="option.icon" /></span>
            <span class="resource-package-type__content">
              <strong>{{ $t(option.label) }}</strong>
              <small>{{ $t(option.description) }}</small>
            </span>
            <AIcon v-if="selectedImportType === option.type" type="CheckCircleFilled" class="resource-package-type__check" />
          </button>
        </a-tooltip>
      </div>
      <a-spin :spinning="loading">
        <a-upload-dragger
          :show-upload-list="false"
          :before-upload="handleUpload"
          :accept="uploadAccept"
          :disabled="!canUpload"
        >
          <p class="ant-upload-drag-icon"><AIcon type="InboxOutlined" /></p>
          <p class="ant-upload-text">{{ uploadText }}</p>
          <p class="ant-upload-hint">
            {{ $t(selectedImportType === 'basic' ? 'Product.transfer.001-10' : 'Product.transfer.001-11') }}
          </p>
        </a-upload-dragger>
      </a-spin>
    </template>

    <template v-else-if="step === 1">
      <a-alert
        v-if="storagePolicyError"
        class="resource-alert resource-alert--basic"
        type="error"
        show-icon
        :message="storagePolicyError"
      />
      <a-form ref="productFormRef" :model="product" :rules="productRules" layout="vertical">
        <a-row :gutter="16" type="flex">
          <a-col flex="180px">
            <a-form-item name="photoUrl">
              <pro-upload v-model="product.photoUrl" :accept="imageTypes.join(',')" />
            </a-form-item>
          </a-col>
          <a-col flex="auto">
            <a-form-item :label="$t('Product.resourcePackage.001-6')" name="id">
              <a-input v-model:value="product.id" disabled />
            </a-form-item>
            <a-form-item :label="$t('Product.resourcePackage.001-7')" name="name">
              <a-input v-model:value="product.name" :placeholder="$t('Product.resourcePackage.001-7')" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="$t('Product.resourcePackage.001-8')" name="classifiedId">
              <a-tree-select
                v-model:value="product.classifiedId"
                show-search
                allow-clear
                :tree-data="categoryTree"
                :field-names="{ label: 'name', value: 'id', children: 'children' }"
                :filter-tree-node="(value, option) => filterSelectNode(value, option, 'name')"
                @change="changeCategory"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item name="storePolicy">
              <template #label>
                <span>{{ $t('Product.resourcePackage.001-34') }}</span>
                <a-tooltip :title="$t('DeviceAccess.index.594346-15')">
                  <AIcon type="QuestionCircleOutlined" class="storage-policy-help" />
                </a-tooltip>
              </template>
              <a-select v-model:value="product.storePolicy" allow-clear :options="storagePolicyOptions" @change="validate" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item name="deviceType">
          <template #label>
            <span>{{ $t('Product.resourcePackage.001-33') }}</span>
            <a-button type="link" size="small" :disabled="!metadataPreview" @click="metadataVisible = true">
              {{ $t('Product.resourcePackage.001-50') }}
            </a-button>
          </template>
          <j-card-select v-model:value="product.deviceType" :options="deviceTypes" @change="changeDeviceType">
            <template #itemRender="{ node }">
              <div class="device-type-option">
                <span>{{ node.label }}</span>
                <a-tooltip :title="node.tooltip"><AIcon type="QuestionCircleOutlined" /></a-tooltip>
              </div>
            </template>
          </j-card-select>
        </a-form-item>
        <a-form-item :label="$t('Product.resourcePackage.001-41')" name="describe">
          <a-textarea v-model:value="product.describe" :maxlength="200" show-count :auto-size="{ minRows: 3, maxRows: 5 }" />
        </a-form-item>
      </a-form>
      <a-modal v-model:open="metadataVisible" :title="$t('Product.resourcePackage.001-49')" :width="720" :footer="null">
        <div class="metadata-preview">
          <JsonViewer
            :value="metadataPreview"
            :expanded="true"
            :expand-depth="4"
            :copyable="{ copyText: $t('Product.resourcePackage.001-55'), copiedText: $t('Product.resourcePackage.001-56') }"
          />
        </div>
      </a-modal>
    </template>

    <template v-else-if="step === 2 && !isBasicImport">
      <a-alert v-for="error in accessPreflightErrors" :key="error" class="resource-alert" type="error" show-icon :message="error" />
      <a-alert v-if="showSelectionValidation && hasIncompleteLocalSelection" class="resource-alert" type="warning" show-icon :message="$t('Product.resourcePackage.001-48')" />
      <a-row :gutter="[12, 0]" class="resource-grid">
        <a-col v-if="manifest?.accessResources?.gateway" :span="24">
          <ResourceSelection
            v-model="resourceSelections.gateway"
            resource-type="gateway"
            :title="$t('Product.resourcePackage.001-26')"
            :package-resource="manifest.accessResources.gateway"
            :options="localOptions.gateway"
            :resource-type-label="gatewayProviderName"
            :show-validation="showSelectionValidation"
            @update:model-value="handleGatewaySelection"
          />
        </a-col>
        <template v-if="!isLocalGateway">
          <a-col
            v-for="type in dependentResourceTypes"
            :key="type.key"
            :span="24"
          >
            <ResourceSelection
              v-model="resourceSelections[type.key]"
              :resource-type="type.key"
              :title="$t(type.label)"
              :package-resource="manifest?.accessResources?.[type.key]"
              :options="localOptions[type.key]"
              :show-validation="showSelectionValidation"
              @update:model-value="handleResourceSelection"
            />
          </a-col>
        </template>
      </a-row>
      <a-alert v-if="isLocalGateway" class="resource-alert" type="info" show-icon :message="$t('Product.resourcePackage.001-46')" />
    </template>

    <template v-else>
      <a-list size="small" :data-source="progress">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-space>
              <a-badge :status="progressStatus(item.type)" />
              <span>{{ formatProgressMessage(item) }}</span>
            </a-space>
          </a-list-item>
        </template>
      </a-list>
    </template>

    <template #footer>
      <a-button v-if="step > 0 && !isResultStep" @click="previous">{{ $t('Product.resourcePackage.001-16') }}</a-button>
      <a-button v-if="step === 1" type="primary" :disabled="!canContinue || !!storagePolicyError" :loading="loading" @click="next">
        {{ $t(!isBasicImport ? 'Product.resourcePackage.001-47' : 'Product.resourcePackage.001-17') }}
      </a-button>
      <a-button v-if="step === 2 && !isBasicImport" type="primary" :disabled="!canContinue" :loading="loading" @click="next">
        {{ $t('Product.resourcePackage.001-17') }}
      </a-button>
      <a-button v-if="isResultStep" @click="close">{{ $t('Product.resourcePackage.001-18') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'
import ResourceSelection from './components/ResourceSelection.vue'
import { useResourcePackageWorkflow } from './useResourcePackageWorkflow'
import type { ProductTransferType } from '../hooks/useProductTransfer'

const props = defineProps<{
  canImportBasic: boolean
  canImportResourcePackage: boolean
}>()

const emit = defineEmits<{ success: [] }>()

const { t: $t } = useI18n()
const selectedImportType = ref<ProductTransferType>('basic')
const {
  visible, step, loading, importing, productFormRef, product, metadataVisible, accessPreflightErrors, storagePolicyError,
  showSelectionValidation, categoryTree, resourceSelections, localOptions, manifest,
  storagePolicyOptions, dependentResourceTypes, isLocalGateway, gatewayProviderName,
  metadataPreview, hasIncompleteLocalSelection, canContinue, imageTypes, productRules,
  deviceTypes, beforeUpload, changeCategory, changeDeviceType, handleGatewaySelection,
  handleResourceSelection, filterSelectNode, visibleSteps, visibleStep,
  isBasicImport, isResultStep, canJumpToStep, changeStep, prepareBasicProduct,
  validate, next, previous, progress, progressStatus, formatProgressMessage, close, show,
} = useResourcePackageWorkflow(emit, selectedImportType)

const canUpload = computed(() => selectedImportType.value === 'basic'
  ? props.canImportBasic
  : props.canImportResourcePackage)
const uploadAccept = computed(() => selectedImportType.value === 'basic'
  ? '.json,application/json'
  : '.zip,application/zip,application/x-zip-compressed')
const uploadText = computed(() => $t(selectedImportType.value === 'basic'
  ? 'Product.transfer.001-6'
  : 'Product.resourcePackage.001-4'))
const permissionTip = (permitted: boolean) => permitted ? undefined : $t('Import.file.677857-16')
const importOptions = computed(() => [
  {
    type: 'basic' as const,
    label: 'Product.transfer.001-2',
    description: 'Product.transfer.001-4',
    icon: 'FileTextOutlined',
    disabled: !props.canImportBasic,
  },
  {
    type: 'resource' as const,
    label: 'Product.transfer.001-3',
    description: 'Product.transfer.001-5',
    icon: 'FolderOpenOutlined',
    disabled: !props.canImportResourcePackage,
  },
])

const selectImportType = (type: ProductTransferType) => {
  if ((type === 'basic' && !props.canImportBasic) || (type === 'resource' && !props.canImportResourcePackage)) return
  selectedImportType.value = type
}

const handleUpload = (file: File) => {
  if (!canUpload.value) return false
  if (selectedImportType.value === 'basic') {
    return prepareBasicProduct(file)
  }
  return beforeUpload(file)
}

watch(visible, opened => {
  if (opened) {
    selectedImportType.value = props.canImportBasic || !props.canImportResourcePackage ? 'basic' : 'resource'
  }
})

defineExpose({ close, show })
</script>

<style scoped>
.resource-package-steps { margin-bottom: 24px; }
.resource-package-steps :deep(.resource-package-step--clickable .ant-steps-item-container) { cursor: pointer; }
.resource-package-type { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.resource-package-type__card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 88px;
  padding: 16px;
  border: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09));
  border-radius: 8px;
  background: var(--color-jet-fill, #fff);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.resource-package-type__card:hover:not(:disabled) { border-color: var(--jet-theme-primary); }
.resource-package-type__card.is-selected { border-color: var(--jet-theme-primary); background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.06)); }
.resource-package-type__card.is-disabled { cursor: not-allowed; opacity: 0.5; }
.resource-package-type__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.08));
  color: var(--jet-theme-primary);
  font-size: 18px;
}
.resource-package-type__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.resource-package-type__content strong { font-weight: 500; }
.resource-package-type__content small { color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); line-height: 1.5; }
.resource-package-type__check { color: var(--jet-theme-primary); font-size: 18px; }
@media (max-width: 640px) { .resource-package-type { grid-template-columns: 1fr; } }
.resource-alert { margin-top: 16px; }
.resource-alert--basic { margin: 0 0 16px; }
.resource-grid { margin-top: 12px; }
.metadata-preview { max-height: 520px; overflow: auto; background: #fafafa; }
.storage-policy-help { margin-left: 2px; }
.device-type-option { display: flex; align-items: center; justify-content: space-between; }
</style>
