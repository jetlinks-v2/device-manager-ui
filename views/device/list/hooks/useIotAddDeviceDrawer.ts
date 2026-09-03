import { computed, nextTick, reactive, ref, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useI18n } from 'vue-i18n'
import {
  createProductFromDeviceTemplate_api,
  createDevice_api,
  queryDeviceProductById_api,
  queryDeviceProducts_api,
  queryDeviceTemplates_api,
  type DeviceLibraryInstallProgress,
  type DeviceLibraryTemplateQueryInput,
  type DeviceTemplateProductInput,
  type IotDeviceLibraryTagGroup,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import {
  installDeviceLibraryAndCreateDevice_api,
  joinDeviceLibraryToProject_api,
  queryDeviceLibraryTags_api,
  queryDeviceLibraryTemplates_api,
} from '@device-manager-ui/api/device-library'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import { formatIconValueFont } from '@jetlinks-web-core/components/IconValue'
import { categoryLabel, toTemplateProductOption } from './iotAddDeviceProductOptions'
import { buildAreaTreeData, isSelectableDeviceArea } from './iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from './iotDeviceGroupTreeOptions'
import { saveIotDeviceAreaGroupBindings } from './iotDeviceAreaGroupBindings'
import { useIotDeviceImageUpload } from './useIotDeviceImageUpload'
import { useIotDeviceLibraryProductSync } from './useIotDeviceLibraryProductSync'

export type IotAddDeviceDrawerProps = {
  open: boolean
  projectId: string
  initialProductId?: string
  deviceType?: string
  parentId?: string
}

export type IotAddDeviceCreatedPayload = {
  deviceId: string
  deviceType?: string
}

export type IotAddDeviceInstallProgressLog = DeviceLibraryInstallProgress & {
  id: string
}

export type IotAddDeviceInstallProgressState = {
  logs: IotAddDeviceInstallProgressLog[]
  running: boolean
  hasError: boolean
}

type IotAddDeviceDrawerHandlers = {
  updateOpen: (value: boolean) => void
  created: (payload: IotAddDeviceCreatedPayload) => void
}

export function useIotAddDeviceDrawer(props: IotAddDeviceDrawerProps, handlers: IotAddDeviceDrawerHandlers) {
  const { t: $t } = useI18n()
  const selectedProductKey = ref('')
  const selectedTemplateKey = ref('')
  const templateOpen = ref(false)
  const productMessage = ref('')
  const libraryMessage = ref('')
  const libraryLoading = ref(false)
  const libraryTagLoading = ref(false)
  const productLoading = ref(false)
  const deviceTemplateLoading = ref(false)
  const configOptionsLoading = ref(false)
  const busy = ref(false)
  const submitAction = ref<'create' | 'update-create' | ''>('')
  const errorMessage = ref('')
  const installProgressLogs = ref<IotAddDeviceInstallProgressLog[]>([])
  const areaOptions = ref<ProjectArea[]>([])
  const groupOptions = ref<DeviceGroup[]>([])
  const projectProducts = ref<IotDeviceProductTemplate[]>([])
  const templateProducts = ref<DeviceTemplateProductInput[]>([])
  const deviceTemplates = ref<DeviceTemplateProductInput[]>([])
  const libraryTagGroups = ref<IotDeviceLibraryTagGroup[]>([])
  const libraryTotal = ref(0)
  const libraryPageIndex = ref(0)
  const libraryPageSize = ref(6)
  const libraryLoaded = ref(false)
  const libraryTagLoaded = ref(false)
  const productLoaded = ref(false)
  const deviceTemplateLoaded = ref(false)
  const configOptionsLoaded = ref(false)
  const formRef = ref<{ validate?: () => Promise<unknown>; clearValidate?: () => void } | null>(null)
  const imageUpload = useIotDeviceImageUpload()
  let libraryRequestSeq = 0

  const form = reactive({
    name: '',
    areaId: '',
    area: '',
    groupId: '',
    description: '',
    imageUrl: '',
  })

  const formRules: Record<string, Rule[]> = {
    name: [{ required: true, message: $t('IotDeviceList.add.nameRequired'), trigger: 'blur' }],
    areaId: [{
      validator: async (_rule, value) => {
        if (value && !isSelectableDeviceArea(selectableAreas.value, String(value))) throw new Error($t('IotDeviceList.add.areaLevelRequired'))
      },
      trigger: 'change',
    }],
  }

  const availableProducts = computed(() => projectProducts.value)
  const selectableAreas = computed(() => areaOptions.value)
  const areaTreeData = computed(() => buildAreaTreeData(selectableAreas.value))
  const groupTreeData = computed(() => buildDeviceGroupTreeData(groupOptions.value))
  const libraryProducts = computed(() => templateProducts.value.map(toTemplateProductOption))
  const deviceTemplateProducts = computed(() => deviceTemplates.value.map(toTemplateProductOption))
  const selectedProduct = computed(() =>
    availableProducts.value.find((p) => p.id === selectedProductKey.value) ?? null,
  )
  const selectedTemplate = computed(() =>
    libraryProducts.value.find((p) => p.id === selectedTemplateKey.value) ?? null,
  )

  function applySourceDefaults(source?: Pick<IotDeviceProductTemplate, 'name' | 'photoUrl'> | null) {
    form.name = source?.name || ''
    form.imageUrl = source?.photoUrl || ''
    // 设备库图片作为已有图片回填，复用上传组件的预览和提交链路。
    imageUpload.setExistingImage(form.imageUrl, form.name ? $t('IotDeviceList.imageAlt', { name: form.name }) : '')
  }

  function selectProduct(productKey: string) {
    selectedProductKey.value = productKey
    const product = availableProducts.value.find((item) => item.id === productKey)
    selectedTemplateKey.value = product?.templateId || ''
    applySourceDefaults(product)
    productSync.reset()
  }

  function selectTemplate(templateId: string) {
    selectedTemplateKey.value = templateId
    const template = [...libraryProducts.value, ...deviceTemplateProducts.value].find((item) => item.id === templateId)
    const existingProduct = projectProducts.value.find((item) => item.templateId === templateId)
    selectedProductKey.value = existingProduct?.id || ''
    applySourceDefaults(template)
    productSync.reset()
  }

  function confirmProductUpdate(product: IotDeviceProductTemplate, template: DeviceTemplateProductInput) {
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: $t('IotDeviceList.add.updateProductTitle'),
        content: $t('IotDeviceList.add.updateProductContent', {
          template: template.name,
          product: product.name,
        }),
        okText: $t('IotDeviceList.add.updateProductOk'),
        cancelText: $t('IotDeviceList.action.cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }

  function onAreaChange() {
    const area = selectableAreas.value.find((item) => item.id === form.areaId)
    form.area = area?.name ?? ''
  }

  function clearImage() {
    imageUpload.clearImage()
    form.imageUrl = imageUpload.imageUrl.value
  }

  async function loadDeviceLibraryTags(force = false) {
    if (libraryTagLoading.value || (libraryTagLoaded.value && !force)) return
    libraryTagLoading.value = true
    try {
      libraryTagGroups.value = await queryDeviceLibraryTags_api()
      libraryTagLoaded.value = true
    } catch {
      libraryTagGroups.value = []
    } finally {
      libraryTagLoading.value = false
    }
  }

  async function loadDeviceLibraryTemplates(force = false, query: DeviceLibraryTemplateQueryInput = {}) {
    if (!force && (libraryLoading.value || libraryLoaded.value)) return
    const requestSeq = ++libraryRequestSeq
    libraryMessage.value = ''
    libraryLoading.value = true
    try {
      const page = await queryDeviceLibraryTemplates_api({
        projectId: props.projectId,
        pageIndex: query.pageIndex ?? libraryPageIndex.value,
        pageSize: query.pageSize ?? libraryPageSize.value,
        keyword: query.keyword,
        tags: query.tags,
      })
      if (requestSeq !== libraryRequestSeq) return
      templateProducts.value = page.data
      libraryTotal.value = page.total
      libraryPageIndex.value = page.pageIndex
      libraryPageSize.value = page.pageSize
      libraryLoaded.value = true
      if (selectedTemplateKey.value && !page.data.some((template) => template.id === selectedTemplateKey.value)) {
        selectedTemplateKey.value = ''
      }
    } catch (error) {
      if (requestSeq !== libraryRequestSeq) return
      libraryMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.templateLoadFailed')
      templateProducts.value = []
      libraryTotal.value = 0
    } finally {
      if (requestSeq === libraryRequestSeq) {
        libraryLoading.value = false
      }
    }
  }

  async function loadProducts(force = false) {
    if (productLoading.value || (productLoaded.value && !force)) return
    productMessage.value = ''
    productLoading.value = true
    try {
      const products = await queryDeviceProducts_api(props.projectId, props.deviceType)
      projectProducts.value = products
      productLoaded.value = true
      if (props.initialProductId && products.some((product) => product.id === props.initialProductId)) {
        selectProduct(props.initialProductId)
      }
      if (selectedTemplateKey.value && !selectedProductKey.value) {
        const existingProduct = products.find((item) => item.templateId === selectedTemplateKey.value)
        selectedProductKey.value = existingProduct?.id || ''
      }
    } catch (error) {
      productMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.productLoadFailed')
      projectProducts.value = []
    } finally {
      productLoading.value = false
    }
  }

  async function loadConfigOptions(force = false) {
    if (configOptionsLoading.value || (configOptionsLoaded.value && !force)) return
    configOptionsLoading.value = true
    try {
      const [areaSettings, groups] = await Promise.all([
        queryProjectSpaceAreaSettings_api(props.projectId).catch(() => ({ areas: [] })),
        queryDeviceGroupDetailList_api().catch(() => []),
      ])
      areaOptions.value = areaSettings.areas
      groupOptions.value = groups
      configOptionsLoaded.value = true
    } finally {
      configOptionsLoading.value = false
    }
  }

  async function loadDeviceTemplates(force = false) {
    if (deviceTemplateLoading.value || (deviceTemplateLoaded.value && !force)) return
    libraryMessage.value = ''
    deviceTemplateLoading.value = true
    try {
      const templates = await queryDeviceTemplates_api(props.deviceType)
      deviceTemplates.value = templates
      deviceTemplateLoaded.value = true
      if (selectedTemplateKey.value && !templates.some((template) => template.id === selectedTemplateKey.value)) {
        selectedTemplateKey.value = ''
      }
    } catch (error) {
      libraryMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.templateLoadFailed')
      deviceTemplates.value = []
    } finally {
      deviceTemplateLoading.value = false
    }
  }

  async function addTemplateToProject(templateId: string) {
    if (busy.value) return
    const template = deviceTemplates.value.find((item) => item.id === templateId)
    if (!template) return
    const existingProduct = projectProducts.value.find((item) => item.templateId === template.id)
    if (existingProduct && !(await confirmProductUpdate(existingProduct, template))) return
    libraryMessage.value = ''
    busy.value = true
    try {
      // 已有同模板隐藏产品时传入原产品ID，后端会按最新模板覆盖更新而不是创建重复产品。
      const product = await createProductFromDeviceTemplate_api({
        projectId: props.projectId,
        template,
        productId: existingProduct?.id,
      })
      projectProducts.value = [
        product,
        ...projectProducts.value.filter((item) => item.id !== product.id),
      ]
      selectedProductKey.value = product.id
      selectedTemplateKey.value = template.id
      templateOpen.value = false
      productMessage.value = existingProduct
        ? $t('IotDeviceList.add.productUpdatedFromTemplate', { name: template.name })
        : $t('IotDeviceList.add.productCreatedFromTemplate', { name: template.name })
    } catch (error) {
      libraryMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.productCreateFailed')
    } finally {
      busy.value = false
    }
  }

  const productSync = useIotDeviceLibraryProductSync({
    projectId: () => props.projectId,
    projectProducts,
    templateProducts,
    selectedTemplateKey,
    selectedProductKey,
    loadProducts,
    t: $t,
  })
  const libraryProductSyncState = productSync.state
  const updateAndCreateDisabledReason = productSync.disabledReason
  const updateAndCreateBusy = computed(() => submitAction.value === 'update-create')
  const updateAndCreateDisabled = computed(() =>
    libraryProductSyncState.value.checking
    || libraryProductSyncState.value.updateDisabled
    || (busy.value && !updateAndCreateBusy.value),
  )
  const updateAndCreateSubmitText = computed(() =>
    updateAndCreateBusy.value
      ? $t('IotDeviceList.add.updatingAndCreating')
      : $t('IotDeviceList.add.updateAndCreate'),
  )
  const installProgressState = computed<IotAddDeviceInstallProgressState>(() => ({
    logs: installProgressLogs.value,
    running: busy.value && Boolean(submitAction.value) && Boolean(selectedTemplateKey.value),
    hasError: installProgressLogs.value.some((item) => item.type === 'error'),
  }))

  function clearInstallProgress() {
    installProgressLogs.value = []
  }

  function appendInstallProgress(progress: DeviceLibraryInstallProgress) {
    const message = progress.type === 'error'
      ? normalizeCreateDeviceErrorMessage(progress.message)
      : progress.message
    if (!message) return
    installProgressLogs.value = [
      ...installProgressLogs.value,
      {
        ...progress,
        message,
        id: `${Date.now()}-${installProgressLogs.value.length}`,
      },
    ]
  }

  function isMissingDeviceAccessConfigError(message: string) {
    // 后端仍按接入网关报错，项目侧用户只需要知道接入配置需管理员处理。
    return message.includes('设备接入网关')
      && (message.includes('未找到业务标识') || message.includes('请先创建或绑定'))
  }

  function isServiceConnectionTimeoutError(message: string) {
    return /^No keep-alive acks for \d+\s*ms$/i.test(message.trim())
  }

  function normalizeCreateDeviceErrorMessage(message: string) {
    if (isServiceConnectionTimeoutError(message)) {
      // 保留英文原文便于排查，中文环境只展示面向用户的简短提示。
      return $t('IotDeviceList.add.serviceConnectionTimeout', { message })
    }
    if (isMissingDeviceAccessConfigError(message)) {
      return $t('IotDeviceList.add.accessConfigIncomplete')
    }
    return message
  }

  function getCreateDeviceErrorMessage(error: unknown) {
    const message = error instanceof Error ? error.message : ''
    return normalizeCreateDeviceErrorMessage(message) || $t('IotDeviceList.add.createFailed')
  }

  function appendInstallError(error: unknown) {
    const message = getCreateDeviceErrorMessage(error)
    if (!message || installProgressLogs.value.some((item) => item.type === 'error' && item.message === message)) return
    appendInstallProgress({ type: 'error', message, payload: error })
  }

  function appendInstallWarning(message: string, extra?: unknown) {
    if (!message || installProgressLogs.value.some((item) => item.type === 'warning' && item.message === message)) return
    appendInstallProgress({ type: 'warning', message, extra })
  }

  function selectPresetIcon(icon: string) {
    imageUpload.clearImage()
    form.imageUrl = formatIconValueFont(icon)
    imageUpload.setExistingImage(form.imageUrl)
  }

  function backToLibrary() {
    form.name = ''
    form.areaId = ''
    form.area = ''
    form.groupId = ''
    form.description = ''
    clearImage()
    errorMessage.value = ''
    clearInstallProgress()
    void nextTick(() => formRef.value?.clearValidate?.())
  }

  function resetForm() {
    selectedProductKey.value = ''
    selectedTemplateKey.value = ''
    templateOpen.value = false
    productMessage.value = ''
    libraryMessage.value = ''
    form.name = ''
    form.areaId = ''
    form.area = ''
    form.groupId = ''
    form.description = ''
    clearImage()
    errorMessage.value = ''
    clearInstallProgress()
    busy.value = false
    submitAction.value = ''
    libraryRequestSeq += 1
    libraryLoading.value = false
    libraryTagLoading.value = false
    productLoading.value = false
    deviceTemplateLoading.value = false
    configOptionsLoading.value = false
    areaOptions.value = []
    groupOptions.value = []
    projectProducts.value = []
    templateProducts.value = []
    deviceTemplates.value = []
    libraryTagGroups.value = []
    libraryTotal.value = 0
    libraryPageIndex.value = 0
    libraryPageSize.value = 6
    productSync.reset()
    libraryLoaded.value = false
    libraryTagLoaded.value = false
    productLoaded.value = false
    deviceTemplateLoaded.value = false
    configOptionsLoaded.value = false
    void nextTick(() => formRef.value?.clearValidate?.())
  }

  function onClose() {
    handlers.updateOpen(false)
    setTimeout(resetForm, 200)
  }

  async function bindCreatedDevice(deviceId: string, options: { bindGroup?: boolean } = { bindGroup: true }) {
    await saveIotDeviceAreaGroupBindings({
      deviceId,
      deviceName: form.name,
      productName: selectedProduct.value?.name,
      areaId: form.areaId,
      groupId: options.bindGroup === false ? undefined : form.groupId,
    })
  }

  async function bindCreatedDeviceBestEffort(deviceId: string, options: { bindGroup?: boolean } = { bindGroup: true }) {
    try {
      await bindCreatedDevice(deviceId, options)
    } catch (error) {
      // 设备创建和区域/分组绑定不是同一个事务；绑定失败不能回滚已创建设备，只记录日志供排查。
      console.warn('[iot-ui] 设备已创建，但区域或分组绑定失败', error)
      appendInstallWarning($t('IotDeviceList.add.bindAfterCreateFailed'), error)
    }
  }

  function buildDeviceCreateInput(product?: IotDeviceProductTemplate, imageUrl = '') {
    return {
      projectId: props.projectId,
      productKey: product?.id ?? '',
      productName: product?.name,
      productDeviceType: product?.deviceType,
      parentId: props.parentId,
      name: form.name,
      areaId: form.areaId,
      area: form.area,
      groupId: form.groupId,
      scenario: groupOptions.value.find((group) => group.id === form.groupId)?.name,
      imageUrl,
      description: form.description,
    }
  }

  async function installTemplateAndCreateDevice(imageUrl: string, options: { updateProduct?: boolean } = {}) {
    const template = templateProducts.value.find((item) => item.id === selectedTemplateKey.value)
    if (!template) return null
    const result = await installDeviceLibraryAndCreateDevice_api({
      projectId: props.projectId,
      template,
      productName: template.name,
      device: buildDeviceCreateInput(undefined, imageUrl),
    }, {
      onProgress: appendInstallProgress,
      updateProduct: options.updateProduct,
    })
    projectProducts.value = [
      result.product,
      ...projectProducts.value.filter((item) => item.id !== result.product.id),
    ]
    selectedProductKey.value = result.product.id
    selectedTemplateKey.value = template.id
    return result
  }

  async function ensureTemplateProduct() {
    if (selectedProductKey.value && selectedProduct.value) return selectedProduct.value
    const template = templateProducts.value.find((item) => item.id === selectedTemplateKey.value)
    if (!template) return null

    if (template.installedProductId) {
      // installedProductId 只表示安装记录，仍需用当前权限查询产品后才能复用。
      const product = await queryDeviceProductById_api(template.installedProductId)
      if (!product) throw new Error($t('IotDeviceList.add.installedProductMissing'))
      projectProducts.value = [product, ...projectProducts.value.filter((item) => item.id !== product.id)]
      selectedProductKey.value = product.id
      selectedTemplateKey.value = template.id
      return product
    }

    const findExistingProduct = () => projectProducts.value.find((item) => item.templateId === template.id)
    let existingProduct = productLoaded.value ? findExistingProduct() : undefined
    if (existingProduct) {
      selectedProductKey.value = existingProduct.id
      return existingProduct
    }

    if (template.installed) {
      await loadProducts()
      existingProduct = findExistingProduct()
      if (existingProduct) {
        selectedProductKey.value = existingProduct.id
        return existingProduct
      }
      throw new Error($t('IotDeviceList.add.installedProductMissing'))
    }

    const product = await joinDeviceLibraryToProject_api({
      projectId: props.projectId,
      template,
      productName: template.name,
    })
    projectProducts.value = [
      product,
      ...projectProducts.value.filter((item) => item.id !== product.id),
    ]
    selectedProductKey.value = product.id
    selectedTemplateKey.value = template.id
    return product
  }

  async function prepareConfirmStep() {
    busy.value = true
    try {
      await productSync.prepare()
    } finally {
      productSync.finishChecking()
      busy.value = false
    }
  }

  async function onSubmit(options: { syncProduct?: boolean } = {}) {
    errorMessage.value = ''
    if (!selectedProductKey.value && !selectedTemplateKey.value) {
      errorMessage.value = $t('IotDeviceList.add.selectSourceFirst')
      return
    }
    try {
      await formRef.value?.validate?.()
    } catch {
      return
    }
    clearInstallProgress()
    busy.value = true
    submitAction.value = options.syncProduct ? 'update-create' : 'create'
    try {
      const imageUrl = await imageUpload.resolveImageUrl()
      if (selectedTemplateKey.value) {
        const result = await installTemplateAndCreateDevice(imageUrl, { updateProduct: options.syncProduct })
        if (!result) {
          errorMessage.value = $t('IotDeviceList.add.selectSourceFirst')
          return
        }
        await bindCreatedDeviceBestEffort(result.device.id, { bindGroup: false })
        handlers.created({
          deviceId: result.device.id,
          deviceType: result.product.deviceType,
        })
        handlers.updateOpen(false)
        setTimeout(resetForm, 200)
        return
      }
      const product = options.syncProduct
        ? await productSync.syncSelectedProduct()
        : await ensureTemplateProduct()
      if (!product) {
        errorMessage.value = $t('IotDeviceList.add.selectSourceFirst')
        return
      }
      const device = await createDevice_api(buildDeviceCreateInput(product, imageUrl))
      await bindCreatedDeviceBestEffort(device.id)
      handlers.created({
        deviceId: device.id,
        deviceType: product.deviceType,
      })
      handlers.updateOpen(false)
      setTimeout(resetForm, 200)
    } catch (error) {
      errorMessage.value = getCreateDeviceErrorMessage(error)
      if (selectedTemplateKey.value) appendInstallError(error)
    } finally {
      busy.value = false
      submitAction.value = ''
    }
  }

  async function onUpdateAndSubmit() {
    if (libraryProductSyncState.value.updateDisabled) return
    await onSubmit({ syncProduct: true })
  }

  watch(
    () => props.open,
    (next) => {
      if (next) {
        resetForm()
        void loadDeviceLibraryTemplates()
        void loadDeviceLibraryTags()
      }
    },
  )

  return {
    selectedProductKey, selectedTemplateKey, templateOpen,
    productMessage, libraryMessage, libraryLoading, libraryTagLoading, productLoading, deviceTemplateLoading, configOptionsLoading,
    busy, submitAction, errorMessage, imagePreviewUrl: imageUpload.imagePreviewUrl, imageFileName: imageUpload.imageFileName,
    formRef, form, formRules, availableProducts, areaTreeData, groupTreeData,
    libraryProducts, libraryTagGroups, libraryTotal, libraryPageIndex, libraryPageSize, libraryProductSyncState,
    deviceTemplateProducts, selectedProduct, selectedTemplate,
    updateAndCreateDisabledReason, updateAndCreateBusy, updateAndCreateDisabled, updateAndCreateSubmitText,
    installProgressState,
    categoryLabel, selectProduct, selectTemplate, onAreaChange,
    handleImageBeforeUpload: imageUpload.handleImageBeforeUpload,
    selectPresetIcon,
    backToLibrary,
    addTemplateToProject, loadDeviceLibraryTemplates, loadDeviceLibraryTags, loadProducts, loadConfigOptions, loadDeviceTemplates,
    prepareConfirmStep, onClose, onSubmit, onUpdateAndSubmit,
  }
}
