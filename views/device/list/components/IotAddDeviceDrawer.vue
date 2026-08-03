<template>
  <a-modal :open="open" :width="isEditMode ? 680 : 960" :mask-closable="false" centered @cancel="onActiveClose">
    <template #title>
      <IotAddDeviceModalTitle :edit-mode="isEditMode" />
    </template>
    <section class="add-device">
      <a-steps v-if="!isEditMode" class="add-device__steps" size="small" :current="currentStep" :items="createSteps" />
      <a-alert v-if="activeErrorMessage" type="error" show-icon :message="activeErrorMessage" />
      <a-form :ref="setActiveFormRef" class="add-device__form" layout="vertical" :model="activeForm" :rules="activeFormRules">
        <template v-if="isEditMode">
          <IotDeviceBasicFields :form="activeForm" :image-preview-url="activeImagePreviewUrl" :image-file-name="activeImageFileName" :area-tree-data="activeAreaTreeData" :group-select-options="activeGroupSelectOptions" :group-multiple="isEditMode" :on-area-change="activeOnAreaChange" :handle-image-before-upload="activeHandleImageBeforeUpload" />
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
              @select-template="selectTemplate"
              @query-change="loadDeviceLibraryTemplates(true, $event)"
              @custom="switchToCustom"
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
          <IotDeviceBasicFields v-else-if="currentStep === 1" :form="activeForm" :image-preview-url="activeImagePreviewUrl" :image-file-name="activeImageFileName" :area-tree-data="activeAreaTreeData" :group-select-options="activeGroupSelectOptions" :on-area-change="activeOnAreaChange" :handle-image-before-upload="activeHandleImageBeforeUpload" />
          <IotAddDeviceConfirmStep v-else :form="form" :selected-product="selectedProduct" :selected-template="selectedTemplate" :group-label="selectedGroupLabel" :mode="createMode" :product-sync-state="libraryProductSyncState" :install-progress="installProgressState" />
        </template>
      </a-form>
    </section>
    <template #footer>
      <IotAddDeviceModalFooter
        :show-previous="!isEditMode && currentStep > 0"
        :busy="activePrimaryBusy"
        :submit-disabled="activeSubmitDisabled"
        :submit-text="activeSubmitText"
        :show-extra-submit="showUpdateAndCreate" :extra-busy="updateAndCreateBusy" :extra-submit-text="updateAndCreateSubmitText" :extra-submit-disabled="updateAndCreateDisabled" :extra-submit-tooltip="updateAndCreateDisabledReason"
        @close="onActiveClose"
        @previous="currentStep -= 1"
        @submit="onActiveSubmit"
        @extra-submit="onUpdateAndSubmit"
      />
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, h, ref, resolveComponent, watch, type ComponentPublicInstance } from 'vue'
import { Tooltip } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import IotAddDeviceCustomStep from './IotAddDeviceCustomStep.vue'
import IotAddDeviceConfirmStep from './IotAddDeviceConfirmStep.vue'
import IotAddDeviceLibraryStep from './IotAddDeviceLibraryStep.vue'
import IotAddDeviceModalFooter from './IotAddDeviceModalFooter.vue'
import IotAddDeviceModalTitle from './IotAddDeviceModalTitle.vue'
import IotDeviceBasicFields from './IotDeviceBasicFields.vue'
import { useIotAddDeviceDrawer, type IotAddDeviceCreatedPayload } from '../hooks/useIotAddDeviceDrawer'
import { useIotEditDeviceDrawer } from '../hooks/useIotEditDeviceDrawer'
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
const stepHelpIcon = resolveComponent('AIcon')
const createSteps = computed(() => [
  { title: stepTitle($t('IotDeviceList.add.stepLibrary'), $t('IotDeviceList.add.libraryDesc')) },
  { title: $t('IotDeviceList.add.stepConfig') },
  { title: stepTitle($t('IotDeviceList.add.stepConfirm'), $t('IotDeviceList.add.confirmDesc')) },
])
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
  busy, submitAction, errorMessage, imagePreviewUrl, imageFileName, formRef, form, formRules,
  availableProducts, areaTreeData, groupSelectOptions, libraryProducts, libraryTagGroups,
  libraryTotal, libraryPageIndex, libraryPageSize, libraryProductSyncState, deviceTemplateProducts,
  selectedProduct, selectedTemplate, updateAndCreateDisabledReason, updateAndCreateBusy,
  updateAndCreateDisabled, updateAndCreateSubmitText, categoryLabel,
  installProgressState,
  selectProduct, selectTemplate, onAreaChange, handleImageBeforeUpload, addTemplateToProject,
  loadDeviceLibraryTemplates, loadProducts, loadConfigOptions, loadDeviceTemplates,
  prepareConfirmStep, onClose, onSubmit, onUpdateAndSubmit,
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
  groupSelectOptions: editGroupSelectOptions,
  onAreaChange: onEditAreaChange,
  handleImageBeforeUpload: handleEditImageBeforeUpload,
  onUpdateOpen: onEditUpdateOpen,
  onSubmit: onEditSubmit,
} = useIotEditDeviceDrawer(editDrawerProps, {
  updateOpen: (value) => emit('update:open', value),
  saved: (deviceId) => emit('saved', deviceId),
})

const activePrimaryBusy = computed(() =>
  isEditMode.value ? editBusy.value : submitAction.value === 'create',
)
const activeSubmitDisabled = computed(() =>
  isEditMode.value ? !props.device : busy.value && submitAction.value !== 'create',
)
const activeErrorMessage = computed(() => isEditMode.value ? editErrorMessage.value : errorMessage.value)
const activeForm = computed(() => isEditMode.value ? editForm : form)
const activeFormRules = computed(() => isEditMode.value ? editFormRules : formRules)
const activeImagePreviewUrl = computed(() => isEditMode.value ? editImagePreviewUrl.value : imagePreviewUrl.value)
const activeImageFileName = computed(() => isEditMode.value ? editImageFileName.value : imageFileName.value)
const activeAreaTreeData = computed(() => isEditMode.value ? editAreaTreeData.value : areaTreeData.value)
const activeGroupSelectOptions = computed(() => isEditMode.value ? editGroupSelectOptions.value : groupSelectOptions.value)
const activeOnAreaChange = computed(() => isEditMode.value ? onEditAreaChange : onAreaChange)
const activeHandleImageBeforeUpload = computed(() =>
  isEditMode.value ? handleEditImageBeforeUpload : handleImageBeforeUpload,
)
const showUpdateAndCreate = computed(() =>
  !isEditMode.value
  && currentStep.value === 2
  && createMode.value === 'library'
  && libraryProductSyncState.value.installed,
)
const activeSubmitText = computed(() => {
  if (isEditMode.value) return editBusy.value ? $t('IotDeviceList.add.saving') : $t('IotDeviceList.add.save')
  if (currentStep.value < 2) return $t('IotDeviceList.add.next')
  return busy.value && submitAction.value === 'create' ? $t('IotDeviceList.add.creating') : $t('IotDeviceList.add.confirmCreate')
})

const selectedGroupLabel = computed(() =>
  groupSelectOptions.value.find((item) => item.value === form.groupId)?.label ?? '',
)
type FormExpose = {
  validate?: () => Promise<unknown>
  clearValidate?: () => void
}
function stepTitle(title: string, help: string) {
  return h('span', { class: 'add-device__step-title' }, [
    h('span', title),
    h(Tooltip, { title: help }, {
      default: () => h(stepHelpIcon, {
        type: 'QuestionCircleOutlined',
        class: 'add-device__step-help',
        'aria-hidden': 'true',
      }),
    }),
  ])
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
    return
  }
  if (currentStep.value === 1) {
    void goConfirmStep()
    return
  }
  void onSubmit()
}
function switchToCustom() {
  createMode.value = 'custom'
  void loadProducts()
}
function switchToLibrary() {
  createMode.value = 'library'
  void loadDeviceLibraryTemplates()
}
function handleTemplateOpen(value: boolean) {
  templateOpen.value = value
  if (value) void loadDeviceTemplates()
}
async function goConfirmStep() {
  try {
    await formRef.value?.validate?.()
    if (createMode.value === 'library') {
      await prepareConfirmStep()
    }
    currentStep.value = 2
  } catch (error) {
    // 表单字段错误或安装态检查失败时都停留在当前步骤，由页面错误区承接反馈。
    if (error instanceof Error) errorMessage.value = error.message
  }
}
watch(
  () => props.open,
  (open) => {
    if (!open || isEditMode.value) return
    currentStep.value = 0
    createMode.value = 'library'
    libraryStepKey.value += 1
  },
)
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
