<template>
  <FullPage flex transparent-background>
    <ContentPanel class="device-batch-page">
      <a-flex align="center" :gap="16" class="device-batch-page__header">
        <a-button type="link" @click="back"><AIcon type="ArrowLeftOutlined" />{{ t('UnifiedDeviceList.title') }}</a-button>
        <strong>{{ t('UnifiedDeviceList.batch') }}</strong>
        <a-segmented v-if="tabs.length" v-model:value="activeKey" :options="tabs.map(tab => ({ value: tab.code, label: tab.extraOptions?.label }))" />
      </a-flex>
      <KeepAlive>
        <component
          v-if="active?.component"
          :is="active.component"
          :key="active.code"
          v-bind="active.props"
          class="device-batch-page__content"
        />
      </KeepAlive>
      <CloudEmpty v-if="!active?.component" :description="t('UnifiedDeviceList.noBatchAccess')" />
    </ContentPanel>
  </FullPage>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useMenuStore } from '@jetlinks-web-core/store'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
const { t } = useI18n()
const route = useRoute()
const menu = useMenuStore()
const auth = useAuthStore()
// 各模块注册页签、完整业务组件及所属权限，宿主不依赖具体批量业务实现。
const tabs = computed(() => componentsRegistry.getRegistry('device-list-batch:tabs')
  .filter(tab => (
    tab.component
    && (!tab.extraOptions?.permission || auth.hasPermission(tab.extraOptions.permission))
    && (!tab.extraOptions?.menuCode || menu.hasMenu(tab.extraOptions.menuCode))
  ))
  .sort((a, b) => (a.order || 0) - (b.order || 0)))
const activeKey = ref('')
watch(tabs, items => { if (!items.some(item => item.code === activeKey.value)) activeKey.value = items[0]?.code || '' }, { immediate: true })
const active = computed(() => tabs.value.find(tab => tab.code === activeKey.value))
function back() {
  const { gatewayIds: _ids, gatewayScope: _scope, ...query } = route.query
  menu.jumpPage('iot-user-device-list', { query })
}
</script>
<style scoped>
.device-batch-page { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.device-batch-page__header { flex-shrink: 0; margin-bottom: var(--space-4); }
.device-batch-page__content { flex: 1; min-height: 0; }
</style>
