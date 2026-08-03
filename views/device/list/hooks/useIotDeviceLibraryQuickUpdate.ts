import { computed, reactive, ref } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  queryDeviceProducts_api,
  type DeviceTemplateProductInput,
  type IotDeviceProductTemplate,
} from '@device-manager-ui/api/device'
import {
  queryDeviceLibraryProductFilterOptions_api,
  queryDeviceLibraryTemplateById_api,
} from '@device-manager-ui/api/device-library'
import { useIotDeviceLibraryProductSync, type LibraryProductSyncState } from './useIotDeviceLibraryProductSync'
import type { IotDevice } from '../types'

type QuickUpdateState = Pick<LibraryProductSyncState, 'checking' | 'updateDisabled'> & {
  checked: boolean
  disabledReason: string
}

const emptyState = (): QuickUpdateState => ({
  checked: false,
  checking: false,
  updateDisabled: false,
  disabledReason: '',
})

export function useIotDeviceLibraryQuickUpdate(projectId: () => string, refreshTable: () => void) {
  const { t: $t } = useI18n()
  const selectedTemplateKey = ref('')
  const selectedProductKey = ref('')
  const projectProducts = ref<IotDeviceProductTemplate[]>([])
  const templateProducts = ref<DeviceTemplateProductInput[]>([])
  const states = reactive<Record<string, QuickUpdateState>>({})
  const activeDevice = ref<IotDevice | null>(null)
  const updatingProductId = ref('')

  const productSync = useIotDeviceLibraryProductSync({
    projectId,
    projectProducts,
    templateProducts,
    selectedTemplateKey,
    selectedProductKey,
    loadProducts,
    t: $t,
  })

  const runningProductId = computed(() =>
    updatingProductId.value || (productSync.state.value.checking ? selectedProductKey.value : ''),
  )

  function stateKeyOf(device: IotDevice) {
    return device.productId || device.productKey || device.id
  }

  function stateOf(device: IotDevice) {
    const key = stateKeyOf(device)
    states[key] ??= emptyState()
    if (!resolveDeviceProductId(device)) {
      return {
        ...states[key],
        checked: true,
        updateDisabled: true,
        disabledReason: $t('IotDeviceList.message.updateProductNoLibrary'),
      }
    }
    return states[key]
  }

  function productUpdateTooltipOf(device: IotDevice) {
    const state = stateOf(device)
    return state.updateDisabled ? { title: state.disabledReason } : undefined
  }

  function canUpdateProduct(device: IotDevice) {
    return !stateOf(device).updateDisabled
  }

  async function loadProducts() {
    const device = activeDevice.value
    if (!device) return
    const products = await queryDeviceProducts_api(projectId(), device.deviceTypeValue || device.deviceType)
    projectProducts.value = products
  }

  async function resolveDeviceLibraryTemplateId(device: IotDevice) {
    const productId = resolveDeviceProductId(device)
    if (!productId) return ''
    const installed = await queryDeviceLibraryProductFilterOptions_api(projectId())
    const matched = installed.find((item) => item.productId === productId)
    if (matched?.templateId) return matched.templateId
    return device.productKey && device.productKey !== productId ? device.productKey : ''
  }

  function resolveDeviceProductId(device: IotDevice) {
    return device.productId || device.productKey || ''
  }

  async function prepareDeviceProductUpdate(device: IotDevice, force = false, notifyError = false) {
    const key = stateKeyOf(device)
    const productId = resolveDeviceProductId(device)
    if (!productId) {
      states[key] = {
        checked: true,
        checking: false,
        updateDisabled: true,
        disabledReason: $t('IotDeviceList.message.updateProductNoLibrary'),
      }
      return states[key]
    }
    if (!force && states[key]?.checked) return states[key]

    activeDevice.value = device
    selectedProductKey.value = productId
    states[key] = { ...emptyState(), checking: true }
    try {
      // 列表设备只稳定带产品 ID，需要从项目安装记录反查设备库模板 ID。
      const templateId = await resolveDeviceLibraryTemplateId(device)
      selectedTemplateKey.value = templateId
      const template = templateId ? await queryDeviceLibraryTemplateById_api(templateId) : null
      if (!template) {
        states[key] = {
          checked: true,
          checking: false,
          updateDisabled: true,
          disabledReason: $t('IotDeviceList.message.updateProductTemplateMissing'),
        }
        return states[key]
      }
      templateProducts.value = [{ ...template, installed: true, installedProductId: productId }]
      productSync.reset()
      await productSync.prepare()
      const disabledReason = productSync.state.value.updateDisabled
        ? $t('IotDeviceList.message.updateProductHasDevices')
        : ''
      states[key] = {
        checked: true,
        checking: false,
        updateDisabled: productSync.state.value.updateDisabled,
        disabledReason,
      }
      return states[key]
    } catch (error) {
      const message = error instanceof Error ? error.message : $t('IotDeviceList.message.updateProductCheckFailed')
      // 接口超时等临时检查失败不写入禁用态，避免按钮被永久置灰；用户点击时用 toast 承接并允许重试。
      states[key] = emptyState()
      if (notifyError) onlyMessage(message, 'error')
      return { ...emptyState(), updateDisabled: true }
    } finally {
      productSync.finishChecking()
    }
  }

  async function updateDeviceProduct(device: IotDevice) {
    const state = await prepareDeviceProductUpdate(device, true, true)
    if (state.updateDisabled) {
      if (state.disabledReason) onlyMessage(state.disabledReason, 'warning')
      return
    }

    Modal.confirm({
      title: $t('IotDeviceList.confirm.updateProductTitle'),
      content: $t('IotDeviceList.confirm.updateProductContent', {
        product: device.productName || device.productId || '--',
      }),
      okText: $t('IotDeviceList.action.updateProduct'),
      cancelText: $t('IotDeviceList.action.cancel'),
      onOk: async () => {
        updatingProductId.value = resolveDeviceProductId(device) || device.id
        try {
          await productSync.syncSelectedProduct()
          states[stateKeyOf(device)] = emptyState()
          onlyMessage($t('IotDeviceList.message.updateProductSuccess', { product: device.productName || '--' }))
          refreshTable()
        } catch (error) {
          onlyMessage(error instanceof Error ? error.message : $t('IotDeviceList.message.updateProductFailed'), 'error')
        } finally {
          updatingProductId.value = ''
        }
      },
    })
  }

  return {
    runningProductId,
    stateOf,
    canUpdateProduct,
    productUpdateTooltipOf,
    updateDeviceProduct,
  }
}
