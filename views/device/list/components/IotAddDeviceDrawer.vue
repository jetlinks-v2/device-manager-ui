<template>
  <a-modal :open="open" :width="isEditMode ? 680 : 960" :mask-closable="false" centered @cancel="onActiveClose">
    <template #title>
      <IotAddDeviceModalTitle :edit-mode="isEditMode" :current-step="currentStep" :creating="isCreating" />
    </template>
    <section class="add-device">
      <a-alert v-if="activeErrorMessage && !isCreating" type="error" show-icon :message="activeErrorMessage" />
      <a-form :ref="setActiveFormRef" class="add-device__form" layout="vertical" :model="activeForm" :rules="activeFormRules">
        <template v-if="isEditMode">
          <IotDeviceBasicFields :form="activeForm" :image-preview-url="activeImagePreviewUrl" :image-file-name="activeImageFileName" :area-tree-data="activeAreaTreeData" :group-tree-data="activeGroupTreeData" :group-multiple="isEditMode" show-icon :on-area-change="activeOnAreaChange" :handle-image-before-upload="activeHandleImageBeforeUpload" :on-select-preset-icon="activeSelectPresetIcon" />
        </template>
        <template v-else>
          <template v-if="currentStep === 0">
            <IotAddDeviceLibraryStep
              v-if="createMode === 'library'"
              :key="libraryStepKey"
              :templates="libraryProducts"
              :selected-template-key="selectedTemplateKey"
              :selectable-device-type="props.deviceType"
              :tag-filter-groups="libraryTagGroups"
              :total="libraryTotal"
              :page-index="libraryPageIndex"
              :page-size="libraryPageSize"
              :loading="libraryLoading"
              :tag-loading="libraryTagLoading"
              @select-template="handleTemplateSelect"
              @query-change="loadDeviceLibraryTemplates(true, $event)"
            />
            <IotAddDeviceCustomStep
              v-else
              :open="open"
              :available-products="availableProducts"
              :library-products="deviceTemplateProducts"
              :selected-product-key="selectedProductKey"
              :selected-template-key="selectedTemplateKey"
              :template-open="templateOpen"
              :product-message="productMessage"
              :library-message="libraryMessage"
              :category-label="categoryLabel"
              :product-loading="productLoading"
              :template-loading="deviceTemplateLoading"
              @back="switchToLibrary"
              @select-product="selectProduct"
              @select-template="selectTemplate"
              @update:template-open="handleTemplateOpen"
              @add-template="addTemplateToProject"
            />
          </template>
          <template v-else-if="isCreating">
            <IotDeviceQuotaExceeded v-if="quotaExceededState.detected" :state="quotaExceededState" />
            <IotAddDeviceInstallProgress v-else :state="installProgressState" :device-name="form.name" />
          </template>
          <template v-else>
            <IotAddDeviceSelectedTemplate
              :template="selectedTemplate"
              @change="backToLibrary"
            />
            <IotDeviceBasicFields :form="activeForm" :image-preview-url="activeImagePreviewUrl" :image-file-name="activeImageFileName" :area-tree-data="activeAreaTreeData" :group-tree-data="activeGroupTreeData" stack-fields :on-area-change="activeOnAreaChange" :handle-image-before-upload="activeHandleImageBeforeUpload" :on-select-preset-icon="activeSelectPresetIcon" />
          </template>
        </template>
      </a-form>
    </section>
    <template v-if="isEditMode || currentStep > 0 && (!isCreating || hasInstallError)" #footer>
      <IotAddDeviceModalFooter
        :show-previous="false"
        :previous-text="$t('IotDeviceList.add.changeDevice')"
        :busy="activePrimaryBusy"
        :submit-disabled="activeSubmitDisabled"
        :submit-text="activeSubmitText"
        :show-extra-submit="showUpdateAndCreate" :extra-busy="updateAndCreateBusy" :extra-submit-text="updateAndCreateSubmitText" :extra-submit-disabled="updateAndCreateDisabled" :extra-submit-tooltip="updateAndCreateDisabledReason"
        @close="onActiveClose"
        @previous="backToLibrary"
        @submit="onActiveSubmit"
        @extra-submit="onUpdateAndSubmit"
      />
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import IotAddDeviceCustomStep from './IotAddDeviceCustomStep.vue'
import IotAddDeviceLibraryStep from './IotAddDeviceLibraryStep.vue'
import IotAddDeviceModalFooter from './IotAddDeviceModalFooter.vue'
import IotAddDeviceModalTitle from './IotAddDeviceModalTitle.vue'
import IotAddDeviceInstallProgress from './IotAddDeviceInstallProgress.vue'
import IotDeviceQuotaExceeded from './IotDeviceQuotaExceeded.vue'
import IotAddDeviceSelectedTemplate from './IotAddDeviceSelectedTemplate.vue'
import IotDeviceBasicFields from './IotDeviceBasicFields.vue'
import { useIotAddDeviceDrawer, type IotAddDeviceCreatedPayload } from '../hooks/useIotAddDeviceDrawer'
import { useIotEditDeviceDrawer } from '../hooks/useIotEditDeviceDrawer'
import { useIotDeviceQuotaExceeded } from '../hooks/useIotDeviceQuotaExceeded'
import type { IotDevice } from '../types'

const props = withDefaults(defineProps<{
  open: boolean
  projectId: string
  deviceType?: string
  parentId?: string
  device?: IotDevice | null
}>(), { device: null })
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', payload: IotAddDeviceCreatedPayload): void
  (e: 'saved', deviceId: string): void
}>()
const isEditMode = computed(() => Boolean(props.device))
const { t: $t } = useI18n()
const currentStep = ref(0)
const createMode = ref<'library' | 'custom'>('library')
const libraryStepKey = ref(0)
const productSyncPrepared = ref(false)
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
  selectedProductKey, selectedTemplateKey, templateOpen,
  productMessage, libraryMessage, libraryLoading, libraryTagLoading, productLoading, deviceTemplateLoading,
  busy, submitAction, errorMessage, imagePreviewUrl, imageFileName, formRef, form, formRules, installProgressState,
  availableProducts, areaTreeData, groupTreeData, libraryProducts, libraryTagGroups,
  libraryTotal, libraryPageIndex, libraryPageSize, libraryProductSyncState, deviceTemplateProducts, selectedTemplate,
  updateAndCreateDisabledReason, updateAndCreateBusy,
  updateAndCreateDisabled, updateAndCreateSubmitText, categoryLabel,
  selectProduct, selectTemplate, onAreaChange, handleImageBeforeUpload, selectPresetIcon, backToLibrary: resetBasicFields, addTemplateToProject,
  loadDeviceLibraryTemplates, loadProducts, loadConfigOptions, loadDeviceTemplates,
  prepareConfirmStep: prepareProductSync, onClose, onSubmit, onUpdateAndSubmit,
} = useIotAddDeviceDrawer(addDrawerProps, {
  updateOpen: (value) => emit('update:open', value),
  created: (payload) => emit('created', payload),
})

const {
  busy: editBusy,
  errorMessage: editErrorMessage,
  imagePreviewUrl: editImagePreviewUrl,
  imageFileName: editImageFileName,
  formRef: editFormRef,
  form: editForm,
  formRules: editFormRules,
  areaTreeData: editAreaTreeData,
  groupTreeData: editGroupTreeData,
  onAreaChange: onEditAreaChange,
  handleImageBeforeUpload: handleEditImageBeforeUpload,
  selectPresetIcon: selectEditPresetIcon,
  onUpdateOpen: onEditUpdateOpen,
  onSubmit: onEditSubmit,
} = useIotEditDeviceDrawer(editDrawerProps, {
  updateOpen: (value) => emit('update:open', value),
  saved: (deviceId) => emit('saved', deviceId),
})

const activePrimaryBusy = computed(() =>
  isEditMode.value
    ? editBusy.value
    : submitAction.value === 'create' || libraryProductSyncState.value.checking,
)
const activeSubmitDisabled = computed(() => {
  if (isEditMode.value) return !props.device
  return busy.value && submitAction.value !== 'create'
})
const activeErrorMessage = computed(() => isEditMode.value ? editErrorMessage.value : errorMessage.value)
const activeForm = computed(() => isEditMode.value ? editForm : form)
const activeFormRules = computed(() => isEditMode.value ? editFormRules : formRules)
const activeImagePreviewUrl = computed(() => isEditMode.value ? editImagePreviewUrl.value : imagePreviewUrl.value)
const activeImageFileName = computed(() => isEditMode.value ? editImageFileName.value : imageFileName.value)
const activeAreaTreeData = computed(() => isEditMode.value ? editAreaTreeData.value : areaTreeData.value)
const activeGroupTreeData = computed(() => isEditMode.value ? editGroupTreeData.value : groupTreeData.value)
const activeOnAreaChange = computed(() => isEditMode.value ? onEditAreaChange : onAreaChange)
const activeHandleImageBeforeUpload = computed(() =>
  isEditMode.value ? handleEditImageBeforeUpload : handleImageBeforeUpload,
)
const isCreating = computed(() => !isEditMode.value && (
  submitAction.value !== '' || installProgressState.value.hasError
))
const hasInstallError = computed(() =>
  !isEditMode.value && installProgressState.value.hasError,
)
const activeSelectPresetIcon = computed(() => isEditMode.value ? selectEditPresetIcon : selectPresetIcon)
const showUpdateAndCreate = computed(() =>
  !hasInstallError.value
  && !isEditMode.value
  && currentStep.value === 1
  && createMode.value === 'library'
  && libraryProductSyncState.value.installed,
)
const activeSubmitText = computed(() => {
  if (isEditMode.value) return editBusy.value ? $t('IotDeviceList.add.saving') : $t('IotDeviceList.add.save')
  if (hasInstallError.value) return $t('IotDeviceList.add.installProgressClose')
  if (currentStep.value === 0) return $t('IotDeviceList.add.next')
  return busy.value && submitAction.value === 'create' ? $t('IotDeviceList.add.creating') : $t('IotDeviceList.add.next')
})
const { quotaExceededState } = useIotDeviceQuotaExceeded(
  computed(() => props.projectId),
  computed(() => installProgressState.value.logs),
)
type FormExpose = {
  validate?: () => Promise<unknown>
  clearValidate?: () => void
}
function setActiveFormRef(value: Element | ComponentPublicInstance | null) {
  const formExpose = value as FormExpose | null
  if (isEditMode.value) {
    editFormRef.value = formExpose
    return
  }
  formRef.value = formExpose
}
function onActiveClose() {
  if (isEditMode.value) {
    onEditUpdateOpen(false)
    return
  }
  onClose()
}
function onActiveSubmit() {
  if (isEditMode.value) {
    void onEditSubmit()
    return
  }
  if (hasInstallError.value) {
    onClose()
    return
  }
  if (currentStep.value === 0) {
    if (createMode.value === 'library' && !selectedTemplateKey.value) {
      onlyMessage($t('IotDeviceList.add.selectTemplateFirst'), 'warning')
      return
    }
    if (createMode.value === 'custom' && !selectedProductKey.value) {
      onlyMessage($t('IotDeviceList.add.selectProductFirst'), 'warning')
      return
    }
    currentStep.value = 1
    void loadConfigOptions()
    if (createMode.value === 'library') void prepareSecondStep()
    return
  }
  void submitSecondStep()
}
function handleTemplateSelect(templateId: string) {
  selectTemplate(templateId)
  currentStep.value = 1
  void loadConfigOptions()
  void prepareSecondStep()
}
function backToLibrary() {
  currentStep.value = 0
  productSyncPrepared.value = false
  resetBasicFields()
}
function switchToLibrary() {
  createMode.value = 'library'
  void loadDeviceLibraryTemplates()
}
function handleTemplateOpen(value: boolean) {
  templateOpen.value = value
  if (value) void loadDeviceTemplates()
}
async function prepareSecondStep() {
  productSyncPrepared.value = false
  try {
    // 第二步直接保存，进入时提前完成模板产品同步检查，避免提交时绕过更新限制。
    await prepareProductSync()
    productSyncPrepared.value = true
    return true
  } catch (error) {
    if (error instanceof Error) errorMessage.value = error.message
    return false
  }
}
async function submitSecondStep() {
  if (createMode.value === 'library' && !productSyncPrepared.value) {
    const prepared = await prepareSecondStep()
    if (!prepared) return
  }
  await onSubmit()
}
watch(
  () => props.open,
  (open) => {
    if (!open || isEditMode.value) return
    currentStep.value = 0
    createMode.value = 'library'
    productSyncPrepared.value = false
    libraryStepKey.value += 1
  },
)
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
