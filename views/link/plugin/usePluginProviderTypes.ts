import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProviders as getPluginProviders } from '../../../api/link/plugin'
import {
  DEFAULT_PLUGIN_PROVIDERS,
  normalizeSupportedPluginProviders,
  parsePluginProvidersResponse,
  type PluginProviderId,
} from './pluginProviders'

/** 列表页与 Save 弹窗共用，避免重复请求与状态不一致 */
const supportedProviders = ref<PluginProviderId[]>([...DEFAULT_PLUGIN_PROVIDERS])
const loaded = ref(false)
let loadPromise: Promise<void> | null = null

async function loadPluginProviders() {
  if (loadPromise) {
    await loadPromise
    return
  }
  loadPromise = (async () => {
    try {
      const res: any = await getPluginProviders()
      if (res?.success === false) return
      const parsed = normalizeSupportedPluginProviders(parsePluginProvidersResponse(res))
      if (parsed.length) {
        supportedProviders.value = parsed
      }
    } catch {
      // 保持默认两种
    } finally {
      loaded.value = true
    }
  })()
  await loadPromise
}

export function usePluginProviderTypes() {
  const { t } = useI18n()

  const providerLabel = (id: string | undefined) => {
    if (!id) return ''
    const key = `plugin.provider.${id}`
    const tr = t(key)
    return tr !== key ? tr : id
  }

  const providerHint = (id: string | undefined) => {
    if (!id) return ''
    const key = `plugin.provider.hint.${id}`
    const tr = t(key)
    return tr !== key ? tr : ''
  }

  const providerOptions = computed(() =>
    supportedProviders.value.map((value) => ({
      label: providerLabel(value),
      value,
    })),
  )

  onMounted(() => {
    loadPluginProviders()
  })

  /** 若当前 provider 不在支持列表中，返回第一个可用 provider（用于新建默认） */
  function coerceProvider(current: string | undefined): PluginProviderId {
    const list = supportedProviders.value
    if (current && list.includes(current as PluginProviderId)) {
      return current as PluginProviderId
    }
    return list[0] ?? 'jar'
  }

  return {
    supportedProviders,
    loaded,
    providerLabel,
    providerHint,
    providerOptions,
    coerceProvider,
    load: loadPluginProviders,
  }
}
