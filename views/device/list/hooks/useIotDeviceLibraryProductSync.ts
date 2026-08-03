import { computed, ref, type Ref } from 'vue'
import {
  queryDeviceCountByProductId_api,
  queryDeviceGatewayById_api,
  queryDeviceProductById_api,
  type DeviceTemplateProductInput,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import {
  joinDeviceLibraryToProject_api,
  queryDeviceLibraryTemplateGateway_api,
  queryProjectInstalledDeviceLibrary_api,
} from '@device-manager-ui/api/device-library'
import {
  detectRestrictedDeviceLibraryProductChanges,
  type DeviceLibraryProductRestrictedField,
} from './iotDeviceLibraryProductSync'

type UseProductSyncOptions = {
  projectId: () => string
  projectProducts: Ref<IotDeviceProductTemplate[]>
  templateProducts: Ref<DeviceTemplateProductInput[]>
  selectedTemplateKey: Ref<string>
  selectedProductKey: Ref<string>
  loadProducts: () => Promise<void>
  t: (key: string) => string
}

export type LibraryProductSyncState = {
  checking: boolean
  installed: boolean
  productId: string
  productName: string
  deviceCount: number
  restrictedFields: DeviceLibraryProductRestrictedField[]
  updateDisabled: boolean
}

const createEmptyState = (): LibraryProductSyncState => ({
  checking: false,
  installed: false,
  productId: '',
  productName: '',
  deviceCount: 0,
  restrictedFields: [],
  updateDisabled: false,
})

export function useIotDeviceLibraryProductSync(options: UseProductSyncOptions) {
  const state = ref<LibraryProductSyncState>(createEmptyState())
  const disabledReason = computed(() =>
    state.value.updateDisabled ? options.t('IotDeviceList.add.updateAndCreateDisabledTip') : '',
  )

  const reset = () => {
    state.value = createEmptyState()
  }

  const upsertProduct = (product: IotDeviceProductTemplate) => {
    options.projectProducts.value = [
      product,
      ...options.projectProducts.value.filter((item) => item.id !== product.id),
    ]
    options.selectedProductKey.value = product.id
  }

  const currentTemplate = () =>
    options.templateProducts.value.find((item) => item.id === options.selectedTemplateKey.value)

  const resolveTemplateProduct = async (template: DeviceTemplateProductInput) => {
    await options.loadProducts()
    const existingProduct = options.projectProducts.value.find((item) =>
      item.templateId === template.id || item.id === template.installedProductId,
    )
    if (existingProduct) {
      options.selectedProductKey.value = existingProduct.id
      return existingProduct
    }
    if (!template.installedProductId) return null

    const product = await queryDeviceProductById_api(template.installedProductId).catch(() => null)
    if (product) upsertProduct(product)
    return product
  }

  const syncSelectedProduct = async () => {
    const template = currentTemplate()
    if (!template) return null
    const existingProduct = await resolveTemplateProduct(template)
    const product = await joinDeviceLibraryToProject_api({
      projectId: options.projectId(),
      template,
      productName: template.name,
    }, {
      updateProduct: true,
    })
    upsertProduct(product)
    options.selectedTemplateKey.value = template.id
    state.value = { ...createEmptyState(), installed: true, productId: product.id, productName: product.name }
    return product
  }

  const prepare = async () => {
    const template = currentTemplate()
    state.value = { ...createEmptyState(), checking: Boolean(template) }
    if (!template) return

    let preparedTemplate = template
    if (!template.installed && !template.installedProductId) {
      const installed = await queryProjectInstalledDeviceLibrary_api(options.projectId(), [template.id])
      preparedTemplate = {
        ...template,
        installed: installed.has(template.id),
        installedProductId: installed.get(template.id),
      }
      options.templateProducts.value = options.templateProducts.value.map((item) =>
        item.id === template.id ? preparedTemplate : item,
      )
    }

    const product = await resolveTemplateProduct(preparedTemplate)
    if (!product) return
    const [targetGateway, currentGateway, deviceCount] = await Promise.all([
      queryDeviceLibraryTemplateGateway_api(preparedTemplate).catch(() => null),
      product.accessId ? queryDeviceGatewayById_api(product.accessId).catch(() => null) : Promise.resolve(null),
      queryDeviceCountByProductId_api(product.id).catch(() => 0),
    ])
    const restrictedFields = detectRestrictedDeviceLibraryProductChanges(product, preparedTemplate, {
      targetGateway,
      currentGateway,
    })
    state.value = {
      checking: false,
      installed: true,
      productId: product.id,
      productName: product.name,
      deviceCount,
      restrictedFields,
      updateDisabled: deviceCount > 0 && restrictedFields.length > 0,
    }
  }

  const finishChecking = () => {
    state.value = { ...state.value, checking: false }
  }

  return { state, disabledReason, reset, syncSelectedProduct, prepare, finishChecking }
}
