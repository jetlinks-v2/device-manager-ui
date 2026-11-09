<template>
  <a-modal
    :open="true"
    :width="type ? 'min(920px, calc(100vw - 24px))' : 'min(1200px, calc(100vw - 24px))'"
    :centered="type"
    :style="type ? undefined : { top: '12px' }"
    :footer="type ? null : undefined"
    :mask-closable="false"
    :body-style="{ padding: '0' }"
    class="gateway-editor-modal"
    @cancel="cancelEditor"
  >
    <template #title>
      <div class="gateway-editor-title">
        <span>{{ type ? $t('GatewayEditor.selectMethod') : $t(id === ':id' ? 'GatewayEditor.createTitle' : 'GatewayEditor.editTitle') }}</span>
        <a-tag v-if="!type && titleProvider?.name" color="blue">{{ titleProvider.name }}</a-tag>
      </div>
    </template>
    <template v-if="!type" #footer>
      <div ref="footerHost" class="gateway-editor-footer" />
    </template>
    <a-spin :spinning="loading">
      <div v-if="type && id === ':id'">
        <component :is="components.provider" :dataSource="dataSource" @onClick="goProviders" />
      </div>
      <div v-else class="gateway-editor-body">
        <component
          v-if="showType && provider?.id"
          :is="activeComponent"
          :data="data"
          :provider="provider"
          :bindProduct="provider.id === `composite-device-gateway` ? undefined : bindProduct"
          :otherProvider="provider.id === `composite-device-gateway` ? compositeProvider : undefined"
        />
      </div>
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { useGatewayDetail } from './useGatewayDetail';
const editor = useGatewayDetail();
const {
  $t, id, components, dataSource, type, loading, provider, data, showType, bindProduct, footerHost, titleProvider, activeComponent,
  goProviders, cancelEditor, compositeProvider
} = editor;
</script>

<style lang="less" scoped>
.gateway-editor-body { min-height: 22rem; }
.gateway-editor-footer { min-height: 2rem; }
.gateway-editor-title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); padding-bottom: var(--space-2); }
.gateway-editor-title :deep(.ant-tag) { border: 0; border-radius: var(--r-3); font-size: var(--fs-12); font-weight: 400; }
</style>
