import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useI18n } from 'vue-i18n'
import {
  createDevice_api,
  queryDeviceProductById_api,
  queryDeviceProductCategoryTree_api,
  queryDeviceProductPage_api,
  type DeviceCreationSource,
  type DeviceLibraryCapabilityState,
  type DeviceLibraryInstallProgress,
  type DeviceLibraryTemplateQueryInput,
  type DeviceTemplateProductInput,
  type IotDeviceLibraryTagGroup,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import {
  joinDeviceLibraryToProject_api,
  probeDeviceLibraryCapability_api,
  queryProjectInstalledDeviceLibrary_api,
  queryDeviceLibraryTags_api,
  queryDeviceLibraryTemplates_api,
} from '@device-manager-ui/api/device-library'
import {
  getStoragList,
  saveProductStorePolicy,
  type DeviceDataStorePolicyInfo,
} from '@device-manager-ui/api/product'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import type { ProductCategoryTreeNode } from '@device-manager-ui/views/device/Product/components/ProductCategoryTree.vue'
import { formatIconValueFont } from '@jetlinks-web-core/components/IconValue'
import { buildAreaTreeData, isSelectableDeviceArea } from './iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from './iotDeviceGroupTreeOptions'
import { toTemplateProductOption } from './iotAddDeviceProductOptions'
import { saveIotDeviceAreaGroupBindings } from './iotDeviceAreaGroupBindings'
import { useIotDeviceImageUpload } from './useIotDeviceImageUpload'
import { useIotDeviceLibraryProductSync } from './useIotDeviceLibraryProductSync'
import {
  collectProductCategoryScopeIds,
  hasAvailableStorePolicy,
  isSelectableDeviceCreationCandidate,
} from '@device-manager-ui/utils/deviceCreationSources'

const UNCLASSIFIED_CATEGORY_ID = '__product-unclassified__'

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

export type IotAddDeviceInstallProgressLog = DeviceLibraryInstallProgress & { id: string }

export type IotAddDeviceInstallProgressState = {
  logs: IotAddDeviceInstallProgressLog[]
  running: boolean
  hasError: boolean
}

type IotAddDeviceDrawerHandlers = {
  updateOpen: (value: boolean) => void
  created: (payload: IotAddDeviceCreatedPayload) => void
}

function normalizeCategoryTree(nodes: Record<string, any>[] = []): ProductCategoryTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    id: String(node.id),
    name: String(node.name ?? ''),
    children: normalizeCategoryTree(node.children ?? node._children ?? []),
  }))
}

export function useIotAddDeviceDrawer(props: IotAddDeviceDrawerProps, handlers: IotAddDeviceDrawerHandlers) {
  const { t: $t } = useI18n()
  const creationSource = ref<DeviceCreationSource>('product')
  const marketplaceCapability = ref<DeviceLibraryCapabilityState>('checking')
  const selectedProductKey = ref('')
  const selectedTemplateKey = ref('')
  const selectedProduct = ref<IotDeviceProductTemplate | null>(null)
  const selectedTemplate = ref<DeviceTemplateProductInput | null>(null)
  const libraryProductNeedsStorePolicy = ref(false)
  const libraryProductChecking = ref(false)
  const productMessage = ref('')
  const libraryMessage = ref('')
  const errorMessage = ref('')
  const productLoading = ref(false)
  const libraryLoading = ref(false)
  const libraryTagLoading = ref(false)
  const configOptionsLoading = ref(false)
  const busy = ref(false)
  const submitAction = ref<'create' | 'install' | ''>('')
  const installProgressLogs = ref<IotAddDeviceInstallProgressLog[]>([])
  const areaOptions = ref<ProjectArea[]>([])
  const groupOptions = ref<DeviceGroup[]>([])
  const storePolicies = ref<DeviceDataStorePolicyInfo[]>([])
  const categoryTree = ref<ProductCategoryTreeNode[]>([])
  const categoryLoading = ref(false)
  const selectedCategoryId = ref<string>()
  const productCandidates = ref<IotDeviceProductTemplate[]>([])
  const productTotal = ref(0)
  const productPageIndex = ref(0)
  const productPageSize = ref(4)
  const productFilterTerms = ref<DeviceQueryTerm[]>([])
  const libraryTemplates = ref<DeviceTemplateProductInput[]>([])
  const libraryTagGroups = ref<IotDeviceLibraryTagGroup[]>([])
  const libraryPageIndex = ref(0)
  const libraryPageSize = ref(6)
  const libraryHasMore = ref(false)
  const libraryKeyword = ref('')
  const libraryTags = ref<string[]>([])
  const formRef = ref<{ validate?: () => Promise<unknown>; clearValidate?: () => void } | null>(null)
  const imageUpload = useIotDeviceImageUpload()
  let openSequence = 0
  let productRequestSequence = 0
  let libraryRequestSequence = 0
  let libraryProductRequestSequence = 0

  const form = reactive({
    name: '', areaId: '', area: '', groupId: '', description: '', imageUrl: '', storePolicy: '',
  })
  const selectableAreas = computed(() => areaOptions.value)
  const areaTreeData = computed(() => buildAreaTreeData(selectableAreas.value))
  const groupTreeData = computed(() => buildDeviceGroupTreeData(groupOptions.value))
  const isLibraryAvailable = computed(() => marketplaceCapability.value === 'available')
  const selectedSource = computed<IotDeviceProductTemplate | DeviceTemplateProductInput | null>(() => (
    creationSource.value === 'library' ? selectedTemplate.value : selectedProduct.value
  ))
  const installProgressState = computed<IotAddDeviceInstallProgressState>(() => ({
    logs: installProgressLogs.value,
    running: busy.value && submitAction.value === 'install',
    hasError: installProgressLogs.value.some((item) => item.type === 'error'),
  }))
  const storagePolicyOptions = computed(() => storePolicies.value.map((item) => ({ value: item.id, label: item.name || item.id })))
  const libraryProducts = computed(() => libraryTemplates.value.map(toTemplateProductOption))
  const productSync = useIotDeviceLibraryProductSync({
    projectId: () => props.projectId,
    projectProducts: productCandidates,
    templateProducts: libraryTemplates,
    selectedTemplateKey,
    selectedProductKey,
    loadProducts: () => loadProductCandidates(true),
    t: $t,
  })
  const libraryProductSyncState = productSync.state
  const formRules: Record<string, Rule[]> = {
    name: [{ required: true, message: $t('IotDeviceList.add.nameRequired'), trigger: 'blur' }],
    storePolicy: [{
      validator: async (_rule, value) => {
        if (creationSource.value === 'library' && libraryProductNeedsStorePolicy.value && !value) {
          throw new Error($t('IotDeviceList.add.storePolicyRequired'))
        }
      },
      trigger: 'change',
    }],
    areaId: [{
      validator: async (_rule, value) => {
        if (value && !isSelectableDeviceArea(selectableAreas.value, String(value))) throw new Error($t('IotDeviceList.add.areaLevelRequired'))
      },
      trigger: 'change',
    }],
  }

  function applySourceDefaults(source?: Pick<IotDeviceProductTemplate, 'name' | 'photoUrl' | 'storePolicy'> | null) {
    form.name = source?.name || ''
    form.imageUrl = source?.photoUrl || ''
    form.storePolicy = source?.storePolicy || storePolicies.value[0]?.id || ''
    imageUpload.setExistingImage(form.imageUrl, form.name ? $t('IotDeviceList.imageAlt', { name: form.name }) : '')
  }

  function onAreaChange() {
    form.area = selectableAreas.value.find((item) => item.id === form.areaId)?.name ?? ''
  }

  function selectPresetIcon(icon: string) {
    imageUpload.clearImage()
    form.imageUrl = formatIconValueFont(icon)
    imageUpload.setExistingImage(form.imageUrl)
  }

  function selectProduct(productId: string) {
    selectedProductKey.value = productId
    selectedProduct.value = productCandidates.value.find((item) => item.id === productId) ?? null
    applySourceDefaults(selectedProduct.value)
  }

  function selectTemplate(templateId: string) {
    selectedTemplateKey.value = templateId
    selectedTemplate.value = libraryTemplates.value.find((item) => item.id === templateId) ?? null
    applySourceDefaults(selectedTemplate.value)
    libraryProductNeedsStorePolicy.value = false
    libraryProductChecking.value = true
    void checkLibraryProduct()
  }

  /**
   * 检查设备库模板是否已经对应当前运行时产品；查询失败时按需安装处理，避免跳过产品创建。
   */
  async function checkLibraryProduct() {
    const requestSequence = ++libraryProductRequestSequence
    try {
      await productSync.prepare()
      if (requestSequence !== libraryProductRequestSequence) return
      const productId = libraryProductSyncState.value.productId
      const product = productId
        ? productCandidates.value.find((item) => item.id === productId)
          ?? await queryDeviceProductById_api(productId).catch(() => null)
        : null
      libraryProductNeedsStorePolicy.value = !product
      if (product) {
        selectedProduct.value = product
        selectedProductKey.value = product.id
      } else {
        await loadStoragePolicies()
      }
    } catch {
      if (requestSequence === libraryProductRequestSequence) {
        libraryProductNeedsStorePolicy.value = true
        await loadStoragePolicies()
      }
    } finally {
      productSync.finishChecking()
      if (requestSequence === libraryProductRequestSequence) libraryProductChecking.value = false
    }
  }

  function selectSource(source: DeviceCreationSource) {
    if (source === 'library' && !isLibraryAvailable.value) return
    // 两种来源的产品集合不同，切换时必须撤销产品侧的在途请求并清空筛选，避免隐藏条件污染返回后的列表。
    ++productRequestSequence
    productFilterTerms.value = []
    productPageIndex.value = 0
    productTotal.value = 0
    creationSource.value = source
    errorMessage.value = ''
    if (source !== 'library') {
      libraryProductNeedsStorePolicy.value = false
      libraryProductChecking.value = false
      ++libraryProductRequestSequence
      productSync.reset()
    }
    if (source === 'product') void loadProductCandidates()
    else void loadDeviceLibraryTemplates()
  }

  function selectProductCategory(id?: string) {
    selectedCategoryId.value = id
    productPageIndex.value = 0
    void loadProductCandidates(true)
  }

  function selectUnclassifiedProductCategory() {
    selectedCategoryId.value = UNCLASSIFIED_CATEGORY_ID
    productPageIndex.value = 0
    void loadProductCandidates(true)
  }

  async function loadProductCategories() {
    if (categoryLoading.value) return
    categoryLoading.value = true
    try {
      categoryTree.value = normalizeCategoryTree(await queryDeviceProductCategoryTree_api())
    } finally {
      categoryLoading.value = false
    }
  }

  /** 产品来源独占分页、分类和条件筛选状态，切换设备库不会覆盖其浏览位置。 */
  async function loadProductCandidates(force = false, query?: { terms?: DeviceQueryTerm[]; pageIndex?: number }) {
    if (productLoading.value && !force) return
    const requestSequence = ++productRequestSequence
    productLoading.value = true
    productMessage.value = ''
    if (query?.terms !== undefined) productFilterTerms.value = query.terms
    if (query?.pageIndex !== undefined) productPageIndex.value = query.pageIndex
    try {
      const page = await queryDeviceProductPage_api({
        pageIndex: productPageIndex.value,
        pageSize: productPageSize.value,
        terms: productFilterTerms.value,
        classifiedIds: selectedCategoryId.value && selectedCategoryId.value !== UNCLASSIFIED_CATEGORY_ID
          ? collectProductCategoryScopeIds(categoryTree.value, selectedCategoryId.value)
          : undefined,
        unclassified: selectedCategoryId.value === UNCLASSIFIED_CATEGORY_ID,
        deviceType: props.deviceType,
      })
      if (requestSequence !== productRequestSequence || !props.open) return
      productCandidates.value = page.data
      productTotal.value = page.total
      productPageIndex.value = page.pageIndex
      productPageSize.value = page.pageSize
      if (props.initialProductId && !selectedProduct.value) {
        const initial = page.data.find((item) => item.id === props.initialProductId)
        if (initial) selectProduct(initial.id)
      }
    } catch (error) {
      if (requestSequence !== productRequestSequence) return
      productCandidates.value = []
      productTotal.value = 0
      productMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.productLoadFailed')
    } finally {
      if (requestSequence === productRequestSequence) productLoading.value = false
    }
  }

  async function loadDeviceLibraryTags() {
    if (libraryTagLoading.value) return
    libraryTagLoading.value = true
    try {
      libraryTagGroups.value = await queryDeviceLibraryTags_api()
    } catch {
      libraryTagGroups.value = []
    } finally {
      libraryTagLoading.value = false
    }
  }

  /** 运行时市场不返回 total，以 hasMore 而非伪造总数驱动设备库翻页。 */
  async function loadDeviceLibraryTemplates(force = false, query: DeviceLibraryTemplateQueryInput = {}) {
    if (libraryLoading.value && !force) return
    const requestSequence = ++libraryRequestSequence
    libraryLoading.value = true
    libraryMessage.value = ''
    if (query.keyword !== undefined) libraryKeyword.value = query.keyword.trim()
    if (query.tags !== undefined) libraryTags.value = query.tags
    if (query.pageIndex !== undefined) libraryPageIndex.value = query.pageIndex
    try {
      const page = await queryDeviceLibraryTemplates_api({
        pageIndex: libraryPageIndex.value, pageSize: libraryPageSize.value, keyword: libraryKeyword.value,
        tags: libraryTags.value, deviceType: props.deviceType,
      })
      if (requestSequence !== libraryRequestSequence || !props.open) return
      libraryTemplates.value = page.data.filter(isSelectableDeviceCreationCandidate)
      libraryPageIndex.value = page.pageIndex
      libraryPageSize.value = page.pageSize
      libraryHasMore.value = page.hasMore
    } catch (error) {
      if (requestSequence !== libraryRequestSequence) return
      libraryTemplates.value = []
      libraryHasMore.value = false
      libraryMessage.value = error instanceof Error ? error.message : $t('IotDeviceList.add.templateLoadFailed')
    } finally {
      if (requestSequence === libraryRequestSequence) libraryLoading.value = false
    }
  }

  async function probeMarketplace() {
    const requestSequence = openSequence
    marketplaceCapability.value = 'checking'
    try {
      await probeDeviceLibraryCapability_api()
      if (requestSequence !== openSequence || !props.open) return
      marketplaceCapability.value = 'available'
      creationSource.value = 'library'
      void loadDeviceLibraryTags()
      void loadDeviceLibraryTemplates()
    } catch {
      // 市场缺失、无权限或网络异常只影响设备库入口，产品创建路径始终可用。
      if (requestSequence !== openSequence || !props.open) return
      marketplaceCapability.value = 'unavailable'
      creationSource.value = 'product'
    }
  }

  async function loadConfigOptions() {
    if (configOptionsLoading.value) return
    configOptionsLoading.value = true
    try {
      const [areaSettings, groups] = await Promise.all([
        queryProjectSpaceAreaSettings_api(props.projectId).catch(() => ({ areas: [] })),
        queryDeviceGroupDetailList_api().catch(() => []),
      ])
      areaOptions.value = areaSettings.areas
      groupOptions.value = groups
    } finally {
      configOptionsLoading.value = false
    }
  }

  /** 仅设备库首次安装产品时读取策略，已有产品和按产品创建均不改产品级配置。 */
  async function loadStoragePolicies() {
    const storageResponse = await getStoragList().catch(() => ({ result: [] }))
    const result = (storageResponse as any)?.result ?? storageResponse ?? []
    storePolicies.value = Array.isArray(result) ? result.filter((item) => item?.id) : []
    if (!form.storePolicy || !storePolicies.value.some((item) => item.id === form.storePolicy)) {
      form.storePolicy = storePolicies.value[0]?.id || ''
    }
  }

  function appendInstallProgress(progress: DeviceLibraryInstallProgress) {
    if (!progress.message) return
    installProgressLogs.value = [...installProgressLogs.value, { ...progress, id: `${Date.now()}-${installProgressLogs.value.length}` }]
  }

  function clearBasicFields() {
    form.name = ''; form.areaId = ''; form.area = ''; form.groupId = ''; form.description = ''
    form.storePolicy = selectedSource.value?.storePolicy || storePolicies.value[0]?.id || ''
    imageUpload.clearImage()
    form.imageUrl = imageUpload.imageUrl.value
    errorMessage.value = ''
    installProgressLogs.value = []
    void nextTick(() => formRef.value?.clearValidate?.())
  }

  function resetForm() {
    openSequence += 1; productRequestSequence += 1; libraryRequestSequence += 1; libraryProductRequestSequence += 1
    creationSource.value = 'product'; marketplaceCapability.value = 'checking'
    selectedProductKey.value = ''; selectedTemplateKey.value = ''
    selectedProduct.value = null; selectedTemplate.value = null; selectedCategoryId.value = undefined
    libraryProductNeedsStorePolicy.value = false; libraryProductChecking.value = false
    productSync.reset()
    productCandidates.value = []; productTotal.value = 0; productPageIndex.value = 0; productFilterTerms.value = []
    libraryTemplates.value = []; libraryTagGroups.value = []; libraryPageIndex.value = 0; libraryKeyword.value = ''; libraryTags.value = []; libraryHasMore.value = false
    areaOptions.value = []; groupOptions.value = []; storePolicies.value = []
    productMessage.value = ''; libraryMessage.value = ''; errorMessage.value = ''; installProgressLogs.value = []
    busy.value = false; submitAction.value = ''
    form.name = ''; form.areaId = ''; form.area = ''; form.groupId = ''; form.description = ''; form.storePolicy = ''
    imageUpload.clearImage(); form.imageUrl = ''
  }

  function onClose() {
    handlers.updateOpen(false)
    window.setTimeout(resetForm, 200)
  }

  function buildDeviceCreateInput(product: IotDeviceProductTemplate, imageUrl: string) {
    return {
      projectId: props.projectId, productKey: product.id, productName: product.name, productDeviceType: product.deviceType,
      parentId: props.parentId, name: form.name, areaId: form.areaId, area: form.area, groupId: form.groupId,
      scenario: groupOptions.value.find((group) => group.id === form.groupId)?.name,
      imageUrl, description: form.description,
    }
  }

  async function saveStorePolicy(product: IotDeviceProductTemplate) {
    if (!hasAvailableStorePolicy(form.storePolicy, storePolicies.value)) {
      throw new Error($t('IotDeviceList.add.storePolicyRequired'))
    }
    await saveProductStorePolicy(product.id, form.storePolicy)
    product.storePolicy = form.storePolicy
  }

  async function resolveCreationProduct(): Promise<{ product: IotDeviceProductTemplate | null; needsStorePolicy: boolean }> {
    if (creationSource.value === 'product') return { product: selectedProduct.value, needsStorePolicy: false }
    if (!selectedTemplate.value) return { product: null, needsStorePolicy: false }

    const installedProductId = (await queryProjectInstalledDeviceLibrary_api(
      props.projectId,
      [selectedTemplate.value.id],
    ).catch(() => new Map<string, string>())).get(selectedTemplate.value.id)
    if (installedProductId) {
      const existingProduct = await queryDeviceProductById_api(installedProductId).catch(() => null)
      if (existingProduct) {
        selectedProduct.value = existingProduct
        selectedProductKey.value = existingProduct.id
        return { product: existingProduct, needsStorePolicy: false }
      }
    }

    submitAction.value = 'install'
    const product = await joinDeviceLibraryToProject_api({
      projectId: props.projectId, template: selectedTemplate.value, productName: selectedTemplate.value.name,
    }, { onProgress: appendInstallProgress })
    selectedProduct.value = product
    selectedProductKey.value = product.id
    return { product, needsStorePolicy: true }
  }

  async function bindCreatedDeviceBestEffort(deviceId: string, product: IotDeviceProductTemplate) {
    try {
      await saveIotDeviceAreaGroupBindings({
        deviceId, deviceName: form.name, productName: product.name, areaId: form.areaId, groupId: form.groupId,
      })
    } catch (error) {
      console.warn('[iot-ui] 设备已创建，但区域或分组绑定失败', error)
    }
  }

  async function onSubmit() {
    errorMessage.value = ''
    if (!selectedSource.value) {
      errorMessage.value = $t('IotDeviceList.add.selectSourceFirst')
      return
    }
    try {
      await formRef.value?.validate?.()
    } catch {
      return
    }
    installProgressLogs.value = []
    busy.value = true
    submitAction.value = 'create'
    try {
      const resolved = await resolveCreationProduct()
      if (!resolved.product) throw new Error($t('IotDeviceList.add.selectSourceFirst'))
      if (resolved.needsStorePolicy) {
        if (!storePolicies.value.length) await loadStoragePolicies()
        await saveStorePolicy(resolved.product)
      }
      submitAction.value = 'create'
      const device = await createDevice_api(buildDeviceCreateInput(resolved.product, await imageUpload.resolveImageUrl()))
      await bindCreatedDeviceBestEffort(device.id, resolved.product)
      handlers.created({ deviceId: device.id, deviceType: resolved.product.deviceType })
      handlers.updateOpen(false)
      window.setTimeout(resetForm, 200)
    } catch (error) {
      errorMessage.value = error instanceof Error && error.message ? error.message : $t('IotDeviceList.add.createFailed')
      if (creationSource.value === 'library') appendInstallProgress({ type: 'error', message: errorMessage.value })
    } finally {
      busy.value = false
      submitAction.value = ''
    }
  }

  watch(() => props.open, (open) => {
    if (!open) return
    resetForm()
    openSequence += 1
    void loadProductCategories()
    void loadProductCandidates(true)
    void probeMarketplace()
  })

  return {
    creationSource, marketplaceCapability, isLibraryAvailable,
    selectedProductKey, selectedTemplateKey, selectedProduct, selectedTemplate, selectedSource,
    libraryProductNeedsStorePolicy, libraryProductChecking,
    libraryProductSyncState,
    productMessage, libraryMessage, errorMessage, productLoading, libraryLoading, libraryTagLoading,
    busy, submitAction, installProgressState,
    formRef, form, formRules, areaTreeData, groupTreeData,
    storePolicies, storagePolicyOptions, configOptionsLoading,
    categoryTree, categoryLoading, selectedCategoryId, productCandidates, productTotal, productPageIndex, productPageSize,
    libraryProducts, libraryTagGroups, libraryPageIndex, libraryPageSize, libraryHasMore,
    onAreaChange, selectPresetIcon,
    selectSource, selectProduct, selectTemplate, selectProductCategory, selectUnclassifiedProductCategory,
    loadProductCandidates, loadDeviceLibraryTemplates, loadConfigOptions,
    clearBasicFields, onClose, onSubmit,
    handleImageBeforeUpload: imageUpload.handleImageBeforeUpload,
    imagePreviewUrl: imageUpload.imagePreviewUrl, imageFileName: imageUpload.imageFileName,
  }
}
