import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { useProductStore } from '@device-manager-ui/store/product'
import { useInstanceStore } from '@device-manager-ui/store/instance'
import { queryProductMetadata } from '../../alarm/api'
import { parseMetadata, propertyIdOf } from '../../alarm/utils'
import type { ThingModelProperty } from '../../alarm/types'

export function useMetadataRuleShortcut(props: { property: ThingModelProperty; target?: string }) {
  const { t } = useI18n()
  const product = useProductStore()
  const device = useInstanceStore()
  const open = ref(false)
  const loading = ref(false)
  const scope = computed(() => props.target === 'product'
    ? { productId: String(product.current.id ?? ''), name: product.current.name }
    : { productId: String(device.current.productId ?? ''), deviceId: device.current.id, name: device.current.name })
  async function show() {
    if (loading.value) return
    loading.value = true
    try {
      const metadata = await queryProductMetadata(scope.value.productId)
      const properties = [...parseMetadata(metadata).properties,
        ...(scope.value.deviceId ? parseMetadata(device.current.metadata).properties : [])]
      if (!properties.some((item) => propertyIdOf(item) === propertyIdOf(props.property))) {
        message.warning(t('PropertyRules.saveMetadataFirst'))
        return
      }
      open.value = true
    } catch { message.error(t('PropertyRules.loadFailed')) }
    finally { loading.value = false }
  }
  return { open, loading, scope, show }
}
