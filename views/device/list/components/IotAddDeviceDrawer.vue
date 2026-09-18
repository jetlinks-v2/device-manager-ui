<template>
  <a-modal :open="open" :width="isEditMode ? 680 : 960" :mask-closable="false" centered @cancel="onActiveClose">
    <template #title>
      <IotAddDeviceModalTitle :edit-mode="isEditMode" :current-step="currentStep" :creating="isCreating" :creation-source="creationSource" />
    </template>
    <section class="add-device">
      <a-alert v-if="activeErrorMessage && !isCreating" type="error" show-icon :message="activeErrorMessage" />
      <template v-if="creationExtension && selectedProduct">
        <IotAddDeviceSelectedTemplate :template="selectedProduct" @change="backToSource" />
        <component
          ref="creationExtensionRef"
          :is="creationExtension.component"
          embedded
          :product="selectedProduct"
          :device-form="form"
          @created="handleExtensionCreated"
        >
          <template #identity-icon>
            <IotDeviceBasicFields
              :form="form"
              :area-tree-data="areaTreeData"
              :group-tree-data="groupTreeData"
              stack-fields
              show-icon
              :show-name="false"
              :show-id="false"
              :show-area="false"
              :show-group="false"
              :show-description="false"
              :on-area-change="onAreaChange"
            />
          </template>
          <template #identity-name>
            <IotDeviceBasicFields
              :form="form"
              :area-tree-data="areaTreeData"
              :group-tree-data="groupTreeData"
              stack-fields
              :show-icon="false"
              :show-id="false"
              :show-area="false"
              :show-group="false"
              :show-description="false"
              :on-area-change="onAreaChange"
            />
          </template>
          <template #after-configuration>
            <IotDeviceBasicFields
              :form="form"
              :area-tree-data="areaTreeData"
              :group-tree-data="groupTreeData"
              stack-fields
              :show-name="false"
              :show-id="false"
              :show-area="true"
              :show-group="true"
              :show-description="true"
              :on-area-change="onAreaChange"
            />
          </template>
        </component>
      </template>
      <a-form v-else :ref="setActiveFormRef" class="add-device__form" layout="vertical" :model="activeForm" :rules="activeFormRules">
        <IotDeviceBasicFields
          v-if="isEditMode"
          :form="activeForm"
          :area-tree-data="activeAreaTreeData"
          :group-tree-data="activeGroupTreeData"
          :group-multiple="true"
          show-icon
          :on-area-change="activeOnAreaChange"
        />
        <template v-else-if="currentStep === 0">
          <a-segmented
            v-if="isLibraryAvailable"
            :value="creationSource"
            class="add-device__source-switch"
            :options="sourceOptions"
            @change="selectSource($event as DeviceCreationSource)"
          />
          <IotAddDeviceLibraryStep
            v-if="creationSource === 'library'"
            :templates="libraryProducts"
            :selected-template-key="selectedTemplateKey"
            :selectable-device-type="props.deviceType"
            :tag-filter-groups="libraryTagGroups"
            :has-more="libraryHasMore"
            :page-index="libraryPageIndex"
            :page-size="libraryPageSize"
            :loading="libraryLoading"
            :tag-loading="libraryTagLoading"
            @select-template="handleTemplateSelect"
            @query-change="loadDeviceLibraryTemplates(true, $event)"
          />
          <IotAddDeviceProductStep
            v-else
            :category-tree="categoryTree"
            :category-loading="categoryLoading"
            :selected-category-id="selectedCategoryId"
            :products="productCandidates"
            :selected-product-key="selectedProductKey"
            :filter-terms="productFilterTerms"
            :total="productTotal"
            :page-index="productPageIndex"
            :page-size="productPageSize"
            :loading="productLoading"
            :message="productMessage"
            @select-product="handleProductSelect"
            @select-category="selectProductCategory"
            @select-unclassified="selectUnclassifiedProductCategory"
            @query-change="loadProductCandidates(true, $event)"
          />
        </template>
        <template v-else-if="isCreating">
          <IotAddDeviceInstallProgress :state="installProgressState" :device-name="form.name" />
        </template>
        <template v-else>
          <IotAddDeviceSelectedTemplate :template="selectedSource as any" @change="backToSource" />
          <IotDeviceBasicFields
            :form="form"
            :area-tree-data="areaTreeData"
            :group-tree-data="groupTreeData"
            stack-fields
            :on-area-change="onAreaChange"
            show-icon
          />
        </template>
      </a-form>
    </section>
    <template v-if="isEditMode || (currentStep > 0 && (!isCreating || installProgressState.hasError))" #footer>
      <IotAddDeviceModalFooter
        :show-previous="false"
        :busy="activePrimaryBusy"
        :submit-disabled="activeSubmitDisabled"
        :submit-text="activeSubmitText"
        @close="onActiveClose"
        @submit="onActiveSubmit"
      />
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeviceCreationSource } from '@device-manager-ui/api/device'
import IotAddDeviceProductStep from './IotAddDeviceProductStep.vue'
import IotAddDeviceLibraryStep from './IotAddDeviceLibraryStep.vue'
import IotAddDeviceModalFooter from './IotAddDeviceModalFooter.vue'
import IotAddDeviceModalTitle from './IotAddDeviceModalTitle.vue'
import IotAddDeviceInstallProgress from './IotAddDeviceInstallProgress.vue'
import IotAddDeviceSelectedTemplate from './IotAddDeviceSelectedTemplate.vue'
import IotDeviceBasicFields from './IotDeviceBasicFields.vue'
import { useIotAddDeviceDrawer, type IotAddDeviceCreatedPayload } from '../hooks/useIotAddDeviceDrawer'
import { useIotEditDeviceDrawer } from '../hooks/useIotEditDeviceDrawer'
import type { IotDevice } from '../types'
import type { DeviceCreationExtension } from '@device-manager-ui/deviceCreationExtension'
import { moduleRegistry } from '@jetlinks-web-core/utils/module-registry'

const props = withDefaults(defineProps<{
  open: boolean
  projectId: string
  deviceType?: string
  parentId?: string
  device?: IotDevice | null
}>(), { device: null })
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'created', payload: IotAddDeviceCreatedPayload): void
  (event: 'saved', deviceId: string): void
}>()

const { t: $t } = useI18n()
const isEditMode = computed(() => Boolean(props.device))
const currentStep = ref(0)
const creationExtension = ref<DeviceCreationExtension>()
const addDrawerProps = {
  get open() { return props.open && !isEditMode.value },
  get projectId() { return props.projectId },
  get deviceType() { return props.deviceType },
  get parentId() { return props.parentId },
}
const editDrawerProps = {
  get open() { return props.open && isEditMode.value },
  get projectId() { return props.projectId },
  get device() { return props.device },
}
const {
  creationSource, isLibraryAvailable, selectedProductKey, selectedProduct, selectedTemplateKey, selectedSource,
  productMenuAvailable,
  productMessage, productLoading, productFilterTerms, libraryLoading, libraryTagLoading, busy, submitAction, errorMessage,
  formRef, form, formRules, installProgressState,
  areaTreeData, groupTreeData, configOptionsLoading,
  categoryTree, categoryLoading, selectedCategoryId, productCandidates, productTotal, productPageIndex, productPageSize,
  libraryProducts, libraryTagGroups, libraryPageIndex, libraryPageSize, libraryHasMore,
  selectSource, selectProduct, selectTemplate, selectProductCategory, selectUnclassifiedProductCategory,
  loadProductCandidates, loadDeviceLibraryTemplates, loadConfigOptions, clearBasicFields, onClose, onSubmit, bindCreatedDevice,
  onAreaChange,
} = useIotAddDeviceDrawer(addDrawerProps, {
  updateOpen: (value) => emit('update:open', value),
  created: (payload) => emit('created', payload),
})
const {
  busy: editBusy, errorMessage: editErrorMessage,
  formRef: editFormRef, form: editForm, formRules: editFormRules, areaTreeData: editAreaTreeData, groupTreeData: editGroupTreeData,
  onAreaChange: onEditAreaChange,
  onUpdateOpen: onEditUpdateOpen, onSubmit: onEditSubmit,
} = useIotEditDeviceDrawer(editDrawerProps, {
  updateOpen: (value) => emit('update:open', value),
  saved: (deviceId) => emit('saved', deviceId),
})

const sourceOptions = computed(() => [
  { value: 'library', label: $t('IotDeviceList.add.librarySource') },
  ...(productMenuAvailable.value ? [{ value: 'product', label: $t('IotDeviceList.add.productSource') }] : []),
])
const activePrimaryBusy = computed(() => isEditMode.value ? editBusy.value : busy.value)
const activeSubmitDisabled = computed(() => isEditMode.value
  ? !props.device
  : busy.value || configOptionsLoading.value || Boolean(creationExtension.value && !selectedProduct.value),
)
const activeErrorMessage = computed(() => isEditMode.value ? editErrorMessage.value : errorMessage.value)
const activeForm = computed(() => isEditMode.value ? editForm : form)
const activeFormRules = computed(() => isEditMode.value ? editFormRules : formRules)
const activeAreaTreeData = computed(() => isEditMode.value ? editAreaTreeData.value : areaTreeData.value)
const activeGroupTreeData = computed(() => isEditMode.value ? editGroupTreeData.value : groupTreeData.value)
const activeOnAreaChange = computed(() => isEditMode.value ? onEditAreaChange : onAreaChange)
const isCreating = computed(() => !isEditMode.value && busy.value && submitAction.value === 'install')
type CreationExtensionExpose = { submit?: () => Promise<void> | void }
const creationExtensionRef = ref<CreationExtensionExpose | null>(null)
const activeSubmitText = computed(() => {
  if (isEditMode.value) return editBusy.value ? $t('IotDeviceList.add.saving') : $t('IotDeviceList.add.save')
  if (currentStep.value === 0) return $t('IotDeviceList.add.next')
  return busy.value ? $t('IotDeviceList.add.creating') : $t('IotDeviceList.add.confirm')
})

type FormExpose = { validate?: () => Promise<unknown>; clearValidate?: () => void }
function setActiveFormRef(value: Element | ComponentPublicInstance | null) {
  if (isEditMode.value) editFormRef.value = value as FormExpose | null
  else formRef.value = value as FormExpose | null
}
function onActiveClose() {
  if (isEditMode.value) onEditUpdateOpen(false)
  else onClose()
}
function backToSource() {
  creationExtension.value = undefined
  currentStep.value = 0
  clearBasicFields()
}

/**
 * 两种来源在选中卡片后都进入同一份设备配置，避免首步因没有操作栏而停留。
 */
function enterConfigurationStep() {
  currentStep.value = 1
  void loadConfigOptions()
}

function handleProductSelect(productId: string) {
  selectProduct(productId)
  const product = selectedProduct.value
  const extension = product ? findCreationExtension(product.accessProvider) : undefined
  if (extension) {
    creationExtension.value = extension
    enterConfigurationStep()
    return
  }
  enterConfigurationStep()
}

function handleTemplateSelect(templateId: string) {
  selectTemplate(templateId)
  enterConfigurationStep()
}

function onActiveSubmit() {
  if (isEditMode.value) {
    void onEditSubmit()
    return
  }
  if (creationExtension.value) {
    void submitExtension()
    return
  }
  void onSubmit()
}

async function submitExtension() {
  try {
    await formRef.value?.validate?.()
    await creationExtensionRef.value?.submit?.()
  } catch {
    // 基础字段与媒体专属字段各自负责呈现校验错误。
  }
}

/** 业务模块按产品接入方式接管专属创建，不让通用抽屉知晓领域接口或配置字段。 */
function findCreationExtension(accessProvider?: string) {
  return moduleRegistry
    .getAllModuleIds()
    .flatMap((moduleId) => Object.values(
      moduleRegistry.getResource(moduleId, 'deviceCreationExtensions') as Record<string, DeviceCreationExtension>,
    ))
    .find((extension) => extension.matches(accessProvider))
}

async function handleExtensionCreated(payload: IotAddDeviceCreatedPayload) {
  if (selectedProduct.value) await bindCreatedDevice(payload.deviceId, selectedProduct.value)
  emit('created', payload)
  emit('update:open', false)
}

watch(() => props.open, (open) => {
  if (!open || isEditMode.value) return
  currentStep.value = 0
  creationExtension.value = undefined
})
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
