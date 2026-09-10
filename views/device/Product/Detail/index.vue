<template>
  <j-page-container class="product-detail-page" :showBack="true">
    <ProductDetailSummary
      :product="productStore.current"
      :can-update="permissionStore.hasPermission('device/Product:update')"
      :can-action="permissionStore.hasPermission('device/Product:action')"
      @back="backToProductList"
      @edit="openEdit"
      @toggle-state="toggleState"
      @view-devices="jumpDevice"
    />

    <section class="product-detail-page__tabs">
      <a-tabs v-model:activeKey="activeTab" class="product-detail-tabs" @change="handleTabChange">
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
          :is="tabs[activeTab]"
          v-if="tabs[activeTab]"
          type="product"
          :update-permission="permissionStore.hasPermission('device/Product:update')"
        />
      </div>
    </section>
    <Save ref="saveRef" :isAdd="2" :title="$t('Product.index.660348-13')" @success="refreshCurrent" />
  </j-page-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useProductStore } from '../../../../store/product'
import { _deploy, _undeploy } from '../../../../api/product'
import { handleParamsToString } from '@jetlinks-web-core/utils'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useRouterParams } from '@jetlinks-web/hooks'
import { EventEmitter, onlyMessage } from '@jetlinks-web/utils'
import { useAuthStore, useSystemStore } from '@jetlinks-web-core/store'
import { isNoCommunity } from '@jetlinks-web-core/utils/utils'
import { isApplyDashboard } from '@device-manager-ui/utils/dashboardProject'
import Save from '../Save/index.vue'
import ProductDetailSummary from './components/ProductDetailSummary.vue'
import { tabs } from './asyncComponent'
import { buildProductDetailTabs, resolveProductDetailTab, type ProductDetailTabKey } from './detailTabs'

const { t: $t } = useI18n()
const route = useRoute()
const routerParams = useRouterParams()
const productStore = useProductStore()
const permissionStore = useAuthStore()
const menuStore = useMenuStore()
const { showThreshold } = useSystemStore()
const saveRef = ref()
const activeTab = ref<ProductDetailTabKey>('Device')

const visibleTabs = computed(() => buildProductDetailTabs(productStore.current, {
  showAlarm: permissionStore.hasPermission('rule-engine/Alarm/Log:view') && showThreshold,
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
  if (activeTab.value === 'Metadata') {
    EventEmitter.emit('MetadataTabs', () => syncActiveTab(key))
    return
  }
  syncActiveTab(key)
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
      onlyMessage($t('Detail.index.478940-12'))
      return refreshCurrent()
    }
    return response
  })
}

function jumpDevice() {
  menuStore.jumpPage('device/Instance', {
    query: {
      target: 'device-instance',
      q: handleParamsToString([{ column: 'productName', termType: 'eq', value: productStore.current?.id }]),
    },
  })
}

function backToProductList() {
  // 通过菜单编码返回，兼容资源中心下产品列表的实际注册路径。
  menuStore.jumpPage('device/Product')
}

watch(() => productStore.current, () => syncActiveTab(), { deep: true })

onMounted(async () => {
  productStore.reSet()
  await productStore.refresh(route.params.id as string)
  syncActiveTab(routerParams.params?.value.tab)
})
</script>

<style scoped lang="less">
.product-detail-page {
  display: grid;
  gap: var(--space-3);
}

.product-detail-page__tabs {
  min-width: 0;
  overflow: hidden;
  border: 0.0625rem solid var(--jet-theme-border-secondary);
  border-radius: var(--r-6);
  background: var(--bg-trans-8);
}

.product-detail-tabs {
  padding: 0 var(--space-4);
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
  padding: var(--space-4);
}

.product-detail-page__content :deep(.metadata-base .extra-header) {
  padding: 0 var(--space-4) var(--space-4);
}
</style>
