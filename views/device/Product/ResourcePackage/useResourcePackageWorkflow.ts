import { computed, onBeforeUnmount, reactive, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { encodeQuery, filterSelectNode } from '@jetlinks-web-core/utils'
import { device } from '../../../../assets'
import {
  category,
  importProductResourcePackage,
  parseProductResourcePackage,
  queryPluginDriverList,
  queryProtocolList,
  queryGatewayList,
  type ProductResourcePackageImportProgress,
  type ProductResourcePackageManifest,
  type ProductResourcePackageParseResult,
  updateDevice,
} from '../../../../api/product'
import { certificates, queryNetworkConfigList } from '../../../../api/link/type'
import { useResourcePackagePreflight } from './useResourcePackagePreflight'
import type { ProductTransferType } from '../hooks/useProductTransfer'

export const useResourcePackageWorkflow = (
  emit: (event: 'success') => void,
  importType: Ref<ProductTransferType>,
) => {
const { t: $t } = useI18n()

const visible = ref(false)
const step = ref(0)
const maxReachableStep = ref(0)
const loading = ref(false)
const importing = ref(false)
const parsed = ref<ProductResourcePackageParseResult>()
const packageFile = ref<File>()
const progress = ref<ProductResourcePackageImportProgress[]>([])
const productFormRef = ref()
const product = reactive<Record<string, any>>({})
const metadataVisible = ref(false)
const showSelectionValidation = ref(false)
const categoryTree = ref<Record<string, any>[]>([])
const resourceSelections = reactive<Record<string, any>>({})
const localOptions = reactive<Record<string, LocalResourceOption[]>>({ protocol: [], plugin: [], certificate: [], network: [], gateway: [] })
const localNetworks = ref<Record<string, any>[]>([])
const preflight = useResourcePackagePreflight()
const resourceTypes = [
  { key: 'gateway', label: 'Product.resourcePackage.001-26' },
  { key: 'network', label: 'Product.resourcePackage.001-25' },
  { key: 'protocol', label: 'Product.resourcePackage.001-22' },
  { key: 'certificate', label: 'Product.resourcePackage.001-24' },
  { key: 'plugin', label: 'Product.resourcePackage.001-23' },
] as const
const imageTypes = ['image/jpeg', 'image/png', 'image/jfif', 'image/pjp']
const productRules = {
  name: [{ required: true, message: $t('Product.resourcePackage.001-42'), trigger: 'blur' }, { max: 64, message: $t('Product.resourcePackage.001-43'), trigger: 'blur' }],
  deviceType: [{ required: true, message: $t('Product.resourcePackage.001-44'), trigger: 'change' }],
  describe: [{ max: 200, message: $t('Product.resourcePackage.001-45'), trigger: 'blur' }],
}
const deviceTypes = [
  { label: $t('Save.index.912481-11'), value: 'device', iconUrl: device.deviceType1, tooltip: $t('Save.index.912481-12') },
  { label: $t('Save.index.912481-13'), value: 'childrenDevice', iconUrl: device.deviceType2, tooltip: $t('Save.index.912481-14') },
  { label: $t('Save.index.912481-15'), value: 'gateway', iconUrl: device.deviceType3, tooltip: $t('Save.index.912481-16') },
]
let subscription: { unsubscribe: () => void } | undefined

/** 显式按 UTF-8 读取既有 JSON 导出文件，避免浏览器默认编码影响导入。 */
const readUtf8File = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error)
  reader.readAsText(file, 'UTF-8')
})

const manifest = computed<ProductResourcePackageManifest | undefined>(() => parsed.value?.manifest)
const storagePolicyOptions = computed(() => preflight.environment.value.storagePolicies.map(item => ({ label: item.name, value: item.id })))
const preflightErrors = preflight.errors
const storagePolicyError = computed(() => preflight.isStoragePolicyAvailable(product.storePolicy)
  ? undefined
  : $t('Product.resourcePackage.001-57'))
// 存储策略在基础信息步骤已单独处理，设备接入页只展示接入资源的校验结果。
const accessPreflightErrors = computed(() => preflightErrors.value
  .filter(error => error !== $t('Product.resourcePackage.001-57')))
const hasAccessResources = computed(() => resourceTypes
  .some(type => !!manifest.value?.accessResources?.[type.key]))
const isBasicImport = computed(() => importType.value === 'basic')
const isResultStep = computed(() => isBasicImport.value ? step.value === 2 : step.value === 3)
const visibleSteps = computed(() => isBasicImport.value
  ? [
      { key: 'upload', label: 'Product.transfer.001-9' },
      { key: 'basic', label: 'Product.resourcePackage.001-38' },
      { key: 'result', label: 'Product.resourcePackage.001-3' },
    ]
  : [
      { key: 'upload', label: 'Product.transfer.001-9' },
      { key: 'basic', label: 'Product.resourcePackage.001-38' },
      { key: 'access', label: 'Product.resourcePackage.001-39' },
      { key: 'result', label: 'Product.resourcePackage.001-3' },
    ])
const visibleStep = computed(() => {
  if (isResultStep.value) return visibleSteps.value.length - 1
  return step.value
})
const canJumpToStep = (targetStep: number) => !isResultStep.value
  && targetStep < visibleSteps.value.length - 1
  && targetStep <= maxReachableStep.value
const changeStep = async (targetStep: number) => {
  if (!canJumpToStep(targetStep)) return
  if (step.value === 1 && targetStep > step.value) {
    try {
      await productFormRef.value?.validate()
    } catch {
      return
    }
    if (storagePolicyError.value) return
    validate()
  }
  step.value = targetStep
}
const dependentResourceTypes = computed(() => resourceTypes
  .filter(type => type.key !== 'gateway' && !!manifest.value?.accessResources?.[type.key]))
const isLocalGateway = computed(() => resourceSelections.gateway?.source === 'LOCAL')
const gatewayProviderName = computed(() => {
  const provider = preflight.environment.value.gatewayProviders
    .find(item => (item.value || item.id || item.provider) === product.accessProvider)
  return provider?.name || provider?.text || product.accessProvider
})
const metadataPreview = computed(() => {
  const metadata = product.metadata
  if (!metadata) return undefined
  try {
    return typeof metadata === 'string' ? JSON.parse(metadata) : metadata
  } catch {
    return metadata
  }
})
const hasIncompleteLocalSelection = computed(() => Object
  .values(resourceSelections)
  .some((resource: any) => resource?.source === 'LOCAL' && !resource.id))
const canContinue = computed(() => {
  if (step.value === 0) return !!parsed.value
  return true
})

const show = () => {
  reset()
  visible.value = true
}

const reset = () => {
  step.value = 0
  maxReachableStep.value = 0
  loading.value = false
  importing.value = false
  parsed.value = undefined
  packageFile.value = undefined
  progress.value = []
  metadataVisible.value = false
  showSelectionValidation.value = false
  Object.keys(product).forEach(key => delete product[key])
  Object.keys(resourceSelections).forEach(key => delete resourceSelections[key])
  localNetworks.value = []
  resourceTypes.forEach(type => { localOptions[type.key] = [] })
  subscription?.unsubscribe()
  subscription = undefined
}

const close = () => {
  // 取消 NDJSON 订阅后立即复位，避免下次打开弹窗被上一次导入状态阻塞。
  subscription?.unsubscribe()
  subscription = undefined
  importing.value = false
  visible.value = false
}

const beforeUpload = async (file: File) => {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    onlyMessage($t('Product.resourcePackage.001-19'), 'warning')
    return false
  }
  reset()
  loading.value = true
  try {
    const data = new FormData()
    data.append('file', file)
    const response = await parseProductResourcePackage(data)
    parsed.value = response.result
    if (!parsed.value?.manifest?.product?.id) {
      throw new Error($t('Product.resourcePackage.001-20'))
    }
    packageFile.value = file
    Object.assign(product, JSON.parse(JSON.stringify(parsed.value.manifest.product)))
    product.deviceType = getEnumValue(product.deviceType)
    product.photoUrl = product.photoUrl || device.deviceProduct
    const loadTasks = [preflight.load(), loadCategoryTree()]
    if (hasAccessResources.value) {
      loadTasks.push(loadLocalOptions(), loadCompatibleGateways())
    }
    await Promise.all(loadTasks)
    validate()
    step.value = 1
    maxReachableStep.value = 1
  } catch (error: any) {
    onlyMessage(error?.message || $t('Product.resourcePackage.001-20'), 'error')
  } finally {
    loading.value = false
  }
  return false
}

/** JSON 仅在用户确认后提交；上传阶段只解析、校验并准备基础信息。 */
const prepareBasicProduct = async (file: File) => {
  if (!file.name.toLowerCase().endsWith('.json')) {
    onlyMessage($t('Product.index.660348-23'), 'error')
    return false
  }

  reset()
  loading.value = true
  try {
    const content = await readUtf8File(file)
    if (!content.trim()) {
      onlyMessage($t('Product.index.660348-24'), 'error')
      return false
    }

    let parsedProduct: Record<string, any>
    try {
      const data: unknown = JSON.parse(content)
      if (!data || Array.isArray(data) || typeof data !== 'object') {
        throw new Error()
      }
      parsedProduct = data as Record<string, any>
    } catch {
      onlyMessage($t('Product.index.660348-25'), 'error')
      return false
    }

    Object.assign(product, parsedProduct)
    clearProductAuditFields(product)
    delete product.state
    if (!product.name) product.name = `${$t('Product.index.660348-15')}${Date.now()}`
    product.deviceType = getEnumValue(product.deviceType)
    if (!product.deviceType) {
      onlyMessage($t('Product.index.660348-26'), 'error')
      return false
    }

    await Promise.all([preflight.load(), loadCategoryTree()])
    validate()
    step.value = 1
    maxReachableStep.value = 1
  } catch (error: any) {
    onlyMessage(error?.message || $t('Product.index.660348-19'), 'error')
  } finally {
    loading.value = false
  }
  return false
}

const loadCompatibleGateways = async () => {
  const response = await queryGatewayList({
    paging: false,
    terms: [{ column: 'provider', value: manifest.value?.product?.accessProvider, termType: 'eq' }],
  })
  localOptions.gateway = (response.result || []).map((gateway: any) => ({
    label: gateway.name,
    value: gateway.id,
    type: getEnumValue(gateway.provider || gateway.type),
    version: gateway.version,
    description: gateway.description || gateway.describe,
    resource: gateway,
  }))
}

/** 为包内各个可替换资源加载本地候选项；网关单独按 accessProvider 过滤。 */
const loadLocalOptions = async () => {
  const [protocols, plugins, certificatesResult, networks] = await Promise.all([
    queryProtocolList(), queryPluginDriverList(), certificates(), queryNetworkConfigList(),
  ])
  const toOptions = (response: any) => (response.result || []).map((item: any) => ({
    label: item.name,
    value: item.id,
    type: getEnumValue(item.type || item.provider),
    version: item.version,
    description: item.description || item.describe,
    resource: item,
  }))
  localOptions.protocol = toOptions(protocols)
  localOptions.plugin = toOptions(plugins)
  localOptions.certificate = toOptions(certificatesResult)
  localOptions.network = toOptions(networks)
  localNetworks.value = networks.result || []
}

interface LocalResourceOption {
  label: string
  value: string
  type?: string
  version?: string
  description?: string
  resource?: Record<string, any>
}

const loadCategoryTree = async () => {
  const response = await category(encodeQuery({ sorts: { sortIndex: 'asc' } }))
  categoryTree.value = mergePackageCategories(response.result || [], manifest.value?.categories || [])
}

/** 将资源包中的父子分类补入本地分类树，使尚未实际导入的目标分类也能在表单中正确回显。 */
const mergePackageCategories = (tree: Record<string, any>[], categories: Record<string, any>[]) => {
  const result = JSON.parse(JSON.stringify(tree))
  let current = result
  categories.forEach(categoryItem => {
    let item = current.find((node: Record<string, any>) => node.id === categoryItem.id)
    if (!item) {
      item = { ...categoryItem, children: [] }
      current.push(item)
    }
    item.children = item.children || []
    current = item.children
  })
  return result
}

const getEnumValue = (value: any) => value && typeof value === 'object' ? value.value : value

/** JSON 导出包含来源环境的审计信息，导入前必须移除，避免覆盖本地的创建与修改记录。 */
const clearProductAuditFields = (data: Record<string, any>) => {
  [
    'creatorId',
    'creatorName',
    'createTime',
    'modifierId',
    'modifierName',
    'modifyTime',
  ].forEach(field => delete data[field])
}

const changeCategory = (_value: string, label: string | string[]) => {
  product.classifiedName = Array.isArray(label) ? label[0] : label
}

const changeDeviceType = (value: string | string[]) => {
  product.deviceType = Array.isArray(value) ? value[0] : value
}

const validate = () => {
  if (isLocalGateway.value) {
    return preflight.validate(product)
  }
  const selectedNetwork = resourceSelections.network
  const network = selectedNetwork
    ? selectedNetwork.source === 'PACKAGE' ? selectedNetwork : undefined
    : manifest.value?.accessResources?.network
  return preflight.validate(product, network, localNetworks.value)
}

const handleGatewaySelection = () => {
  // 本地资源切换期间只重算预检，不在用户真正提交前显示“请选择”提示。
  showSelectionValidation.value = false
  if (isLocalGateway.value) {
    dependentResourceTypes.value.forEach(type => delete resourceSelections[type.key])
  }
  validate()
}

const handleResourceSelection = () => {
  showSelectionValidation.value = false
  validate()
}

const next = async () => {
  if (step.value === 0) return
  if (step.value === 1) {
    try {
      await productFormRef.value?.validate()
    } catch {
      return
    }
    if (storagePolicyError.value) return
    showSelectionValidation.value = false
    if (isBasicImport.value) {
      if (!validate()) return
      startBasicImport()
      return
    }
    // 使用当前基础信息重算预检，避免资源包原始存储策略的历史错误带入下一步。
    validate()
    step.value = 2
    maxReachableStep.value = 2
    return
  }
  if (step.value === 2) {
    showSelectionValidation.value = true
    if (hasIncompleteLocalSelection.value) return
    if (!validate()) return
    startImport()
  }
}

const startBasicImport = async () => {
  if (importing.value) return
  importing.value = true
  step.value = 2
  try {
    const response = await updateDevice(product)
    if (response.status !== 200) {
      throw new Error($t('Product.index.660348-19'))
    }
    progress.value.push({
      type: 'completed',
      message: $t('Product.transfer.001-12', { name: product.name }),
    })
    emit('success')
  } catch (error: any) {
    progress.value.push({
      type: 'error',
      stage: 'import',
      message: error?.message || $t('Product.index.660348-19'),
    })
  } finally {
    importing.value = false
  }
}

const previous = () => {
  step.value -= 1
}

const progressStatus = (type: string) => {
  if (type === 'error') return 'error'
  return type === 'success' || type === 'completed' ? 'success' : 'processing'
}

const formatProgressMessage = (event: ProductResourcePackageImportProgress) => {
  if (!event.resourceType || !event.action) return event.message || ''
  const resourceType = getProgressResourceTypeLabel(event.resourceType)
  const resourceName = getProgressResourceName(event)
  if (!resourceType || !resourceName) return event.message || ''
  const actionMessageKeys: Record<string, string> = {
    create: 'Product.resourcePackage.001-66',
    save: 'Product.resourcePackage.001-66',
    update: 'Product.resourcePackage.001-67',
    reference: 'Product.resourcePackage.001-68',
  }
  const messageKey = actionMessageKeys[event.action]
  return messageKey ? $t(messageKey, { resourceType, name: resourceName }) : event.message || ''
}

const getProgressResourceTypeLabel = (resourceType: string) => {
  const labels: Record<string, string> = {
    gateway: 'Product.resourcePackage.001-26',
    network: 'Product.resourcePackage.001-25',
    protocol: 'Product.resourcePackage.001-22',
    certificate: 'Product.resourcePackage.001-24',
    plugin: 'Product.resourcePackage.001-23',
    category: 'Product.resourcePackage.001-64',
    product: 'Product.resourcePackage.001-63',
    preprocessor: 'Product.resourcePackage.001-65',
  }
  const label = labels[resourceType]
  return label ? $t(label) : undefined
}

const getProgressResourceName = (event: ProductResourcePackageImportProgress) => {
  const resourceId = event.resourceId
  if (!resourceId) return undefined
  const resourceType = event.resourceType
  if (!resourceType) return resourceId
  if (resourceType === 'product') return product.name || resourceId
  if (resourceType === 'category') {
    return manifest.value?.categories?.find(item => item.id === resourceId)?.name || resourceId
  }
  if (resourceType === 'preprocessor') {
    return manifest.value?.preprocessors?.find(item => item.id === resourceId)?.name || resourceId
  }
  const localResource = resourceSelections[resourceType]?.source === 'LOCAL'
    ? localOptions[resourceType]?.find(item => item.value === resourceId)
    : undefined
  return localResource?.label || manifest.value?.accessResources?.[resourceType]?.name || resourceId
}

/** 仅接受后端 NDJSON 返回的阶段记录，避免异常载荷进入导入结果列表。 */
const isImportProgress = (value: unknown): value is ProductResourcePackageImportProgress =>
  Boolean(value && typeof value === 'object' && 'type' in value && typeof value.type === 'string')

const startImport = () => {
  if (!parsed.value || !packageFile.value || importing.value) return
  importing.value = true
  step.value = 3
  const data = new FormData()
  data.append('file', packageFile.value)
  data.append('request', new Blob([JSON.stringify({
    accessMode: isLocalGateway.value ? 'LOCAL_GATEWAY' : 'PACKAGE',
    gatewayId: isLocalGateway.value ? resourceSelections.gateway?.id : undefined,
    product,
    categories: manifest.value!.categories,
    resourceSelections,
  })], { type: 'application/json' }))
  subscription = importProductResourcePackage(data).subscribe({
    next: item => {
      if (!isImportProgress(item)) {
        importing.value = false
        progress.value.push({ type: 'error', stage: 'import', message: $t('Product.resourcePackage.001-21') })
        return
      }
      progress.value.push(item)
      if (item.type === 'completed') {
        importing.value = false
        if (!progress.value.some(event => event.type === 'error')) emit('success')
      }
    },
    error: (error: any) => {
      importing.value = false
      progress.value.push({ type: 'error', stage: 'import', message: error?.message || $t('Product.resourcePackage.001-21') })
    },
  })
}


  onBeforeUnmount(close)

  return {
    visible,
    step,
    loading,
    importing,
    productFormRef,
    product,
    metadataVisible,
    preflightErrors,
    accessPreflightErrors,
    storagePolicyError,
    showSelectionValidation,
    categoryTree,
    resourceSelections,
    localOptions,
    manifest,
    storagePolicyOptions,
    dependentResourceTypes,
    isLocalGateway,
    gatewayProviderName,
    metadataPreview,
    hasIncompleteLocalSelection,
    hasAccessResources,
    isBasicImport,
    isResultStep,
    visibleSteps,
    visibleStep,
    canJumpToStep,
    changeStep,
    validate,
    canContinue,
    imageTypes,
    productRules,
    deviceTypes,
    beforeUpload,
    prepareBasicProduct,
    changeCategory,
    changeDeviceType,
    handleGatewaySelection,
    handleResourceSelection,
    filterSelectNode,
    next,
    previous,
    progress,
    progressStatus,
    formatProgressMessage,
    close,
    show,
  }
}
