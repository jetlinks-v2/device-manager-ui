import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadFileByUrl, onlyMessage } from '@jetlinks-web/utils'
import { downloadJson } from '@jetlinks-web-core/utils'
import { omit } from 'lodash-es'
import { exportProductResourcePackage } from '../../../../api/product'

export type ProductTransferType = 'basic' | 'resource'

export type ProductTransferRecord = {
  id?: string
  name?: string
  [key: string]: unknown
}

/** 管理产品导入导出弹窗状态，并执行与现有格式兼容的 JSON / ZIP 传输命令。 */
export const useProductTransfer = () => {
  const { t: $t } = useI18n()
  const exportVisible = ref(false)
  const exporting = ref(false)
  const exportRecord = ref<ProductTransferRecord>()

  const openExport = (record: ProductTransferRecord) => {
    exportRecord.value = record
    exportVisible.value = true
  }

  const exportBasicProduct = (record: ProductTransferRecord) => {
    const data = omit(record, [
      'transportProtocol',
      'protocolName',
      'accessId',
      'accessName',
      'accessProvider',
      'messageProtocol',
    ])
    downloadJson(data, `${record.name || record.id || ''}${$t('Product.index.660348-15')}`)
  }

  /** 保持 JSON 基础信息导出和 ZIP 资源包导出的现有后端契约。 */
  const exportProduct = async (type: ProductTransferType) => {
    const record = exportRecord.value
    if (!record) return

    exporting.value = true
    try {
      if (type === 'basic') {
        exportBasicProduct(record)
      } else if (record.id) {
        const response: any = await exportProductResourcePackage(record.id)
        const blob = response?.data || response
        const url = URL.createObjectURL(blob)
        downloadFileByUrl(url, record.name || record.id, 'zip')
        URL.revokeObjectURL(url)
      }
      exportVisible.value = false
    } catch (error: any) {
      onlyMessage(error?.response?.data?.message || error?.message || $t('Product.resourcePackage.001-36'), 'error')
    } finally {
      exporting.value = false
    }
  }

  return {
    exportVisible,
    exporting,
    openExport,
    exportProduct,
  }
}
