import { computed, ref } from 'vue'
import { productCode } from '../../../../../api/instance'

interface ProductCodec {
  provider?: string
  configuration?: { script?: string; lang?: string; [key: string]: unknown }
}

/** 按实际解析器读取与构建配置；项目和后台共用编辑逻辑。 */
export function useProductCodec(productId: () => string | undefined, defaultScript: string) {
  const editorValue = ref('')
  const codec = ref<ProductCodec>()
  const codecLoading = ref(false)
  const codecFailed = ref(false)
  const editorLanguage = computed(() => codec.value && typeof codec.value.configuration?.script !== 'string' ? 'json' : 'javascript')

  function buildProductCode(): ProductCodec {
    if (editorLanguage.value === 'json') {
      const configuration: unknown = JSON.parse(editorValue.value)
      if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) throw new Error('Invalid codec configuration')
      return { provider: codec.value?.provider, configuration: configuration as ProductCodec['configuration'] }
    }
    return {
      provider: codec.value?.provider || 'jsr223',
      configuration: { ...codec.value?.configuration, script: editorValue.value, lang: codec.value?.configuration?.lang || 'javascript' },
    }
  }

  async function getProductCode() {
    const id = productId()
    if (!id) return
    codecLoading.value = true
    codecFailed.value = false
    try {
      const res = await productCode(id)
      if (!res.success && res.status !== 200) throw new Error('Failed to load product codec')
      codec.value = res.result as ProductCodec | undefined
      editorValue.value = codec.value ? typeof codec.value.configuration?.script === 'string'
        ? codec.value.configuration.script : JSON.stringify(codec.value.configuration ?? {}, null, 2) : defaultScript
    } catch {
      codecFailed.value = true
      codec.value = undefined
      editorValue.value = ''
    } finally {
      codecLoading.value = false
    }
  }

  return { codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode, buildProductCode }
}
