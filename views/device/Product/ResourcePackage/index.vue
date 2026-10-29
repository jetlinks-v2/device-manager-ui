<template>
  <a-modal
    v-model:open="visible"
    :title="$t('Product.transfer.001-0')"
    :width="900"
    :mask-closable="false"
    :confirm-loading="importing"
    @cancel="close"
  >
    <a-steps :current="visibleStep" size="small" class="resource-package-steps">
      <a-step v-for="item in visibleSteps" :key="item.key" :title="$t(item.label)" />
    </a-steps>

    <template v-if="step === 0">
      <div class="resource-package-type" role="radiogroup">
        <button
          v-for="option in importOptions"
          :key="option.type"
          type="button"
          class="resource-package-type__card"
          :class="{ 'is-selected': selectedImportType === option.type }"
          :aria-pressed="selectedImportType === option.type"
          @click="selectedImportType = option.type"
        >
          <span class="resource-package-type__icon"><AIcon :type="option.icon" /></span>
          <span class="resource-package-type__content">
            <strong>{{ $t(option.label) }}</strong>
            <small>{{ $t(option.description) }}</small>
          </span>
          <AIcon v-if="selectedImportType === option.type" type="CheckCircleFilled" class="resource-package-type__check" />
        </button>
      </div>
      <a-upload-dragger
        :show-upload-list="false"
        :before-upload="handleUpload"
        :accept="uploadAccept"
      >
        <p class="ant-upload-drag-icon"><AIcon type="InboxOutlined" /></p>
        <p class="ant-upload-text">{{ uploadText }}</p>
        <p class="ant-upload-hint">{{ $t(isBasicImport ? 'Product.transfer.001-10' : 'Product.transfer.001-11') }}</p>
      </a-upload-dragger>
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

    <template v-else-if="isResultStep">
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
        {{ $t(isBasicImport ? 'Product.resourcePackage.001-17' : 'Product.resourcePackage.001-47') }}
      </a-button>
      <a-button v-if="step === 2 && !isBasicImport" type="primary" :disabled="!canContinue" :loading="loading" @click="next">
        {{ $t('Product.resourcePackage.001-17') }}
      </a-button>
      <a-button v-if="isResultStep" @click="close">{{ $t('Product.resourcePackage.001-18') }}</a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/index.css'
import { onlyMessage } from '@jetlinks-web/utils'
import { filterSelectNode, encodeQuery } from '@/utils'
import { device } from '../../../../assets'
import {
  category,
  importProductResourcePackage,
  parseProductResourcePackage,
  queryPluginDriverList,
  queryProtocolList,
  queryGatewayList,
  updateDevice,
  type ProductResourcePackageManifest,
  type ProductResourcePackageParseResult,
} from '../../../../api/product'
import { certificates, queryNetworkConfigList } from '../../../../api/link/type'
import ResourceSelection from './components/ResourceSelection.vue'
import { useResourcePackagePreflight } from './useResourcePackagePreflight'

const emit = defineEmits<{ success: [] }>()
const { t: $t } = useI18n()

const visible = ref(false)
const step = ref(0)
const loading = ref(false)
const importing = ref(false)
const parsed = ref<ProductResourcePackageParseResult>()
const progress = ref<any[]>([])
const selectedImportType = ref<'basic' | 'resource'>('resource')
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

interface LocalResourceOption {
  label: string
  value: string
  type?: string
  version?: string
  description?: string
  resource?: Record<string, any>
}

const manifest = computed<ProductResourcePackageManifest | undefined>(() => parsed.value?.manifest)
const storagePolicyOptions = computed(() => preflight.environment.value.storagePolicies.map(item => ({ label: item.name, value: item.id })))
const preflightErrors = preflight.errors
const storagePolicyError = computed(() => preflight.isStoragePolicyAvailable(product.storePolicy)
  ? undefined
  : $t('Product.resourcePackage.001-57'))
// 存储策略属于基础信息，设备接入步骤只显示接入资源的预检结果。
const accessPreflightErrors = computed(() => preflightErrors.value
  .filter(error => error !== $t('Product.resourcePackage.001-57')))
const isBasicImport = computed(() => selectedImportType.value === 'basic')
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
const visibleStep = computed(() => isResultStep.value ? visibleSteps.value.length - 1 : step.value)
const uploadAccept = computed(() => isBasicImport.value
  ? '.json,application/json'
  : '.zip,application/zip,application/x-zip-compressed')
const uploadText = computed(() => $t(isBasicImport.value
  ? 'Product.transfer.001-6'
  : 'Product.transfer.001-7'))
const importOptions = [
  { type: 'basic' as const, label: 'Product.transfer.001-2', description: 'Product.transfer.001-4', icon: 'FileTextOutlined' },
  { type: 'resource' as const, label: 'Product.transfer.001-3', description: 'Product.transfer.001-5', icon: 'FolderOpenOutlined' },
]
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
  selectedImportType.value = 'resource'
  visible.value = true
}

const reset = () => {
  step.value = 0
  loading.value = false
  importing.value = false
  parsed.value = undefined
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
  subscription?.unsubscribe()
  subscription = undefined
  visible.value = false
}

/** 统一处理两种已发布导入格式，避免旧 JSON 导入绕过确认表单。 */
const handleUpload = (file: File) => isBasicImport.value ? prepareBasicProduct(file) : beforeUpload(file)

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
    Object.assign(product, JSON.parse(JSON.stringify(parsed.value.manifest.product)))
    product.deviceType = getEnumValue(product.deviceType)
    product.photoUrl = product.photoUrl || device.deviceProduct
    await Promise.all([preflight.load(), loadCategoryTree(), loadLocalOptions(), loadCompatibleGateways()])
    validate()
    step.value = 1
  } catch (error: any) {
    onlyMessage(error?.message || $t('Product.resourcePackage.001-20'), 'error')
  } finally {
    loading.value = false
  }
  return false
}

/** 旧 JSON 仅导入产品基础信息；关联资源仍由 ZIP 资源包流程处理。 */
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
    const data: unknown = JSON.parse(content)
    if (!data || Array.isArray(data) || typeof data !== 'object') {
      onlyMessage($t('Product.index.660348-25'), 'error')
      return false
    }
    Object.assign(product, data as Record<string, any>)
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
  } catch (error: any) {
    onlyMessage(error?.message || $t('Product.index.660348-19'), 'error')
  } finally {
    loading.value = false
  }
  return false
}

const readUtf8File = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(reader.error)
  reader.readAsText(file, 'UTF-8')
})

// 旧 JSON 导出包含来源环境的审计信息，不能覆盖导入环境的创建和修改记录。
const clearProductAuditFields = (data: Record<string, any>) => {
  ['creatorId', 'creatorName', 'createTime', 'modifierId', 'modifierName', 'modifyTime']
    .forEach(field => delete data[field])
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
    if (isBasicImport.value) {
      if (!validate()) return
      startBasicImport()
      return
    }
    // 使用当前基础信息重算预检，避免资源包内的旧存储策略错误带入设备接入步骤。
    validate()
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

const startBasicImport = async () => {
  if (importing.value) return
  importing.value = true
  step.value = 2
  try {
    const response = await updateDevice(product)
    if (response.status !== 200) throw new Error($t('Product.index.660348-19'))
    progress.value.push({ type: 'completed', message: $t('Product.transfer.001-12', { name: product.name }) })
    emit('success')
  } catch (error: any) {
    progress.value.push({ type: 'error', message: error?.message || $t('Product.index.660348-19') })
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

/** 以资源名称替代内部 ID 和阶段字段，日志只暴露用户能理解的导入结果。 */
const formatProgressMessage = (event: any) => {
  if (!event.resourceType || !event.action) return event.message || ''
  const labels: Record<string, string> = {
    gateway: 'Product.resourcePackage.001-26', network: 'Product.resourcePackage.001-25',
    protocol: 'Product.resourcePackage.001-22', certificate: 'Product.resourcePackage.001-24',
    plugin: 'Product.resourcePackage.001-23', category: 'Product.resourcePackage.001-64',
    product: 'Product.resourcePackage.001-63', preprocessor: 'Product.resourcePackage.001-65',
  }
  const messages: Record<string, string> = {
    create: 'Product.resourcePackage.001-66', save: 'Product.resourcePackage.001-66',
    update: 'Product.resourcePackage.001-67', reference: 'Product.resourcePackage.001-68',
  }
  const resourceType = labels[event.resourceType]
  const message = messages[event.action]
  if (!resourceType || !message) return event.message || ''
  const id = event.resourceId
  const name = event.resourceType === 'product' ? product.name
    : event.resourceType === 'category' ? manifest.value?.categories?.find(item => item.id === id)?.name
      : event.resourceType === 'preprocessor' ? manifest.value?.preprocessors?.find(item => item.id === id)?.name
        : localOptions[event.resourceType]?.find(item => item.value === id)?.label
          || manifest.value?.accessResources?.[event.resourceType]?.name || id
  return name ? $t(message, { resourceType: $t(resourceType), name }) : event.message || ''
}

const startImport = () => {
  if (!parsed.value || importing.value) return
  importing.value = true
  step.value = 3
  subscription = importProductResourcePackage({
    fileId: parsed.value.fileId,
    accessMode: isLocalGateway.value ? 'LOCAL_GATEWAY' : 'PACKAGE',
    gatewayId: isLocalGateway.value ? resourceSelections.gateway?.id : undefined,
    product,
    categories: manifest.value!.categories,
    resourceSelections,
  }).subscribe({
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

defineExpose({ show })
</script>

<style scoped>
.resource-package-steps { margin-bottom: 24px; }
.resource-alert { margin-top: 16px; }
.gateway-type { margin-top: 16px; }
.resource-grid { margin-top: 12px; }
.metadata-preview { max-height: 520px; overflow: auto; background: #fafafa; }
.storage-policy-help { margin-left: 2px; }
.device-type-option { display: flex; align-items: center; justify-content: space-between; }
.resource-package-type { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.resource-package-type__card { display: grid; grid-template-columns: 36px minmax(0, 1fr) 20px; align-items: center; gap: 12px; min-height: 88px; padding: 16px; border: 1px solid var(--color-jet-border, rgba(0, 0, 0, 0.09)); border-radius: 8px; background: var(--color-jet-fill, #fff); color: inherit; text-align: left; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.resource-package-type__card:hover, .resource-package-type__card.is-selected { border-color: var(--jet-theme-primary); }
.resource-package-type__card.is-selected { background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.06)); }
.resource-package-type__icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: var(--color-jet-primary-bg, rgba(22, 119, 255, 0.08)); color: var(--jet-theme-primary); font-size: 18px; }
.resource-package-type__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
.resource-package-type__content strong { font-weight: 500; }
.resource-package-type__content small { color: var(--color-jet-text-secondary, rgba(0, 0, 0, 0.45)); line-height: 1.5; }
.resource-package-type__check { color: var(--jet-theme-primary); font-size: 18px; }
@media (max-width: 640px) { .resource-package-type { grid-template-columns: 1fr; } }
</style>
