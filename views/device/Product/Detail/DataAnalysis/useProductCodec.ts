import { computed, ref, shallowRef, type InjectionKey } from 'vue'
import { getTransparentCodecSupports, productCode } from '../../../../../api/instance'

const SCRIPT_PROVIDER = 'jsr223'
const DEVICE_MODBUS_PROVIDER = 'modbus'
type CodecProvider = { id: string; name: string }
type CodecConfiguration = Record<string, unknown>

export type ProductCodecSupport = ReturnType<typeof createProductCodecSupport>
export const productCodecSupportKey: InjectionKey<ProductCodecSupport> = Symbol('productCodecSupport')

/** 详情入口与编辑器共享一次能力查询，避免设备侧 Modbus 成为产品级选项。 */
export function createProductCodecSupport() {
  const providers = shallowRef<CodecProvider[]>()
  let pending: Promise<CodecProvider[]> | undefined

  async function load(refresh = false) {
    if (pending) return pending
    if (!refresh && providers.value) return providers.value
    pending = getTransparentCodecSupports().then(res => {
      if ((!res.success && res.status !== 200) || !Array.isArray(res.result)) throw new Error('Failed to load product codec providers')
      const result = res.result.filter(option => typeof option?.id === 'string' && !!option.id.trim()
        && option.id.trim().toLowerCase() !== DEVICE_MODBUS_PROVIDER)
      providers.value = result
      return result
    }).finally(() => { pending = undefined })
    return pending
  }

  return { providers, load }
}

/** 已保存的解析器优先；未配置时仅从后端已注册的解析器初始化。 */
export function useProductCodec(productId: () => string | undefined, defaultScript: string, support = createProductCodecSupport()) {
  const editorValue = ref('')
  const codecLoading = ref(true)
  const codecFailed = ref(false)
  const codecProvider = ref('')
  const configuredProvider = ref('')
  const codecProviders = ref<CodecProvider[]>([])
  const loadedProductId = ref<string>()
  let configuration: CodecConfiguration = {}
  let requestSequence = 0

  const isScript = computed(() => codecProvider.value === SCRIPT_PROVIDER)
  const canUseCodec = computed(() => Boolean(!codecLoading.value && !codecFailed.value && loadedProductId.value && loadedProductId.value === productId()
    && codecProviders.value.some(({ id }) => id === codecProvider.value)))

  function loadEditor(provider: string, config: CodecConfiguration, isNew = false) {
    codecProvider.value = provider
    configuration = config
    editorValue.value = !provider ? '' : isScript.value
      ? (isNew ? defaultScript : typeof config.script === 'string' ? config.script : '')
      : JSON.stringify(config, null, 2)
  }

  function selectProvider(provider: string) {
    if (configuredProvider.value || codecLoading.value || codecFailed.value || loadedProductId.value !== productId()
      || provider === codecProvider.value || !codecProviders.value.some(({ id }) => id === provider)) return
    loadEditor(provider, {}, true)
  }

  function buildProductCode() {
    if (!canUseCodec.value) return
    if (isScript.value) {
      return {
        provider: codecProvider.value,
        configuration: { ...configuration, script: editorValue.value, lang: configuration.lang || 'javascript' },
      }
    }
    const parsed: unknown = JSON.parse(editorValue.value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid codec configuration')
    return { provider: codecProvider.value, configuration: parsed as CodecConfiguration }
  }

  async function getProductCode(refreshProviders = false) {
    const id = productId()
    const request = ++requestSequence
    const isCurrent = () => request === requestSequence && productId() === id
    if (loadedProductId.value !== id) {
      loadedProductId.value = undefined
      configuredProvider.value = ''
      codecProviders.value = []
      loadEditor('', {})
    }
    codecLoading.value = Boolean(id)
    codecFailed.value = false
    if (!id) return
    try {
      const [codec, providers] = await Promise.all([productCode(id), support.load(refreshProviders)])
      if (!isCurrent()) return
      if (!codec.success && codec.status !== 200) throw new Error('Failed to load product codec')
      codecProviders.value = providers
      configuredProvider.value = typeof codec.result?.provider === 'string' ? codec.result.provider.trim() : ''
      if (configuredProvider.value.toLowerCase() === DEVICE_MODBUS_PROVIDER) {
        // 不加载产品侧遗留的 Modbus 配置，也不能用其他配置覆盖这条记录。
        loadEditor('', {})
      } else if (configuredProvider.value) {
        loadEditor(configuredProvider.value, codec.result?.configuration ?? {})
      } else if (codec.result == null) {
        // 仅在确实未配置且后端注册了 JS 时，保留原有的新建脚本入口。
        const provider = codecProviders.value.some(({ id }) => id === SCRIPT_PROVIDER)
          ? SCRIPT_PROVIDER : codecProviders.value[0]?.id || ''
        loadEditor(provider, {}, true)
      } else {
        loadEditor('', {})
      }
      loadedProductId.value = id
    } catch {
      if (!isCurrent()) return
      codecFailed.value = true
      codecProviders.value = []
      configuredProvider.value = ''
      loadedProductId.value = undefined
      loadEditor('', {})
    } finally {
      if (isCurrent()) codecLoading.value = false
    }
  }

  return { editorValue, codecLoading, codecFailed, codecProvider, configuredProvider, codecProviders, isScript, canUseCodec, getProductCode, buildProductCode, selectProvider }
}
