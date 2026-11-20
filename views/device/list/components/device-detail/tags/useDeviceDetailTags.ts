import { computed, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { mapApiDevice } from '../../../services/adapters/iotDeviceApiAdapter'
import { iotDeviceDetailRealApi } from '../../../services/iotDeviceDetailReal.service'
import { findStoredTag, formatTagValue, getTagKey, hasTagValue, mergeTagDefinitions, type DeviceTag } from './tagEditor'

export interface DeviceDetailTagsProps {
  deviceId: string
  deviceDetail?: Record<string, any>
  canUpdate: boolean
}

/** 为独立详情摘要提供标签能力，不加载详情页的其他数据或订阅。 */
export function useDeviceDetailTags(
  props: DeviceDetailTagsProps,
  onSaved: (deviceId: string, detail: Record<string, any>) => void,
) {
  const { t: $t } = useI18n()
  const savingTags = ref(false)
  const tagsListRef = ref<HTMLElement | null>(null)
  const tagsExpanded = ref(false)
  const tagsOverflow = ref(false)
  let disposed = false
  let version = 0
  let observer: ResizeObserver | undefined
  const device = computed(() => props.deviceDetail?.id === props.deviceId
    ? mapApiDevice(props.deviceDetail, '') : null)
  const storedTags = computed<DeviceTag[]>(() => device.value?.thingModelTags || [])
  const thingModelTags = computed(() => mergeTagDefinitions(device.value?.thingModelMetadata?.tags || [], storedTags.value))
  const canDeviceAction = (_action: 'update') => props.canUpdate && !!device.value

  function formatTagTooltipValueOnly(tag: DeviceTag): string {
    const value = formatTagValue(tag)
    if (!hasTagValue(value)) return $t('IotDeviceDetail.detail.unset')
    return typeof value === 'object' ? JSON.stringify(value) : String(value)
  }

  async function saveTags(tags: DeviceTag[]): Promise<boolean> {
    if (!props.deviceId || savingTags.value || !canDeviceAction('update')) return false
    const deviceId = props.deviceId
    const savedVersion = version
    const current = () => !disposed && savedVersion === version && deviceId === props.deviceId
    const toSave = tags.filter(tag => getTagKey(tag) && hasTagValue(tag.value))
    const toDelete = tags.filter(tag => getTagKey(tag) && !hasTagValue(tag.value))
      .map(tag => findStoredTag(storedTags.value, tag)).filter((tag): tag is DeviceTag => !!tag)
    savingTags.value = true
    try {
      if (toSave.length) {
        const response = await iotDeviceDetailRealApi.saveTags(deviceId, toSave)
        if (response.status !== 200) throw new Error('Tag save failed')
      }
      for (const tag of toDelete) {
        if (!current()) return false
        const response = await iotDeviceDetailRealApi.deleteTag(deviceId, String(tag.id))
        if (response.status !== 200) throw new Error('Tag removal failed')
      }
      if (!current()) return false
      if (toSave.length || toDelete.length) {
        const response = await iotDeviceDetailRealApi.getDeviceDetail(deviceId)
        if (!current()) return false
        if (response.status !== 200 || response.result?.id !== deviceId) throw new Error('Tag refresh failed')
        onSaved(deviceId, response.result)
        onlyMessage($t('IotDeviceDetail.detail.saveSuccess'))
      }
      return current()
    } finally {
      if (current()) savingTags.value = false
    }
  }

  function canRemoveTag(tag: DeviceTag): boolean {
    return canDeviceAction('update') && !!findStoredTag(storedTags.value, tag)
  }

  function removeTag(tag: DeviceTag): Promise<boolean> {
    const stored = findStoredTag(storedTags.value, tag)
    return stored ? saveTags([{ ...stored, value: '' }]) : Promise.resolve(false)
  }

  function updateOverflow() {
    void nextTick(() => {
      if (disposed) return
      tagsOverflow.value = !!tagsListRef.value && tagsListRef.value.scrollHeight > 26
      if (!tagsOverflow.value) tagsExpanded.value = false
    })
  }

  watch(() => props.deviceId, () => {
    version++
    savingTags.value = false
    tagsExpanded.value = false
  }, { flush: 'sync' })
  watch(thingModelTags, updateOverflow, { deep: true, immediate: true })
  watch(tagsListRef, element => {
    observer?.disconnect()
    if (element && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOverflow)
      observer.observe(element)
    }
    updateOverflow()
  }, { flush: 'post' })
  onScopeDispose(() => { disposed = true; observer?.disconnect() })

  return reactive({
    $t, thingModelTags, tagsListRef, tagsExpanded, tagsOverflow, savingTags,
    canDeviceAction, canRemoveTag, removeTag, saveTags, formatTagTooltipValueOnly,
    toggleTagsExpanded: () => { tagsExpanded.value = !tagsExpanded.value },
  })
}
