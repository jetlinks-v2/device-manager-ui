import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMenuStore } from '@jetlinks-web-core/store'
import { encodeConditionFilterQuery } from '@jetlinks-web-core/components/ConditionFilter'
import { onlyMessage } from '@jetlinks-web/utils'
import { _deploy } from '@device-manager-ui/api/product'
import { getDeviceListFilterFields } from '../../../../deviceListFilter'

type CreatedProduct = { id?: string; name?: string }

export type ProductCreatedGuideState = {
  id: string
  name: string
  accessConfigured: boolean
  metadataSaved: boolean
  enabled: boolean
}

const storagePrefix = 'product-created-guide:'
const activeStorageKey = `${storagePrefix}active`

function storageKey(productId: string) {
  return `${storagePrefix}${productId}`
}

/** Keeps this browser-tab-only continuation separate from normal product maintenance. */
function readGuide(productId: string): ProductCreatedGuideState | undefined {
  try {
    const raw = window.sessionStorage.getItem(storageKey(productId))
    return raw ? JSON.parse(raw) as ProductCreatedGuideState : undefined
  } catch {
    return undefined
  }
}

function writeGuide(state: ProductCreatedGuideState) {
  window.sessionStorage.setItem(storageKey(state.id), JSON.stringify(state))
}

function readActiveProductId() {
  try {
    return window.sessionStorage.getItem(activeStorageKey) || undefined
  } catch {
    return undefined
  }
}

function setActiveProductId(productId: string) {
  window.sessionStorage.setItem(activeStorageKey, productId)
}

function clearActiveProductId(productId?: string) {
  if (!productId || readActiveProductId() === productId) window.sessionStorage.removeItem(activeStorageKey)
}

export function hasProductCreatedGuide(productId?: string) {
  return Boolean(productId && readGuide(productId))
}

export function updateProductCreatedGuide(productId: string, patch: Partial<Omit<ProductCreatedGuideState, 'id'>>) {
  const current = readGuide(productId)
  if (!current) return undefined
  const next = { ...current, ...patch }
  writeGuide(next)
  return next
}

export function clearProductCreatedGuide(productId?: string) {
  if (!productId) return
  window.sessionStorage.removeItem(storageKey(productId))
  clearActiveProductId(productId)
}

/** Coordinates the one-time routes that continue product onboarding after creation. */
export function useProductCreatedGuide() {
  const { t: $t } = useI18n()
  const menu = useMenuStore()
  const open = ref(false)
  const state = ref<ProductCreatedGuideState>()
  const enabling = ref(false)
  const hasProduct = computed(() => Boolean(state.value?.id))

  function show(product: CreatedProduct, fallbackName = '') {
    const id = String(product.id || '')
    if (!id) return
    const next = { id, name: String(product.name || fallbackName), accessConfigured: false, metadataSaved: false, enabled: false }
    state.value = next
    writeGuide(next)
    setActiveProductId(id)
    open.value = true
  }

  function resume(productId: string) {
    if (open.value) return false
    const next = readGuide(productId)
    if (!next) return false
    state.value = next
    open.value = true
    return true
  }

  /** Restores only the latest deferred creation guide for this browser tab. */
  function resumePending() {
    const productId = readActiveProductId()
    return productId ? resume(productId) : false
  }

  function close() {
    open.value = false
  }

  function skip() {
    clearProductCreatedGuide(state.value?.id)
    close()
  }

  function buildDeviceListQuery(action: 'create' | 'import') {
    return {
      type: 'device', action, onboarding: 'product-created', productId: state.value?.id,
      q: encodeConditionFilterQuery([{ column: 'productId', termType: 'eq', value: state.value?.id }], getDeviceListFilterFields()),
    }
  }

  function configureAccess() {
    if (!hasProduct.value || !state.value) return
    close()
    menu.jumpPage('device/Product/Detail', { params: { id: state.value.id }, query: { guide: 'configure-access', onboarding: 'product-created' } })
  }

  function configureMetadata() {
    if (!state.value?.accessConfigured) return
    close()
    menu.jumpPage('device/Product/Detail', { params: { id: state.value.id }, query: { tab: 'Metadata', onboarding: 'product-created' } })
  }

  /** Enables the product inside the guide and unlocks the device handoff steps without a detail-page detour. */
  async function enableProduct() {
    if (!state.value?.accessConfigured || enabling.value) return false
    enabling.value = true
    try {
      const response: any = await _deploy(state.value.id)
      if (response?.status !== 200) {
        onlyMessage($t('Product.index.660348-19'), 'error')
        return false
      }
      const next = updateProductCreatedGuide(state.value.id, { enabled: true })
      if (next) state.value = next
      onlyMessage($t('Detail.index.478940-12'))
      return true
    } catch {
      onlyMessage($t('Product.index.660348-19'), 'error')
      return false
    } finally {
      enabling.value = false
    }
  }

  // Selecting either device entry hands off the onboarding task; success is not required to end the prompt.
  function addDevice() {
    if (!hasProduct.value) return
    const query = buildDeviceListQuery('create')
    clearProductCreatedGuide(state.value?.id)
    close()
    menu.jumpPage('iot-user-device-list', { query })
  }

  function batchImport() {
    if (!hasProduct.value) return
    const query = buildDeviceListQuery('import')
    clearProductCreatedGuide(state.value?.id)
    close()
    menu.jumpPage('iot-user-device-list', { query })
  }

  return { open, state, enabling, show, resume, resumePending, close, skip, configureAccess, configureMetadata, enableProduct, addDevice, batchImport }
}
