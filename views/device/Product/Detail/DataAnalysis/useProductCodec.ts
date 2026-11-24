import { ref } from 'vue'
import { productCode } from '../../../../../api/instance'

/** 产品统一编辑和保存 JavaScript；没有脚本时使用默认模板。 */
export function useProductCodec(productId: () => string | undefined, defaultScript: string) {
  const editorValue = ref('')
  const codecLoading = ref(false)
  const codecFailed = ref(false)

  function buildProductCode() {
    return {
      provider: 'jsr223',
      configuration: { script: editorValue.value, lang: 'javascript' },
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
      const script = res.result?.configuration?.script
      editorValue.value = typeof script === 'string' ? script : defaultScript
    } catch {
      codecFailed.value = true
      editorValue.value = ''
    } finally {
      codecLoading.value = false
    }
  }

  return { editorValue, codecLoading, codecFailed, getProductCode, buildProductCode }
}
