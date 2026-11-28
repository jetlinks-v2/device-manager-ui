import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { savePluginData } from '../../../../../../../api/link/plugin'

interface MappingModalProps {
  id?: string
  accessId?: string
  internalId?: string
}

/** 映射写入固定的设备和接入方式；保留旧详情路由的参数兼容。 */
export function useDeviceIdMappingModal(props: MappingModalProps, submit: (externalId: string) => void) {
  const route = useRoute()
  const { t } = useI18n()
  const internalId = computed(() => props.internalId ?? String(route.params.id ?? route.params.deviceId ?? ''))
  const checkKey = ref(props.id)
  const loading = ref(false)
  let disposed = false
  const targetKey = () => JSON.stringify([props.accessId, internalId.value])
  watch(() => [props.id, targetKey()], () => { checkKey.value = props.id })
  onScopeDispose(() => { disposed = true })

  async function handleOk() {
    if (loading.value || disposed || !props.accessId || !internalId.value) return
    if (!checkKey.value) {
      onlyMessage(t('InklingModal.index.380043-1'), 'error')
      return
    }
    const key = targetKey()
    const externalId = checkKey.value
    loading.value = true
    try {
      const res = await savePluginData('device', props.accessId, internalId.value, externalId).catch(() => ({ success: false }))
      if (res.success && !disposed && key === targetKey()) submit(externalId)
    } finally {
      loading.value = false
    }
  }

  return { internalId, checkKey, loading, handleOk }
}
