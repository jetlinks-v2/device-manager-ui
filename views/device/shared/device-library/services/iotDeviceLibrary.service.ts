import type { Ref } from 'vue'
import { readonly, ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'

import type { ServiceError } from '@jetlinks-web-core/utils/service-result'

import { createIotDeviceLibraryMockAdapter } from './adapters/iotDeviceLibraryMockAdapter'
import type {
  IotDeviceLibraryAdapter,
  IotDeviceLibraryJoinInput,
  IotDeviceLibraryListResult,
  IotDeviceLibraryQuery,
  IotDeviceLibraryTemplateDetail,
} from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'
import type { Iot2TemplateParameterValues } from '@device-manager-ui/views/device/shared/device-library/services/iot2.types'

export function createIotDeviceLibraryService(adapter: IotDeviceLibraryAdapter) {
  const listResult = ref<IotDeviceLibraryListResult | null>(null)
  const currentTemplate = ref<IotDeviceLibraryTemplateDetail | null>(null)
  const loading = ref(false)
  const detailLoading = ref(false)
  const joining = ref(false)
  const error = ref<ServiceError | null>(null)

  async function listTemplates(query: IotDeviceLibraryQuery) {
    loading.value = !listResult.value
    const result = await adapter.listTemplates(query)
    loading.value = false
    if (result.ok) {
      listResult.value = result.data
      error.value = null
    } else {
      error.value = result.error
    }
    return result
  }

  async function getTemplate(projectId: string, templateId: string) {
    detailLoading.value = true
    const result = await adapter.getTemplate(projectId, templateId)
    detailLoading.value = false
    if (result.ok) {
      currentTemplate.value = result.data
      error.value = null
    } else {
      error.value = result.error
    }
    return result
  }

  async function joinProject(input: IotDeviceLibraryJoinInput) {
    joining.value = true
    const result = await adapter.joinProject(input)
    joining.value = false
    if (!result.ok) {
      error.value = result.error
      return result
    }
    if (currentTemplate.value?.template.id === input.templateId) {
      currentTemplate.value = {
        ...currentTemplate.value,
        joined: true,
        joinedProductName: result.data.product.productName,
        productCountHint: i18n.global.t('IotDeviceLibrary.productCreatedHint'),
      }
    }
    if (listResult.value) {
      listResult.value = {
        ...listResult.value,
        items: listResult.value.items.map((item) => item.id === input.templateId
          ? { ...item, joined: true, joinedProductName: result.data.product.productName }
          : item),
      }
    }
    error.value = null
    return result
  }

  async function listParameterOptions(
    projectId: string,
    templateId: string,
    fieldKey: string,
    values: Iot2TemplateParameterValues,
  ) {
    return adapter.listParameterOptions(projectId, templateId, fieldKey, values)
  }

  function subscribeListResult() {
    return readonly(listResult) as Readonly<Ref<IotDeviceLibraryListResult | null>>
  }

  function subscribeCurrentTemplate() {
    return readonly(currentTemplate) as Readonly<Ref<IotDeviceLibraryTemplateDetail | null>>
  }

  function subscribeLoading() {
    return readonly(loading) as Readonly<Ref<boolean>>
  }

  function subscribeDetailLoading() {
    return readonly(detailLoading) as Readonly<Ref<boolean>>
  }

  function subscribeJoining() {
    return readonly(joining) as Readonly<Ref<boolean>>
  }

  function subscribeError() {
    return readonly(error) as Readonly<Ref<ServiceError | null>>
  }

  return {
    listTemplates,
    getTemplate,
    joinProject,
    listParameterOptions,
    subscribeListResult,
    subscribeCurrentTemplate,
    subscribeLoading,
    subscribeDetailLoading,
    subscribeJoining,
    subscribeError,
  }
}

export const iotDeviceLibraryService = createIotDeviceLibraryService(createIotDeviceLibraryMockAdapter())
