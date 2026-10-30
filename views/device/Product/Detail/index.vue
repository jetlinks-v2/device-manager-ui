<template>
  <j-page-container class="product-detail-page" :showBack="true">
		<PageChrome>
			<a-button class="product-summary__back" type="text" @click="backToProductList">
				<template #icon><AIcon type="LeftOutlined" /></template>
				{{ $t('Product.detail.backToList') }}
			</a-button>
		</PageChrome>
    <ProductDetailSummary
      :product="productStore.current"
      :can-update="permissionStore.hasPermission('device/Product:update')"
      :can-action="permissionStore.hasPermission('device/Product:action')"
      :can-delete="permissionStore.hasPermission('device/Product:delete')"
      :can-view-devices="canViewDevices"
      @back="backToProductList"
      @edit="openEdit"
      @toggle-state="toggleState"
      @delete="deleteCurrent"
      @view-devices="jumpDevice"
    />

    <section class="product-detail-page__tabs">
      <a-tabs :activeKey="activeTab" class="product-detail-tabs" @change="handleTabChange">
        <a-tab-pane v-for="tab in visibleTabs" :key="tab.key">
          <template #tab>
            <span class="product-detail-tabs__item">
              <AIcon :type="tab.icon" aria-hidden="true" />
              {{ $t(tab.labelKey) }}
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
      <div class="product-detail-page__content">
        <component
          ref="activeTabView"
          :is="tabs[activeTab]"
          v-if="tabs[activeTab] && productStore.current?.id"
          type="product"
          :update-permission="permissionStore.hasPermission('device/Product:update')"
        />
      </div>
    </section>
    <Save ref="saveRef" :isAdd="2" :title="$t('Product.index.660348-13')" @success="refreshCurrent" />
  </j-page-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useProductStore } from '../../../../store/product'
import { _deploy, _undeploy, deleteProduct } from '../../../../api/product'
import { encodeConditionFilterQuery } from '@jetlinks-web-core/components/ConditionFilter'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useRouterParams } from '@jetlinks-web/hooks'
import { EventEmitter, onlyMessage } from '@jetlinks-web/utils'
import { useAuthStore, useSystemStore } from '@jetlinks-web-core/store'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { isApplyDashboard } from '@device-manager-ui/utils/dashboardProject'
import { getDeviceListFilterFields } from '../../../../deviceListFilter'
import Save from '../Save/index.vue'
import ProductDetailSummary from './components/ProductDetailSummary.vue'
import { tabs } from './asyncComponent'
import { buildProductDetailTabs, resolveProductDetailTab, type ProductDetailTabKey } from './detailTabs'
import { hasProductCreatedGuide, updateProductCreatedGuide } from '../hooks/useProductCreatedGuide'
import { Modal } from 'ant-design-vue'

const { t: $t } = useI18n()
const route = useRoute()
const router = useRouter()
const routerParams = useRouterParams()
const productStore = useProductStore()
const permissionStore = useAuthStore()
const menuStore = useMenuStore()
const system = useSystemStore()
const saveRef = ref()
// 物模型引导必须以目标页签作为首屏，避免详情先渲染设备接入后再切换。
const activeTab = ref<ProductDetailTabKey>(route.query.tab === 'Metadata' ? 'Metadata' : 'Device')
const activeTabView = ref<{ openAccessSelector?: () => void }>()
let openingAccessGuide = false
const canViewDevices = computed(() => menuStore.hasMenu('iot-user-device-list'))
const isCreatedProductOnboarding = computed(() => route.query.onboarding === 'product-created'
  && hasProductCreatedGuide(typeof route.params.id === 'string' ? route.params.id : undefined))

const visibleTabs = computed(() => buildProductDetailTabs(productStore.current, {
  showRules: system.showThreshold,
  showAlarm: permissionStore.hasPermission('rule-engine/Alarm/Log:view') && system.showThreshold,
  showFirmware: permissionStore.hasPermission('device/Firmware:view'),
  showDashboard: isApplyDashboard(),
  isNoCommunity,
}))

function syncActiveTab(tab?: unknown) {
  // 兼容旧详情链接的 Tab 参数，并在权限或功能开关变化时回退到首个可见入口。
  activeTab.value = resolveProductDetailTab(tab ?? activeTab.value, visibleTabs.value)
  productStore.tabActiveKey = activeTab.value
}

function handleTabChange(key: string) {
  const change = () => {
    const query = { ...route.query, tab: key, ruleProperty: undefined }
    return router.replace({ query })
  }
  if (activeTab.value === 'Metadata') {
    EventEmitter.emit('MetadataTabs', change)
    return
  }
  void change()
}

function refreshCurrent() {
  // 保存或启停后只刷新当前产品摘要，不重置用户正在查看的一级入口。
  return productStore.refresh(route.params.id as string).then(() => syncActiveTab())
}

function openEdit() {
  saveRef.value?.show(productStore.current)
}

function toggleState() {
  // 启停继续使用原产品接口，避免摘要壳层引入第二条状态写入路径。
  const request = productStore.current.state === 1 ? _undeploy : _deploy
  return request(productStore.current.id).then((response: any) => {
    if (response?.status === 200) {
      if (request === _deploy && isCreatedProductOnboarding.value) {
        updateProductCreatedGuide(productStore.current.id, { enabled: true })
      }
      onlyMessage($t('Detail.index.478940-12'))
      return refreshCurrent()
    }
    return response
  })
}

function deleteCurrent() {
  const productId = productStore.current?.id
  if (!productId) return

  return deleteProduct(productId).then((response: any) => {
    if (response?.status === 200) {
      onlyMessage($t('Product.index.660348-18'))
      backToProductList()
      return response
    }

    onlyMessage($t('Product.index.660348-19'), 'error')
    return response
  })
}

function jumpDevice() {
  const productId = typeof route.params.id === 'string' ? route.params.id : productStore.current?.id
  if (!canViewDevices.value || !productId) return

  // SaaS Runtime 已将原 device/Instance 菜单替换为统一设备入口；沿用产品 ID 的精确筛选语义。
  menuStore.jumpPage('iot-user-device-list', {
    query: {
      type: 'device',
      q: encodeConditionFilterQuery(
        [{ column: 'productId', termType: 'eq', value: productId }],
        getDeviceListFilterFields(),
      ),
    },
  })
}

function backToProductList() {
  // 通过菜单编码返回，兼容资源中心下产品列表的实际注册路径。
  menuStore.jumpPage('device/Product')
}

function returnToCreatedProductGuide() {
  const productId = typeof route.params.id === 'string' ? route.params.id : productStore.current?.id
  if (!productId) return
  menuStore.jumpPage('device/Product', { query: { productOnboarding: 'resume', productId } })
}

/** Handles the only two transitions that may interrupt a newly-created product's detail workflow. */
function promptEnableProduct() {
  const productId = typeof route.params.id === 'string' ? route.params.id : productStore.current?.id
  if (!productId || !isCreatedProductOnboarding.value) return
  Modal.confirm({
    title: $t('DialogTips.index.379211-29'),
    content: $t('DialogTips.index.379211-30'),
    okText: $t('DialogTips.index.379211-27'),
    cancelText: $t('DialogTips.index.379211-17'),
    onOk: () => _deploy(productId).then(async (response: any) => {
      if (response?.status !== 200) return response
      updateProductCreatedGuide(productId, { enabled: true })
      await refreshCurrent()
      returnToCreatedProductGuide()
      return response
    }),
    onCancel: returnToCreatedProductGuide,
  })
}

function handleAccessConfigured(data: { id?: string }) {
  const productId = typeof route.params.id === 'string' ? route.params.id : productStore.current?.id
  if (!productId || data?.id !== productId || !isCreatedProductOnboarding.value) return
  updateProductCreatedGuide(productId, { accessConfigured: true })
  Modal.confirm({
    title: $t('DialogTips.index.379211-31'),
    content: $t('DialogTips.index.379211-32'),
    okText: $t('DialogTips.index.379211-20'),
    cancelText: $t('DialogTips.index.379211-17'),
    onOk: () => syncActiveTab('Metadata'),
    onCancel: returnToCreatedProductGuide,
  })
}

function handleMetadataChanged(data: { type?: string; id?: string }) {
  const productId = typeof route.params.id === 'string' ? route.params.id : productStore.current?.id
  if (!productId || data?.type !== 'product' || data.id !== productId || !isCreatedProductOnboarding.value) return
  updateProductCreatedGuide(productId, { metadataSaved: true })
  promptEnableProduct()
}

watch(() => productStore.current, () => syncActiveTab(), { deep: true })

// 引导入口通过标准 query 指定物模型页；同一详情页复用时也要响应 query 中的 Tab 变化。
watch(() => route.query.tab, (tab) => {
  syncActiveTab(tab)
})

watch([() => route.query.guide, activeTab, activeTabView, () => productStore.current?.id], async ([guide, tab, view, productId]) => {
  if (guide === 'enable-product' && productId && isCreatedProductOnboarding.value) {
    const { guide: _guide, ...query } = route.query
    await router.replace({ query })
    promptEnableProduct()
    return
  }
  if (guide !== 'configure-access' || tab !== 'Device' || !productId || !view?.openAccessSelector || openingAccessGuide) return

  // Route intent is consumed only once the async access tab exposes its stable command.
  openingAccessGuide = true
  try {
    await nextTick()
    // Leave the product summary visible briefly before presenting the next configuration step.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 350))
    if (route.query.guide !== 'configure-access') return
    view.openAccessSelector()
    const { guide: _guide, ...query } = route.query
    await router.replace({ query })
  } finally {
    openingAccessGuide = false
  }
}, { flush: 'post' })

onMounted(async () => {
  EventEmitter.subscribe(['ProductAccessConfigured'], handleAccessConfigured)
  EventEmitter.subscribe(['MetadataChanged'], handleMetadataChanged)
  productStore.reSet()
  await productStore.refresh(route.params.id as string)
  syncActiveTab(route.query.tab ?? routerParams.params?.value.tab)
})

onBeforeUnmount(() => {
  EventEmitter.unSubscribe(['ProductAccessConfigured'], handleAccessConfigured)
  EventEmitter.unSubscribe(['MetadataChanged'], handleMetadataChanged)
})
</script>

<style scoped lang="less">
.product-detail-page {
  display: grid;
  gap: var(--space-3);
}

.product-summary__back {
	padding: 0;
}
.product-detail-page__tabs {
  min-width: 0;
  overflow: hidden;
}

.product-detail-tabs :deep(.ant-tabs-tab) {
  padding: 0;
}

.product-detail-tabs :deep(.ant-tabs-tab + .ant-tabs-tab) {
  margin-left: var(--space-5);
}

.product-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0;
}

.product-detail-tabs :deep(.ant-tabs-content-holder) {
  display: none;
}

.product-detail-tabs__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.625rem;
  font-size: var(--fs-14);
  font-weight: 600;
  white-space: nowrap;
}

.product-detail-page__content {
  min-width: 0;
  padding-top: var(--space-4);
}

.product-detail-page__content :deep(.metadata-base .extra-header) {
  padding: 0 var(--space-4) var(--space-4);
}
</style>
