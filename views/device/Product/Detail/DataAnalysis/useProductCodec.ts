import { computed, ref } from 'vue'
import { productCode } from '../../../../../api/instance'
import { isSaaS } from '@jetlinks-web-core/utils/consts'

interface ProductCodec {
  provider?: string
  configuration?: { script?: string; lang?: string; [key: string]: unknown }
}

/** 读取设备库安装的实际解析配置；只读产品不填充可编辑脚本模板。 */
export function useProductCodec(productId: () => string | undefined, defaultScript: string) {
  const editorValue = ref('')
  const codec = ref<ProductCodec>()
  const codecLoading = ref(false)
  const codecFailed = ref(false)
  const editorLanguage = computed(() => isSaaS && codec.value && typeof codec.value.configuration?.script !== 'string' ? 'json' : 'javascript')

  async function getProductCode() {
    const id = productId()
    if (!id) return
    codecLoading.value = true
    codecFailed.value = false
    try {
      const res = await productCode(id)
      if (!res.success && res.status !== 200) throw new Error('Failed to load product codec')
      codec.value = res.result as ProductCodec | undefined
      editorValue.value = isSaaS
        ? codec.value ? typeof codec.value.configuration?.script === 'string'
          ? codec.value.configuration.script : JSON.stringify(codec.value.configuration ?? {}, null, 2) : ''
        : codec.value ? codec.value.configuration?.script ?? '' : defaultScript
    } catch {
      codecFailed.value = true
      codec.value = undefined
      editorValue.value = ''
    } finally {
      codecLoading.value = false
    }
  }

  return { codec, editorValue, editorLanguage, codecLoading, codecFailed, getProductCode }
}
