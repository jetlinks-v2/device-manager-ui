import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { Rule } from 'ant-design-vue/es/form'
import { useI18n } from 'vue-i18n'
import {
  createDevice_api,
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
  installDeviceLibraryAndCreateDevice_api,
  probeDeviceLibraryCapability_api,
  queryDeviceLibraryTags_api,
  queryDeviceLibraryTemplates_api,
} from '@device-manager-ui/api/device-library'
import { queryDeviceGroupDetailList_api, type DeviceGroup } from '@device-manager-ui/api/deviceGroup'
import { queryProjectSpaceAreaSettings_api } from '@device-manager-ui/api/spaceArea'
import type { ProjectArea } from '@device-manager-ui/modules/defaults/types'
import type { ProductCategoryTreeNode } from '@device-manager-ui/views/device/Product/components/ProductCategoryTree.vue'
import type { IotDevice } from '../types'
import { formatIconValueFont } from '@jetlinks-web-core/components/IconValue'
import { buildAreaTreeData, isSelectableDeviceArea } from './iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from './iotDeviceGroupTreeOptions'
import { toTemplateProductOption } from './iotAddDeviceProductOptions'
import { saveIotDeviceAreaGroupBindings } from './iotDeviceAreaGroupBindings'
import { useIotDeviceImageUpload } from './useIotDeviceImageUpload'
import {
  collectProductCategoryScopeIds,
  isSelectableDeviceCreationCandidate,
} from '@device-manager-ui/utils/deviceCreationSources'
import { useMenuStore } from '@jetlinks-web-core/store'

const UNCLASSIFIED_CATEGORY_ID = '__product-unclassified__'

type VisibleMenuNode = { name?: string | symbol; children?: VisibleMenuNode[] }

const hasVisibleMenu = (menus: VisibleMenuNode[], code: string): boolean =>
  menus.some((menu) => menu.name === code || (menu.children && hasVisibleMenu(menu.children, code)))

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
  const menuStore = useMenuStore()
  const creationSource = ref<DeviceCreationSource>('product')
  const marketplaceCapability = ref<DeviceLibraryCapabilityState>('checking')
  const selectedProductKey = ref('')
  const selectedTemplateKey = ref('')
  const selectedProduct = ref<IotDeviceProductTemplate | null>(null)
  const selectedTemplate = ref<DeviceTemplateProductInput | null>(null)
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

  const form = reactive({
    name: '', areaId: '', area: '', groupId: '', description: '', imageUrl: '',
  })
  const selectableAreas = computed(() => areaOptions.value)
  const areaTreeData = computed(() => buildAreaTreeData(selectableAreas.value))
  const groupTreeData = computed(() => buildDeviceGroupTreeData(groupOptions.value))
  const isLibraryAvailable = computed(() => marketplaceCapability.value === 'available')
  // hasMenu 还会包含 hideInMenu 的权限路由；这里只按当前项目实际可见菜单决定是否开放按产品创建。
  const productMenuAvailable = computed(() => hasVisibleMenu(menuStore.siderMenus, 'device/Product'))
  const selectedSource = computed<IotDeviceProductTemplate | DeviceTemplateProductInput | null>(() => (
    creationSource.value === 'library' ? selectedTemplate.value : selectedProduct.value
  ))
  const installProgressState = computed<IotAddDeviceInstallProgressState>(() => ({
    logs: installProgressLogs.value,
    running: busy.value && submitAction.value === 'install',
    hasError: installProgressLogs.value.some((item) => item.type === 'error'),
  }))
  const libraryProducts = computed(() => libraryTemplates.value.map(toTemplateProductOption))
  const formRules: Record<string, Rule[]> = {
    name: [{ required: true, message: $t('IotDeviceList.add.nameRequired'), trigger: 'blur' }],
    areaId: [{
      validator: async (_rule, value) => {
        if (value && !isSelectableDeviceArea(selectableAreas.value, String(value))) throw new Error($t('IotDeviceList.add.areaLevelRequired'))
      },
      trigger: 'change',
    }],
  }

  function applySourceDefaults(source?: Pick<IotDeviceProductTemplate, 'name' | 'photoUrl'> | null) {
    form.name = source?.name || ''
    form.imageUrl = source?.photoUrl || ''
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
  }

  function selectSource(source: DeviceCreationSource) {
    if (source === 'library' && !isLibraryAvailable.value) return
    if (source === 'product' && !productMenuAvailable.value) return
    // 两种来源的产品集合不同，切换时必须撤销产品侧的在途请求并清空筛选，避免隐藏条件污染返回后的列表。
    ++productRequestSequence
    productFilterTerms.value = []
    productPageIndex.value = 0
    productTotal.value = 0
    creationSource.value = source
    errorMessage.value = ''
    if (source === 'product' && productMenuAvailable.value) void loadProductCandidates()
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
      creationSource.value = productMenuAvailable.value ? 'product' : 'library'
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

  function appendInstallProgress(progress: DeviceLibraryInstallProgress) {
    if (!progress.message) return
    installProgressLogs.value = [...installProgressLogs.value, { ...progress, id: `${Date.now()}-${installProgressLogs.value.length}` }]
  }

  function clearBasicFields() {
    form.name = ''; form.areaId = ''; form.area = ''; form.groupId = ''; form.description = ''
    imageUpload.clearImage()
    form.imageUrl = imageUpload.imageUrl.value
    errorMessage.value = ''
    installProgressLogs.value = []
    void nextTick(() => formRef.value?.clearValidate?.())
  }

  function resetForm() {
    openSequence += 1; productRequestSequence += 1; libraryRequestSequence += 1
    creationSource.value = productMenuAvailable.value ? 'product' : 'library'; marketplaceCapability.value = 'checking'
    selectedProductKey.value = ''; selectedTemplateKey.value = ''
    selectedProduct.value = null; selectedTemplate.value = null; selectedCategoryId.value = undefined
    productCandidates.value = []; productTotal.value = 0; productPageIndex.value = 0; productFilterTerms.value = []
    libraryTemplates.value = []; libraryTagGroups.value = []; libraryPageIndex.value = 0; libraryKeyword.value = ''; libraryTags.value = []; libraryHasMore.value = false
    areaOptions.value = []; groupOptions.value = []
    productMessage.value = ''; libraryMessage.value = ''; errorMessage.value = ''; installProgressLogs.value = []
    busy.value = false; submitAction.value = ''
    form.name = ''; form.areaId = ''; form.area = ''; form.groupId = ''; form.description = ''
    imageUpload.clearImage(); form.imageUrl = ''
  }

  function onClose() {
    handlers.updateOpen(false)
    window.setTimeout(resetForm, 200)
  }

  function buildDeviceCreateInput(product: IotDeviceProductTemplate | undefined, imageUrl: string) {
    return {
      projectId: props.projectId, productKey: product?.id || '', productName: product?.name, productDeviceType: product?.deviceType,
      parentId: props.parentId, name: form.name, areaId: form.areaId, area: form.area, groupId: form.groupId,
      scenario: groupOptions.value.find((group) => group.id === form.groupId)?.name,
      imageUrl, description: form.description,
    }
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
      const imageUrl = await imageUpload.resolveImageUrl()
      let product: IotDeviceProductTemplate | null = null
      let device: IotDevice
      if (creationSource.value === 'library' && selectedTemplate.value) {
        // 设备库始终沿用 install/update 闭环，由后端自动创建或更新产品并创建设备。
        submitAction.value = 'install'
        const result = await installDeviceLibraryAndCreateDevice_api({
          projectId: props.projectId,
          template: selectedTemplate.value,
          productName: selectedTemplate.value.name,
          device: buildDeviceCreateInput(undefined, imageUrl),
        }, { onProgress: appendInstallProgress })
        product = result.product
        device = result.device
      } else {
        product = selectedProduct.value
        if (!product) throw new Error($t('IotDeviceList.add.selectSourceFirst'))
        device = await createDevice_api(buildDeviceCreateInput(product, imageUrl))
      }
      if (!product) throw new Error($t('IotDeviceList.add.selectSourceFirst'))
      await bindCreatedDeviceBestEffort(device.id, product)
      handlers.created({ deviceId: device.id, deviceType: product.deviceType })
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
    if (productMenuAvailable.value) {
      void loadProductCategories()
      void loadProductCandidates(true)
    }
    void probeMarketplace()
  })

  return {
    creationSource, marketplaceCapability, isLibraryAvailable, productMenuAvailable,
    selectedProductKey, selectedTemplateKey, selectedProduct, selectedTemplate, selectedSource,
    productMessage, libraryMessage, errorMessage, productLoading, libraryLoading, libraryTagLoading,
    busy, submitAction, installProgressState,
    formRef, form, formRules, areaTreeData, groupTreeData,
    configOptionsLoading,
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
