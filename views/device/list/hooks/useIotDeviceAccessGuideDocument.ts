import { ref } from 'vue'
import { marked } from 'marked'

import { queryDeviceProductDocuments_api, readDeviceDocumentFileText_api } from '../../../../api/device'
import type { IotDevice } from '../types'

export type IotDeviceAccessGuideDocumentProps = {
  device: IotDevice
}

export function useIotDeviceAccessGuideDocument(props: Readonly<IotDeviceAccessGuideDocumentProps>) {
  const accessGuideDocument = ref('')
  const accessGuideLoading = ref(false)
  const accessGuideLoadFailed = ref(false)
  let accessGuideRequestId = 0

  async function loadAccessGuideDocument() {
    const productId = props.device.productId || props.device.productKey
    const requestId = accessGuideRequestId + 1
    accessGuideRequestId = requestId
    accessGuideDocument.value = ''
    accessGuideLoadFailed.value = false
    if (!productId) {
      accessGuideLoading.value = false
      return
    }

    accessGuideLoading.value = true
    try {
      const documents = await queryDeviceProductDocuments_api(productId, 'access-guide')
      const document = documents.find((item) => item.fileId)
      if (!document?.fileId) return

      const content = await readDeviceDocumentFileText_api(document.fileId)
      // 设备切换时旧请求可能后返回，只允许最后一次请求写入右侧指南。
      if (requestId !== accessGuideRequestId) return
      accessGuideDocument.value = content ? marked.parse(content) as string : ''
    } catch {
      if (requestId === accessGuideRequestId) accessGuideLoadFailed.value = true
    } finally {
      if (requestId === accessGuideRequestId) accessGuideLoading.value = false
    }
  }

  function resetAccessGuideDocument() {
    accessGuideRequestId += 1
    accessGuideDocument.value = ''
    accessGuideLoadFailed.value = false
    accessGuideLoading.value = false
  }

  return {
    accessGuideDocument,
    accessGuideLoadFailed,
    accessGuideLoading,
    loadAccessGuideDocument,
    resetAccessGuideDocument,
  }
}
