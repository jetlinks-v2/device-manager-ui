import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProtocolProviders } from '../../../api/link/protocol'
import {
  DEFAULT_PROTOCOL_TYPES,
  normalizeSupportedProtocolTypes,
  parseProtocolProvidersResponse,
  type ProtocolTypeId,
} from './protocolTypes'
/** 列表页与 Save 弹窗共用，避免重复请求与状态不一致 */
const supportedTypes = ref<ProtocolTypeId[]>([...DEFAULT_PROTOCOL_TYPES])
const loaded = ref(false)
let loadPromise: Promise<void> | null = null

async function loadProtocolProviders() {
  if (loadPromise) {
    await loadPromise
    return
  }
  loadPromise = (async () => {
    try {
      const res: any = await getProtocolProviders()
      if (res?.success === false) return
      const parsed = normalizeSupportedProtocolTypes(parseProtocolProvidersResponse(res))
      if (parsed.length) {
        supportedTypes.value = parsed
      }
    } catch {
      // 保持默认三种
    } finally {
      loaded.value = true
    }
  })()
  await loadPromise
}

export function useProtocolTypeProviders() {
  const { t } = useI18n()

  const typeLabel = (id: string | undefined) => {
    if (!id) return ''
    const key = `Protocol.type.${id}`
    const tr = t(key)
    return tr !== key ? tr : id
  }

  const typeHint = (id: string | undefined) => {
    if (!id) return ''
    const key = `Protocol.type.hint.${id}`
    const tr = t(key)
    return tr !== key ? tr : ''
  }

  const typeFilterOptions = computed(() =>
    supportedTypes.value.map((value) => ({
      label: typeLabel(value),
      value,
    })),
  )

  const typeSelectOptions = computed(() =>
    supportedTypes.value.map((value) => ({
      label: typeLabel(value),
      value,
    })),
  )

  onMounted(() => {
    loadProtocolProviders()
  })

  /** 若当前 type 不在支持列表中，返回第一个可用类型（用于新建默认） */
  function coerceType(current: string | undefined): ProtocolTypeId {
    const list = supportedTypes.value
    if (current && list.includes(current as ProtocolTypeId)) {
      return current as ProtocolTypeId
    }
    return list[0] ?? 'jar'
  }

  return {
    supportedTypes,
    loaded,
    typeLabel,
    typeHint,
    typeFilterOptions,
    typeSelectOptions,
    coerceType,
    load: loadProtocolProviders,
  }
}
