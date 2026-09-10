import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { onlyMessage } from '@jetlinks-web/utils'
import { deployDevice_api, undeployDevice_api, deleteDevice_api, batchDeployDevice_api, batchUndeployDevice_api } from '../../../../api/device'
import { bindDeviceGroupDevices_api, type DeviceGroup } from '../../../../api/deviceGroup'
import { reassignIotDevicesToArea } from '../hooks/iotDeviceAreaGroupBindings'
import { resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import type { DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'

/** 统一列表操作与新增弹层状态；快捷入口仅调用当前分类已有的新增能力。 */
export function useUnifiedDeviceActions(
  rows: Ref<UnifiedDevice[]>,
  selectedIds: Ref<string[]>,
  providerOf: (device: UnifiedDevice) => DeviceListProvider | undefined,
  refresh: () => void,
  activeProvider: Ref<DeviceListProvider | undefined>,
) {
  const { t } = useI18n()
  const menu = useMenuStore()
  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const projectId = computed(() => resolveIotProjectId(route))
  const editing = ref<UnifiedDevice | null>(null)
  const editOpen = ref(false)
  // 固定打开时的新增入口，切换列表分类不会替换正在填写的表单。
  const createEntry = shallowRef<DeviceListProvider['create']>()
  // 消费一次性创建动作，刷新页面不重开；未提供新增弹层的分类只保留列表。
  watch([() => route.query.action, activeProvider], ([action, provider]) => {
    if (action !== 'create' || !provider) return
    if (provider.id === 'device') {
      editing.value = null
      editOpen.value = true
    } else if (provider.create) {
      createEntry.value = provider.create
    }
    const { action: _action, ...query } = route.query
    void router.replace({ query })
  }, { immediate: true })
  const detailDevice = ref<UnifiedDevice | null>(null)
  const busy = ref(false)
  const assignAreaOpen = ref(false)
  const assignGroupOpen = ref(false)
  const selected = computed(() => rows.value.filter(device => selectedIds.value.includes(device.id)))
  const allowed = (device: UnifiedDevice, action: string) => {
    const provider = providerOf(device)
    // 普通设备菜单按页面赋予 CRUD 权限；网关和视频沿用各自按钮授权。
    return !!provider && (provider.id === 'device' ? menu.hasMenu(provider.menuCode) : auth.hasPermission(`${provider.menuCode}:${action}`))
  }
  function openDetail(device: UnifiedDevice) {
    const provider = providerOf(device)
    if (!provider) return
    if (provider.detailComponent) { detailDevice.value = device; return }
    if (provider.detailRoute) menu.jumpPage(provider.detailRoute, {
      params: { [provider.detailParam || 'id']: device.id },
      query: { ...route.query },
    })
  }
  function edit(device: UnifiedDevice) {
    const provider = providerOf(device)
    if (provider?.editRoute) { menu.jumpPage(provider.editRoute, { params: { id: device.id }, query: { id: device.id } }); return }
    editing.value = device; editOpen.value = true
  }
  async function execute(work: () => Promise<unknown>) {
    if (busy.value) return
    busy.value = true
    try { await work(); refresh() }
    catch (reason) { onlyMessage(reason instanceof Error ? reason.message : t('UnifiedDeviceList.actionFailed'), 'error') }
    finally { busy.value = false }
  }
  function toggle(device: UnifiedDevice) {
    const enable = device.connectionStatus === 'disabled'
    Modal.confirm({ title: t(enable ? 'IotDeviceList.confirm.enableOne' : 'IotDeviceList.confirm.disableOne', { name: device.name }), onOk: () => execute(() => enable ? deployDevice_api(device.id) : undeployDevice_api(device.id)) })
  }
  const canDelete = (device: UnifiedDevice) => providerOf(device)?.canDelete?.(device) ?? device.connectionStatus === 'disabled'
  function remove(device: UnifiedDevice) {
    if (!canDelete(device)) return
    Modal.confirm({ title: t('IotDeviceList.confirm.deleteOne', { name: device.name }), okButtonProps: { danger: true }, onOk: () => execute(() => providerOf(device)?.remove?.(device) || deleteDevice_api(device.id)) })
  }
  function batchToggle(action: 'enable' | 'disable') {
    const ids = selected.value.map(device => device.id)
    if (!ids.length) return
    Modal.confirm({ title: t(action === 'enable' ? 'IotDeviceList.confirm.batchEnable' : 'IotDeviceList.confirm.batchDisable', { count: ids.length }), onOk: () => execute(() => action === 'enable' ? batchDeployDevice_api(ids) : batchUndeployDevice_api(ids)) })
  }
  async function assignArea(areaId: string) {
    await execute(async () => {
      await reassignIotDevicesToArea(areaId, selected.value.map(device => ({ id: device.id, name: device.name, productName: device.productName, state: device.status })))
      assignAreaOpen.value = false
    })
  }
  async function assignGroup(group: DeviceGroup) { await execute(async () => { await bindDeviceGroupDevices_api(group.id, [...selectedIds.value]); assignGroupOpen.value = false }) }
  return { projectId, editing, editOpen, createEntry, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, assignAreaOpen, assignGroupOpen, assignArea, assignGroup }
}
