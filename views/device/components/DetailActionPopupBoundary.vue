<template>
  <Teleport to="body">
    <div ref="popupHost" class="detail-action-popup-host" />
  </Teleport>
  <a-config-provider :get-popup-container="getPopupContainer">
    <slot />
  </a-config-provider>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const popupHost = ref<HTMLDivElement>()
const getPopupContainer = (trigger?: HTMLElement) => popupHost.value ?? trigger?.ownerDocument.body ?? document.body
</script>

<style scoped>
.detail-action-popup-host {
  /* 首次定位前的浮层也不能撑大页面滚动区域。 */
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal, 1000) - 1);
  overflow: clip;
  pointer-events: none;
}

.detail-action-popup-host :deep(.ant-tooltip),
.detail-action-popup-host :deep(.ant-popover) {
  pointer-events: auto;
}
</style>
