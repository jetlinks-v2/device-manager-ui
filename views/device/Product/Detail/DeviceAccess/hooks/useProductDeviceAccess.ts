import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import type { SelectProps } from 'ant-design-vue'
import { cloneDeep, pick } from 'lodash-es'
import Driver from 'driver.js'
import 'driver.js/dist/driver.min.css'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useTabSaveSuccessBack } from '@jetlinks-web-core/hooks'
import { EventEmitter, onlyMessage } from '@jetlinks-web/utils'
import { useProductStore } from '../../../../../../store/product'
import { getProviders, queryList, getConfigMetadata, productGuide, productGuideSave, getStoragList } from '../../../../../../api/product'
import { getPluginData, getProductByPluginId } from '../../../../../../api/link/plugin'
import { detail as queryPluginAccessDetail, getCompositeProviderDetail } from '../../../../../../api/link/accessConfig'
import type { ConfigMetadata } from '../../../typings'
import type { AccessSelection, AccessSaveData } from '../accessState'
import { reconcileAccessConfiguration } from '../accessState'
import { saveProductAccess } from '../accessService'
import { steps, steps1 } from '../util'

const metadataKeys = ['functions', 'properties', 'events', 'tags']

/** 产品接入草稿以加载版本隔离，保存和覆盖弹窗只使用冻结的数据快照。 */
export function useProductDeviceAccess() {
  const { t: $t } = useI18n()
  const productStore = useProductStore()
  const permissionStore = useAuthStore()
  const { onBack } = useTabSaveSuccessBack()
  const formRef = ref()
  const pluginFormRef = ref()
  const visible = ref(false)
  const access = ref<Record<string, any>>({})
  const accessId = ref('')
  const metadata = ref<ConfigMetadata[]>([])
  const dataSource = ref<{ id: string; description?: string }[]>([])
  const storageList = ref<{ id: string; name: string }[]>([])
  const activeKey = ref<string[]>([])
  const form = reactive({ storePolicy: productStore.current.storePolicy || 'none' })
  const formData = reactive({ data: {} as Record<string, unknown> })
  const productTypes = ref<Record<string, any>[]>([])
  const productData = reactive({ id: undefined as string | undefined, metadata: {} as Record<string, any> })
  const metadataVisible = ref(false)
  const metadataModalCacheData = ref<AccessSaveData>()
  const submitLoading = ref(false)
  const accessLoading = ref(false)
  const accessError = ref(false)
  let accessLoadVersion = 0
  let disposed = false
  let configurationLoad: Promise<ConfigMetadata[]> = Promise.resolve([])
  const isCurrentAccessLoad = (version: number) => !disposed && version === accessLoadVersion

  /** 打开选择器不清空当前草稿，取消选择后可继续编辑原网关。 */
  const showDevice = () => { if (!submitLoading.value && !metadataVisible.value) visible.value = true }
  const showModal = showDevice
  const stepsRef = reactive({ current: 0 })

  /** 两种既有引导仅步骤数不同，共用推进和跳过处理。 */
  function createGuideDriver(total: number) {
    return new Driver({
      allowClose: false,
      doneBtnText: $t('DeviceAccess.index.594346-18'),
      closeBtnText: $t('DeviceAccess.index.594346-19'),
      nextBtnText: $t('DeviceAccess.index.594346-20'),
      prevBtnText: $t('DeviceAccess.index.594346-21'),
      onNext: () => { stepsRef.current += 1 },
      onPrevious: () => { stepsRef.current -= 1 },
      onReset: () => {
        if (stepsRef.current !== total) void productGuideSave({ name: 'guide', content: 'skip' })
        stepsRef.current = 0
      },
    })
  }
  const driver = createGuideDriver(3)
  const driver1 = createGuideDriver(4)

  /** 引导请求也受版本约束，防止旧网关请求在新选择上弹出引导。 */
  async function getGuide(hasConfig: boolean, version: number) {
    const response = await productGuide()
    if (!isCurrentAccessLoad(version) || response.result?.content === 'skip') return
    const currentDriver = hasConfig ? driver1 : driver
    currentDriver.defineSteps(hasConfig ? steps1 : steps)
    currentDriver.start()
  }

  /** 复合网关先取得子网关详情，所有字段与主网关一起提交给状态层。 */
  async function loadGateway(gateway: Record<string, any>) {
    const result = cloneDeep(gateway)
    if (result.provider === 'composite-device-gateway') {
      const response = await getCompositeProviderDetail(result.configuration?.gateways || [])
      if (!response.success) throw new Error('复合网关配置加载失败')
      result.configuration = { ...result.configuration, gateways: response.result || [] }
    }
    return result
  }

  /** 合并普通协议和复合子网关字段，用完整定义清理旧协议字段。 */
  function allConfig(groups: ConfigMetadata[], gateway: Record<string, any>): ConfigMetadata[] {
    return [...groups, ...(gateway.configuration?.gateways || []).flatMap((item: Record<string, any>) => item.transportDetail?.allConfig || [])]
  }

  /** 同步一整份选择，隐藏的流传输模式仍保留在配置定义快照中。 */
  function applyAccess(data: AccessSelection) {
    access.value = cloneDeep(data.access)
    accessId.value = data.access.id || ''
    metadata.value = cloneDeep(data.metadata).map(group => ({
      ...group,
      properties: (group.properties || []).filter(item => {
        if (item.name !== '流传输模式') return true
        if (formData.data[item.property] === undefined) formData.data[item.property] = item.type.expands?.defaultValue
        return false
      }),
    }))
    productTypes.value = (data.productTypes || []).map(item => ({ ...item, label: item.name, value: item.id }))
    productData.id = undefined
    productData.metadata = data.access.transportDetail?.metadata
      ? pick(JSON.parse(data.access.transportDetail.metadata), metadataKeys) : {}
    activeKey.value = access.value.configuration?.gateways?.[0]?.id ? [access.value.configuration.gateways[0].id] : []
  }

  /** 改选立即废弃旧请求；旧字段定义未返回时等待它，仅用于清理旧协议配置。 */
  async function checkAccess(data: AccessSelection) {
    if (disposed || submitLoading.value || metadataVisible.value) return
    const version = ++accessLoadVersion
    const selected = cloneDeep(data)
    visible.value = false
    accessLoading.value = true
    accessError.value = false
    try {
      const [previous, gateway] = await Promise.all([configurationLoad, loadGateway(selected.access)])
      if (!isCurrentAccessLoad(version)) return
      selected.access = gateway as AccessSelection['access']
      const next = allConfig(selected.metadata, gateway)
      formData.data = reconcileAccessConfiguration(formData.data, previous, next)
      applyAccess(selected)
      configurationLoad = Promise.resolve(cloneDeep(next))
      if (selected.access.channel !== 'plugin') void getGuide(!!selected.metadata.length, version)
    } catch {
      if (isCurrentAccessLoad(version)) accessError.value = true
    } finally {
      if (isCurrentAccessLoad(version)) accessLoading.value = false
    }
  }

  /** 初始化从独立草稿开始，产品切换和所有请求结束时都核验版本。 */
  async function getData() {
    const version = ++accessLoadVersion
    const product = cloneDeep(productStore.current)
    access.value = {}
    accessId.value = ''
    metadata.value = []
    activeKey.value = []
    productTypes.value = []
    productData.id = undefined
    productData.metadata = {}
    visible.value = false
    metadataVisible.value = false
    metadataModalCacheData.value = undefined
    formData.data = cloneDeep(product.configuration || {})
    form.storePolicy = product.storePolicy || 'none'
    accessError.value = false
    accessLoading.value = !!product.id
    if (!product.id) { configurationLoad = Promise.resolve([]); return }
    const gatewayLoad = product.accessId ? queryList({ terms: [{ column: 'id', value: product.accessId }] })
      .then(async (response: { success: boolean; result: { data: Record<string, any>[] } }) => {
        if (!response.success) throw new Error('接入方式加载失败')
        return loadGateway((response.result as { data: Record<string, any>[] }).data[0] || {})
      }) : Promise.resolve({} as Record<string, any>)
    configurationLoad = Promise.all([getConfigMetadata(product.id), gatewayLoad]).then(([response, gateway]) => {
      if (!response.success) throw new Error('产品接入配置加载失败')
      return cloneDeep(allConfig((response.result || []) as ConfigMetadata[], gateway))
    })
    try {
      const [groups, gateway] = await Promise.all([configurationLoad, gatewayLoad])
      if (!isCurrentAccessLoad(version)) return
      applyAccess({ access: gateway as AccessSelection['access'], metadata: groups })
      if (product.accessProvider === 'plugin_gateway' && product.accessId) {
        const detail = await queryPluginAccessDetail(product.accessId)
        if (!isCurrentAccessLoad(version) || !detail.success) return
        const [binding, types] = await Promise.all([
          getPluginData('product', product.accessId, product.id),
          getProductByPluginId(detail.result.channelId),
        ])
        if (!isCurrentAccessLoad(version)) return
        productTypes.value = (types.result || []).map((item: Record<string, any>) => ({ ...item, label: item.name, value: item.id }))
        const selected = productTypes.value.find(item => item.id === binding.result?.externalId)
        productData.id = selected?.id
        productData.metadata = selected?.metadata ? pick(selected.metadata, metadataKeys) : productData.metadata
      }
    } catch {
      if (isCurrentAccessLoad(version)) accessError.value = true
    } finally {
      if (isCurrentAccessLoad(version)) accessLoading.value = false
    }
  }

  /** 插件产品类型变更时同步该类型的物模型。 */
  const productTypeChange: NonNullable<SelectProps['onChange']> = (_id, item) => {
    const option = Array.isArray(item) ? item[0] : item
    productData.metadata = option?.metadata ? pick(option.metadata, metadataKeys) : {}
  }

  /** 冻结经校验的完整草稿，覆盖弹窗与直接保存共用同一保存服务。 */
  async function submitDevice() {
    if (accessLoading.value || accessError.value || submitLoading.value || metadataVisible.value || !access.value.id) return
    submitLoading.value = true
    const version = accessLoadVersion
    try {
      await pluginFormRef.value?.validate()
      const forms = Array.isArray(formRef.value) ? formRef.value : [formRef.value]
      await Promise.all(forms.filter(Boolean).map(item => item.validate()))
      if (!isCurrentAccessLoad(version)) return
      const snapshot: AccessSaveData = cloneDeep({
        id: productStore.current.id, product: productStore.current,
        access: { ...access.value, id: access.value.id },
        values: { ...formData.data, storePolicy: form.storePolicy },
        metadata: productData.metadata, productTypeId: productData.id,
      })
      const original = JSON.parse(snapshot.product.metadata || '{}')
      const hasMetadata = (value: Record<string, any>) => metadataKeys.some(key => value[key]?.length)
      if (hasMetadata(original) && hasMetadata(snapshot.metadata)) {
        metadataModalCacheData.value = snapshot
        metadataVisible.value = true
        return
      }
      const target = snapshot.product.metadata || (hasMetadata(snapshot.metadata) ? JSON.stringify(snapshot.metadata) : '')
      const response = await saveProductAccess(snapshot, target)
      if (!response.success || !isCurrentAccessLoad(version)) return
      onlyMessage($t('DeviceAccess.index.594346-30'))
      EventEmitter.emit('ProductAccessConfigured', { id: snapshot.id })
      const isTabBack = await onBack(response)
      if (!isTabBack && isCurrentAccessLoad(version)) {
        await productStore.getDetail(snapshot.id)
        if (isCurrentAccessLoad(version)) MetaDataModalSubmit()
      }
    } finally {
      submitLoading.value = false
    }
  }

  /** 保存完成后关闭处理弹窗并显示物模型页签。 */
  function MetaDataModalSubmit() { metadataVisible.value = false; productStore.tabActiveKey = 'Metadata' }

  const tooltip = computed(() => (productStore.current.count || 0) > 0
    ? $t('DeviceAccess.index.594346-31') : productStore.current.state === 1 ? $t('DeviceAccess.index.594346-32') : '')
  const checkDisabled = computed(() => submitLoading.value || metadataVisible.value || (productStore.current.count || 0) > 0 || productStore.current.state === 1)

  // 辅助选项与当前网关无关，切换网关不会丢弃存储策略列表。
  void getProviders().then((response: { success: boolean; result: { id: string; description?: string }[] }) => { if (!disposed && response.success) dataSource.value = response.result || [] })
  void getStoragList().then((response: { success: boolean; result: { id: string; name: string }[] }) => { if (!disposed && response.success) storageList.value = response.result || [] })
  watch(() => productStore.current.id, () => { void getData() }, { immediate: true })
  onScopeDispose(() => { disposed = true; accessLoadVersion += 1 })
  return {
    productStore, permissionStore, formRef, visible, access, accessId, metadata, dataSource,
    storageList, activeKey, form, formData, productTypes, productData, pluginFormRef,
    metadataVisible, metadataModalCacheData, submitLoading, accessLoading, accessError, getData,
    showModal, showDevice, checkAccess, productTypeChange, submitDevice, MetaDataModalSubmit, tooltip, checkDisabled,
  }
}
