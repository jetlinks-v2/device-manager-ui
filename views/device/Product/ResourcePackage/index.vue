<template>
  <a-modal
    v-model:open="visible"
    :title="$t('Product.resourcePackage.001-0')"
    :width="900"
    :mask-closable="false"
    :confirm-loading="importing"
    @cancel="close"
  >
    <a-steps :current="visibleStep" size="small" class="resource-package-steps">
      <a-step v-for="item in visibleSteps" :key="item.key" :title="$t(item.label)" />
    </a-steps>

    <a-upload-dragger
      v-if="step === 0"
      :show-upload-list="false"
      :before-upload="beforeUpload"
      accept=".zip,application/zip,application/x-zip-compressed"
    >
      <p class="ant-upload-drag-icon"><AIcon type="InboxOutlined" /></p>
      <p class="ant-upload-text">{{ $t('Product.resourcePackage.001-4') }}</p>
      <p class="ant-upload-hint">{{ $t('Product.resourcePackage.001-5') }}</p>
    </a-upload-dragger>

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

    <template v-else-if="step === 2">
      <a-alert v-for="error in accessPreflightErrors" :key="error" class="resource-alert" type="error" show-icon :message="error" />
      <a-alert v-if="showSelectionValidation && hasIncompleteLocalSelection" class="resource-alert" type="warning" show-icon :message="$t('Product.resourcePackage.001-48')" />
      <a-descriptions v-if="product.accessProvider" class="gateway-type" size="small" :column="1" bordered>
        <a-descriptions-item :label="$t('Product.resourcePackage.001-9')">{{ gatewayProviderName }}</a-descriptions-item>
      </a-descriptions>
      <a-row :gutter="[12, 0]" class="resource-grid">
        <a-col v-if="manifest?.accessResources?.gateway" :span="24">
          <ResourceSelection
            v-model="resourceSelections.gateway"
            resource-type="gateway"
            :title="$t('Product.resourcePackage.001-26')"
            :package-resource="manifest.accessResources.gateway"
            :options="localOptions.gateway"
            @update:model-value="handleGatewaySelection"
          />
        </a-col>
        <template v-if="!isLocalGateway">
          <a-col
            v-for="type in dependentResourceTypes"
            :key="type.key"
            :span="type.key === 'network' ? 24 : 12"
          >
            <ResourceSelection
              v-model="resourceSelections[type.key]"
              :resource-type="type.key"
              :title="$t(type.label)"
              :package-resource="manifest?.accessResources?.[type.key]"
              :options="localOptions[type.key]"
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
              <span>{{ item.message }}</span>
            </a-space>
          </a-list-item>
        </template>
      </a-list>
    </template>

    <template #footer>
      <a-button v-if="step > 0 && step < 3" @click="previous">{{ $t('Product.resourcePackage.001-16') }}</a-button>
      <a-button v-if="step > 0 && step < 2" type="primary" :disabled="!canContinue || !!storagePolicyError" :loading="loading" @click="next">
        {{ $t(hasAccessResources ? 'Product.resourcePackage.001-47' : 'Product.resourcePackage.001-17') }}
      </a-button>
      <a-button v-if="step === 2" type="primary" :disabled="!canContinue" :loading="loading" @click="next">
        {{ $t('Product.resourcePackage.001-17') }}
      </a-button>
      <a-button v-if="step === 3" @click="close">{{ $t('Product.resourcePackage.001-18') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'
import ResourceSelection from './components/ResourceSelection.vue'
import { useResourcePackageWorkflow } from './useResourcePackageWorkflow'

const emit = defineEmits<{ success: [] }>()
const {
  visible, step, loading, importing, productFormRef, product, metadataVisible, accessPreflightErrors, storagePolicyError,
  showSelectionValidation, categoryTree, resourceSelections, localOptions, manifest,
  storagePolicyOptions, dependentResourceTypes, isLocalGateway, gatewayProviderName,
  metadataPreview, hasIncompleteLocalSelection, canContinue, imageTypes, productRules,
  deviceTypes, beforeUpload, changeCategory, changeDeviceType, handleGatewaySelection,
  handleResourceSelection, filterSelectNode, hasAccessResources, visibleSteps, visibleStep,
  next, previous, progress, progressStatus, close, show,
} = useResourcePackageWorkflow(emit)

defineExpose({ show })</script>

<style scoped>
.resource-package-steps { margin-bottom: 24px; }
.resource-alert { margin-top: 16px; }
.resource-alert--basic { margin: 0 0 16px; }
.gateway-type { margin-top: 16px; }
.resource-grid { margin-top: 12px; }
.metadata-preview { max-height: 520px; overflow: auto; background: #fafafa; }
.storage-policy-help { margin-left: 2px; }
.device-type-option { display: flex; align-items: center; justify-content: space-between; }
</style>
