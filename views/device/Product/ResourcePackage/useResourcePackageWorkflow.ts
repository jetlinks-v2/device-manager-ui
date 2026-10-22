import { computed, onBeforeUnmount, reactive, ref } from 'vue'
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
  type ProductResourcePackageManifest,
  type ProductResourcePackageParseResult,
} from '../../../../api/product'
import { certificates, queryNetworkConfigList } from '../../../../api/link/type'
import { useResourcePackagePreflight } from './useResourcePackagePreflight'


export const useResourcePackageWorkflow = (emit: (event: 'success') => void) => {
const { t: $t } = useI18n()

const visible = ref(false)
const step = ref(0)
const loading = ref(false)
const importing = ref(false)
const parsed = ref<ProductResourcePackageParseResult>()
const packageFile = ref<File>()
const progress = ref<any[]>([])
const productFormRef = ref()
const product = reactive<Record<string, any>>({})
const metadataVisible = ref(false)
const showSelectionValidation = ref(false)
const categoryTree = ref<Record<string, any>[]>([])
const resourceSelections = reactive<Record<string, any>>({})
const localOptions = reactive<Record<string, { label: string; value: string }[]>>({ protocol: [], plugin: [], certificate: [], network: [], gateway: [] })
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

const manifest = computed<ProductResourcePackageManifest | undefined>(() => parsed.value?.manifest)
const storagePolicyOptions = computed(() => preflight.environment.value.storagePolicies.map(item => ({ label: item.name, value: item.id })))
const preflightErrors = preflight.errors
const storagePolicyError = computed(() => preflight.isStoragePolicyAvailable(product.storePolicy)
  ? undefined
  : $t('Product.resourcePackage.001-57'))
const hasAccessResources = computed(() => resourceTypes
  .some(type => !!manifest.value?.accessResources?.[type.key]))
const visibleSteps = computed(() => [
  { key: 'upload', label: 'Product.resourcePackage.001-1' },
  { key: 'basic', label: 'Product.resourcePackage.001-38' },
  ...(hasAccessResources.value ? [{ key: 'access', label: 'Product.resourcePackage.001-39' }] : []),
  { key: 'result', label: 'Product.resourcePackage.001-3' },
])
const visibleStep = computed(() => {
  if (step.value === 3) return visibleSteps.value.length - 1
  return step.value
})
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
  } catch (error: any) {
    onlyMessage(error?.message || $t('Product.resourcePackage.001-20'), 'error')
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
  }))
}

/** 为包内各个可替换资源加载本地候选项；网关单独按 accessProvider 过滤。 */
const loadLocalOptions = async () => {
  const [protocols, plugins, certificatesResult, networks] = await Promise.all([
    queryProtocolList(), queryPluginDriverList(), certificates(), queryNetworkConfigList(),
  ])
  const toOptions = (response: any) => (response.result || []).map((item: any) => ({ label: item.name, value: item.id }))
  localOptions.protocol = toOptions(protocols)
  localOptions.plugin = toOptions(plugins)
  localOptions.certificate = toOptions(certificatesResult)
  localOptions.network = toOptions(networks)
  localNetworks.value = networks.result || []
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
    if (!hasAccessResources.value) {
      if (!validate()) return
      startImport()
      return
    }
    step.value = 2
    return
  }
  if (step.value === 2) {
    showSelectionValidation.value = true
    if (hasIncompleteLocalSelection.value) return
    if (!validate()) return
    startImport()
  }
}

const previous = () => {
  step.value -= 1
}

const progressStatus = (type: string) => {
  if (type === 'error') return 'error'
  return type === 'success' || type === 'completed' ? 'success' : 'processing'
}

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
    next: (item: any) => {
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
    visibleSteps,
    visibleStep,
    canContinue,
    imageTypes,
    productRules,
    deviceTypes,
    beforeUpload,
    changeCategory,
    changeDeviceType,
    handleGatewaySelection,
    handleResourceSelection,
    next,
    previous,
    progress,
    progressStatus,
    close,
    show,
  }
}
