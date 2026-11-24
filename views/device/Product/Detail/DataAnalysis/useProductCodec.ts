import { computed, ref } from 'vue'
import { productCode } from '../../../../../api/instance'

interface ProductCodec {
  provider?: string
  configuration?: { script?: string; lang?: string; [key: string]: unknown }
}

/** 产品仅编辑 JavaScript；已有非脚本配置保留原数据并阻止覆盖。 */
export function useProductCodec(productId: () => string | undefined, defaultScript: string) {
  const editorValue = ref('')
  const codec = ref<ProductCodec>()
  const codecLoading = ref(false)
  const codecFailed = ref(false)
  const codecUnsupported = computed(() => Boolean(codec.value?.provider && codec.value.provider !== 'jsr223'))

  function buildProductCode(): ProductCodec {
    if (codecUnsupported.value) throw new Error('Product only supports JavaScript')
    return {
      provider: 'jsr223',
      configuration: { ...codec.value?.configuration, script: editorValue.value, lang: 'javascript' },
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
      editorValue.value = codecUnsupported.value ? '' : codec.value?.configuration?.script ?? defaultScript
    } catch {
      codecFailed.value = true
      codec.value = undefined
      editorValue.value = ''
    } finally {
      codecLoading.value = false
    }
  }

  return { codec, editorValue, codecUnsupported, codecLoading, codecFailed, getProductCode, buildProductCode }
}
