import { watch } from 'vue'
import { detail as queryProductDetail } from '../../../../../api/product'

type DeviceImportProduct = { id?: string }

/** Restores a guided product and, when requested, advances after its selected state is perceptible. */
export function useInitialDeviceImportProduct(
  initialProductId: () => string,
  selectProduct: (product: DeviceImportProduct) => void,
  advance?: () => void,
) {
  let requestVersion = 0

  async function load(productId: string) {
    if (!productId) return
    const currentRequestVersion = ++requestVersion
    // 先展示产品选择页，再高亮引导产品，避免列表和导入弹窗连续跳转造成突兀感。
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250))
    const response = await queryProductDetail(productId).catch(() => undefined)
    if (currentRequestVersion !== requestVersion || productId !== initialProductId()) {
      return
    }
    const product = response?.result as DeviceImportProduct | undefined
    if (!product?.id) {
      return
    }
    selectProduct(product)
    if (advance) {
      // 保留产品已选中的可见停顿，再进入导入方式或文件配置步骤。
      await new Promise<void>((resolve) => window.setTimeout(resolve, 450))
      if (currentRequestVersion !== requestVersion || productId !== initialProductId()) {
        return
      }
      advance()
    }
  }

  // 产品 ID 由列表跳转异步注入；立即监听可同时覆盖首屏和后续更新，避免错过自动推进。
  watch(initialProductId, (productId) => {
    void load(productId)
  }, { immediate: true })
}
