import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { onlyMessage } from '@jetlinks-web/utils'
import { deployDevice_api, undeployDevice_api, deleteDevice_api, batchDeployDevice_api, batchUndeployDevice_api } from '../../../../api/device'
import { batchDeleteDevice } from '../../../../api/instance'
import { bindDeviceGroupDevices_api, type DeviceGroup } from '../../../../api/deviceGroup'
import { reassignIotDevicesToArea } from '../hooks/iotDeviceAreaGroupBindings'
import { buildIotDeviceDetailPath, resolveIotProjectId } from '../hooks/useIotDeviceRouting'
import type { DeviceCreateDrawerOptions, DeviceCreateEntry, DeviceListProvider, UnifiedDevice } from '../../../../deviceListProvider'
import { isSaaS } from '@jetlinks-web-core/utils/consts'

/** 统一列表操作与新增弹层状态；快捷入口仅调用当前分类已有的新增能力。 */
export function useUnifiedDeviceActions(
  rows: Ref<UnifiedDevice[]>,
  selectedIds: Ref<string[]>,
  clearBatchSelection: () => void,
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
  const initialProductId = ref<string>()
  const productOnboardingDeviceCreation = ref(false)
  const deviceImportOpen = ref(false)
  const deviceImportProductId = ref<string>()
  const productOnboardingDeviceImport = ref(false)
  const createDrawerOptions = shallowRef<DeviceCreateDrawerOptions>()
  // 固定打开时的新增入口，切换列表分类不会替换正在填写的表单。
  const createEntry = shallowRef<Extract<DeviceCreateEntry, { component: unknown }>>()
  const guideRequest = ref(0)
  const canCreate = (provider?: DeviceListProvider) => !!provider?.create && (!provider.create.permission || auth.hasPermission(provider.create.permission))
  // 消费一次性创建动作，刷新页面不重开；未提供新增弹层的分类只保留列表。
  watch([() => route.query.action, () => route.query.onboarding, () => route.query.productId, activeProvider, () => route.query.type], async ([action, onboarding, productId, provider, requestedType]) => {
    if (action !== 'create' && action !== 'import') return

    const targetCategory = requestedType || (route.path.endsWith('/gateway') ? 'gateway' : route.path.endsWith('/video') ? 'video' : 'device')

    // 如果需要特定分类但对应 provider 尚未就绪，则等待下一轮 watch 触发
    if (targetCategory !== 'device' && (!provider || provider.id !== targetCategory)) {
      return
    }

    const { action: _action, onboarding: _onboarding, productId: _productId, ...query } = route.query

    // Product creation is intentionally shown as a short, visible sequence: list first, then its dialog.
    if (onboarding === 'product-created') {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350))
      if (route.query.action !== action || route.query.onboarding !== onboarding) return
    }

    // Legacy batch import is deliberately unavailable in SaaS; do not consume its route intent there.
    if (action === 'import') {
      if (isSaaS) return
      deviceImportProductId.value = typeof productId === 'string' ? productId : undefined
      productOnboardingDeviceImport.value = onboarding === 'product-created'
      deviceImportOpen.value = true
      void router.replace({ query })
      return
    }

    // 设备接入（默认全部或明确为 device）：打开设备接入抽屉
    if (targetCategory === 'device' || !provider || provider.id === 'device') {
      editing.value = null
      createDrawerOptions.value = undefined
      initialProductId.value = typeof productId === 'string' ? productId : undefined
      // 设备创建后的启用和接入配置只属于刚创建产品的引导，不能影响普通“接入设备”。
      productOnboardingDeviceCreation.value = onboarding === 'product-created'
      editOpen.value = true
      void router.replace({ query })
      return
    }

    // 其它扩展分类（如网关、视频等）
    if (canCreate(provider)) {
      if (provider.listGuide) {
        guideRequest.value++
        void router.replace({ query })
      } else if (provider.create && 'component' in provider.create) {
        createEntry.value = provider.create
        void router.replace({ query })
      } else if (provider.create && 'drawer' in provider.create) {
        editing.value = null
        createDrawerOptions.value = provider.create.drawer
        editOpen.value = true
        void router.replace({ query })
      } else if (provider.create) {
        // 路由型新增使用 replace 跳转，避免将中转列表页压入历史栈导致浏览器需要后退两次。
        const targetMenu = menu.getMenu(provider.create.route)
        void router.replace({
          name: targetMenu?.routeName || provider.create.route,
          params: {
            ...provider.create.params,
            ...(projectId.value ? { projectId: projectId.value } : {}),
          },
        })
      }
    }
  }, { immediate: true })
  const detailDevice = ref<UnifiedDevice | null>(null)
  const busy = ref(false)
  const assignAreaOpen = ref(false)
  const assignGroupOpen = ref(false)
  const selected = computed(() => rows.value.filter(device => selectedIds.value.includes(device.id)))
  watch(editOpen, open => {
    if (!open) {
      initialProductId.value = undefined
      productOnboardingDeviceCreation.value = false
    }
  })
  watch(deviceImportOpen, open => {
    if (!open) {
      deviceImportProductId.value = undefined
      productOnboardingDeviceImport.value = false
    }
  })
  const allowed = (device: UnifiedDevice, action: string) => {
    const provider = providerOf(device)
    if (!provider) return false
    // 设备实例的编辑、启停和删除均由所属列表菜单授权；扩展分类不应要求不存在的同名菜单按钮权限。
    return menu.hasMenu(provider.menuCode)
  }
  function openCreate(provider?: DeviceListProvider) {
    const entry = provider?.create
    if (!entry || busy.value || !canCreate(provider)) return
    // 私有化网关声明产品新增抽屉时，不能被列表待办引导的扫码入口覆盖。
    if ('drawer' in entry) {
      editing.value = null
      createDrawerOptions.value = entry.drawer
      editOpen.value = true
      return
    }
    if (provider?.listGuide) {
      guideRequest.value++
    } else if (entry.route !== undefined) {
      // 原新增页通过 query.id 判定编辑；列表上下文由浏览器返回历史保留。
      menu.jumpPage(entry.route, { params: entry.params })
    } else {
      createEntry.value = entry
    }
  }
  function openDetail(device: UnifiedDevice) {
    const provider = providerOf(device)
    if (!provider) return
    if (provider.detailComponent) { detailDevice.value = device; return }
    if (provider.detailPath) {
      void router.push(provider.detailPath(device))
      return
    }
    if (provider.detailRoute) menu.jumpPage(provider.detailRoute, {
      params: { [provider.detailParam || 'id']: device.id },
      // 子菜单也可通过 /video 等路径限定类型；详情返回统一列表时仍需保留该分类。
      query: { ...route.query, type: route.query.type || device.category },
    })
  }
  function edit(device: UnifiedDevice) {
    const provider = providerOf(device)
    if (provider?.editRoute) { menu.jumpPage(provider.editRoute, { params: { id: device.id }, query: { id: device.id } }); return }
    editing.value = device; editOpen.value = true
  }
  async function execute(work: () => Promise<unknown>, onSuccess?: () => void) {
    if (busy.value) return
    busy.value = true
    try { await work(); onSuccess?.(); refresh() }
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
    Modal.confirm({ title: t(action === 'enable' ? 'IotDeviceList.confirm.batchEnable' : 'IotDeviceList.confirm.batchDisable', { count: ids.length }), onOk: () => execute(() => action === 'enable' ? batchDeployDevice_api(ids) : batchUndeployDevice_api(ids), clearBatchSelection) })
  }
  function batchRemove() {
    const ids = selected.value.map(device => device.id)
    if (!ids.length) return
    Modal.confirm({ title: t('Instance.index.133466-36'), okButtonProps: { danger: true }, onOk: () => execute(() => batchDeleteDevice(ids), clearBatchSelection) })
  }
  async function assignArea(areaId: string) {
    await execute(async () => {
      await reassignIotDevicesToArea(areaId, selected.value.map(device => ({ id: device.id, name: device.name, productName: device.productName, state: device.status })))
      assignAreaOpen.value = false
    }, clearBatchSelection)
  }
  async function assignGroup(group: DeviceGroup) { await execute(async () => { await bindDeviceGroupDevices_api(group.id, [...selectedIds.value]); assignGroupOpen.value = false }, clearBatchSelection) }
  function openDeviceImport(productId?: string) {
    if (isSaaS) return
    deviceImportProductId.value = productId
    productOnboardingDeviceImport.value = false
    deviceImportOpen.value = true
  }

  /** 将引导创建的设备启用后带到接入配置，普通新增设备不调用此流程。 */
  async function enableOnboardedDeviceAndOpenAccess(deviceId: string) {
    await deployDevice_api(deviceId)
    refresh()
    await router.push({
      path: buildIotDeviceDetailPath(projectId.value, deviceId, { tab: 'access', sub: 'connection' }, route),
    })
  }

  return { projectId, editing, editOpen, initialProductId, productOnboardingDeviceCreation, createDrawerOptions, createEntry, guideRequest, canCreate, openCreate, detailDevice, busy, selected, allowed, openDetail, edit, toggle, remove, canDelete, batchToggle, batchRemove, assignAreaOpen, assignGroupOpen, assignArea, assignGroup, deviceImportOpen, deviceImportProductId, productOnboardingDeviceImport, openDeviceImport, enableOnboardedDeviceAndOpenAccess }
}
