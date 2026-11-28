import { onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { updateI18nText } from '@jetlinks-web-core/components/I18n'
import { getDeviceDetail_api } from '../../api/device'
import { updateDeviceHeader_api } from '../../api/deviceHeader'
import { queryDeviceBoundGroups_api, queryDeviceGroupDetailList_api } from '../../api/deviceGroup'
import { existsDeviceSpaceAreaSupport_api, queryDeviceSpaceAreaBindings_api, queryProjectSpaceAreaSettings_api } from '../../api/spaceArea'
import { saveIotDeviceAreaGroupBindings } from '../../views/device/list/hooks/iotDeviceAreaGroupBindings'
import { buildAreaTreeData, mergeDeviceBoundAreas } from '../../views/device/list/hooks/iotAreaTreeOptions'
import { buildDeviceGroupTreeData } from '../../views/device/list/hooks/iotDeviceGroupTreeOptions'
import type { IotDevice } from '../../views/device/list/types'
import type { DeviceScopeKind, DeviceScopeOption } from '../deviceScopeTypes'

export function useDeviceHeaderEditing(props: {
  deviceId: string; projectId?: string; allowed: boolean; refresh: (id: string) => void | Promise<void>
}) {
  const { t, locale } = useI18n()
  const loading = ref(false), busy = ref(false), failure = ref(''), loadError = ref('')
  const detail = ref<IotDevice>(), options = ref<DeviceScopeOption[]>([])
  let version = 0, disposed = false
  const active = (id: string, epoch: number) => !disposed && id === props.deviceId && epoch === version
  watch(() => [props.deviceId, props.projectId], () => { version++; detail.value = undefined; options.value = []; loading.value = false; busy.value = false; failure.value = ''; loadError.value = '' }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; version++ })
  const message = (error: unknown) => error instanceof Error ? error.message : t('IotDeviceDetail.detail.saveFailed')

  async function commit(write: (id: string, current: () => boolean) => Promise<void>) {
    if (!props.allowed || busy.value || disposed) throw new Error(t('IotDeviceDetail.detail.saveFailed'))
    const id = props.deviceId, epoch = version
    busy.value = true; failure.value = ''
    try {
      await write(id, () => active(id, epoch) && props.allowed)
      if (active(id, epoch)) await props.refresh(id)
    } catch (error) {
      if (active(id, epoch)) failure.value = message(error)
      throw error
    } finally { if (active(id, epoch)) busy.value = false }
  }

  async function saveText(field: 'name' | 'description', value: string, translations?: Record<string, string>) {
    const text = value.trim(), language = String(locale.value), max = field === 'name' ? 64 : 200
    if (field === 'name' && !text || text.length > max || Object.values(translations ?? {}).some(value => value.length > max)) {
      failure.value = t(field === 'name' && !text ? 'IotDeviceList.add.nameRequired' : 'I18n.maxLength', { max })
      throw new Error(failure.value)
    }
    await commit(async (id, current) => {
      const latest = await getDeviceDetail_api(id)
      if (!latest || !current()) throw new Error(t('IotDeviceDetail.header.loadFailed'))
      const messages = latest.i18nMessages ?? {}
      const i18nMessages = { ...messages, [field]: translations ?? updateI18nText(messages[field], language, text) }
      await updateDeviceHeader_api(id, field === 'name' ? { name: text, i18nMessages } : { describe: text, i18nMessages })
    })
  }
  const saveName = (value: string, translations?: Record<string, string>) => saveText('name', value, translations)
  const saveDescription = (value: string, translations?: Record<string, string>) => saveText('description', value, translations)

  const saveIcon = (value: string) => commit(async id => { await updateDeviceHeader_api(id, { photoUrl: value.trim() }) })

  async function prepareScope(kind: DeviceScopeKind) {
    if (!props.allowed || busy.value || disposed) return
    const id = props.deviceId, epoch = ++version
    loading.value = true; loadError.value = ''; options.value = []
    try {
      if (kind === 'area' && await existsDeviceSpaceAreaSupport_api() !== true) throw new Error(t('IotDeviceDetail.header.spaceUnavailable'))
      // 写入基线须显式读取成功，不能用详情读取失败时的空关联兜底。
      if (kind === 'area') {
        const projectId = props.projectId || ''
        const [current, settings, bindings] = await Promise.all([
          getDeviceDetail_api(id), queryProjectSpaceAreaSettings_api(projectId), queryDeviceSpaceAreaBindings_api([id], projectId),
        ])
        if (!active(id, epoch)) return
        if (!current) throw new Error(t('IotDeviceDetail.header.loadFailed'))
        current.areaBindings = bindings.map(binding => ({ areaId: binding.areaId, area: binding.area || binding.areaId }))
        detail.value = current
        options.value = buildAreaTreeData(mergeDeviceBoundAreas(settings.areas, bindings, projectId))
      } else {
        const [current, groups, bindings] = await Promise.all([
          getDeviceDetail_api(id), queryDeviceGroupDetailList_api(), queryDeviceBoundGroups_api([id]),
        ])
        if (!active(id, epoch)) return
        if (!current) throw new Error(t('IotDeviceDetail.header.loadFailed'))
        current.groupBindings = (bindings[id] ?? []).map(group => ({ id: group.id, name: group.name }))
        detail.value = current
        const knownIds = new Set(groups.map(group => group.id))
        options.value = [...buildDeviceGroupTreeData(groups), ...current.groupBindings.filter(group => !knownIds.has(group.id)).map(group => ({ title: group.name, value: group.id, key: group.id }))]
      }
    } catch (error) { if (active(id, epoch)) loadError.value = message(error) }
    finally { if (active(id, epoch)) loading.value = false }
  }

  async function saveScope(kind: DeviceScopeKind, ids: string[]) {
    const current = detail.value
    if (!current || current.id !== props.deviceId || loading.value || loadError.value) throw new Error(t('IotDeviceDetail.header.loadFailed'))
    if (kind === 'area' && !ids.length) throw new Error(t('IotDeviceList.assignArea.selectRequired'))
    await commit(async id => {
      await saveIotDeviceAreaGroupBindings({ deviceId: id, deviceName: current.name,
        ...(kind === 'area' ? { areaId: ids[0], previousAreaId: current.areaBindings?.[0]?.areaId || '' }
          : { groupIds: ids, previousGroupIds: current.groupBindings?.map(group => group.id) || [] }),
      })
    })
  }
  return { loading, busy, failure, loadError, detail, options, saveName, saveDescription, saveIcon, prepareScope, saveScope }
}
