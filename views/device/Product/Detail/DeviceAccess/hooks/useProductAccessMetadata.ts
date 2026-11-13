import { onScopeDispose, reactive, ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks'
import { useProductStore } from '../../../../../../store/product'
import { device } from '../../../../../../assets'
import { saveProductAccess } from '../accessService'
import type { AccessSaveData } from '../accessState'

type MetadataMode = 'intersection' | 'union' | 'ignore' | 'cover'
type MetadataItem = { id: string; [key: string]: unknown }

/** 物模型处理只影响当前保存快照，不读取可能已经切换的网关或产品。 */
export function useProductAccessMetadata(props: { data: AccessSaveData }, emit: {
  (event: 'submit'): void
  (event: 'cancel'): void
}) {
  const { t: $t } = useI18n()
  const productStore = useProductStore()
  const formRef = ref<{ validate: () => Promise<unknown> }>()
  const handleData = reactive<{ type?: MetadataMode }>({ type: undefined })
  const loading = ref(false)
  let disposed = false
  const { onBack } = useTabSaveSuccessBack()
  const options = [
    {
      value: 'intersection',
      label: $t('DeviceAccess.metadataModal.306037-9'),
      subLabel: $t('DeviceAccess.metadataModal.306037-10'),
      iconUrl: device.intersection,
    },
    {
      value: 'union',
      label: $t('DeviceAccess.metadataModal.306037-11'),
      subLabel: $t('DeviceAccess.metadataModal.306037-12'),
      iconUrl: device.union,
    },
    {
      value: 'ignore',
      label: $t('DeviceAccess.metadataModal.306037-13'),
      subLabel: $t('DeviceAccess.metadataModal.306037-14'),
      iconUrl: device.ignore,
    },
    {
      value: 'cover',
      label: $t('DeviceAccess.metadataModal.306037-15'),
      subLabel: $t('DeviceAccess.metadataModal.306037-16'),
      iconUrl: device.cover,
    }
  ]

  /** 覆盖、交并集、忽略始终使用同一产品和同一网关的物模型。 */
  async function submitData() {
    if (loading.value) return
    loading.value = true
    const snapshot = cloneDeep(props.data)
    try {
      await formRef.value?.validate()
      if (disposed) return
      let metadata = JSON.parse(snapshot.product.metadata || '{}')
      if (handleData.type === 'cover') {
        metadata = snapshot.metadata
      } else if (handleData.type === 'intersection' || handleData.type === 'union') {
        for (const key of ['properties', 'functions', 'events', 'tags']) {
          const original: MetadataItem[] = metadata[key] || []
          const selected = (snapshot.metadata[key] || []) as MetadataItem[]
          metadata[key] = handleData.type === 'intersection'
            ? selected.filter(item => original.some(existing => existing.id === item.id))
            : [...new Map([...selected, ...original.filter(item => !selected.some(next => next.id === item.id))].map(item => [item.id, item])).values()]
        }
      }
      const response = await saveProductAccess(snapshot, JSON.stringify(metadata))
      if (!response.success || disposed || productStore.current.id !== snapshot.id) return
      onlyMessage($t('DeviceAccess.metadataModal.306037-17'))
      const isTabBack = await onBack(response, { onBefore: () => !!response.result })
      if (!isTabBack && !disposed && productStore.current.id === snapshot.id) {
        await productStore.getDetail(snapshot.id)
        if (!disposed && productStore.current.id === snapshot.id) emit('submit')
      }
    } finally {
      loading.value = false
    }
  }

  function cancel() { if (!loading.value) emit('cancel') }
  onScopeDispose(() => { disposed = true })
  return { formRef, handleData, loading, options, submitData, cancel }
}
