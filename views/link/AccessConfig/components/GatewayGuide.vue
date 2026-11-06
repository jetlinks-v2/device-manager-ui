<template>
  <a-collapse class="gateway-guide" ghost>
    <a-collapse-panel key="guide" :header="t('GatewayEditor.guide')"><slot /></a-collapse-panel>
  </a-collapse>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<style scoped>
.gateway-guide { min-width: 0; max-width: 100%; margin-top: var(--space-4); overflow-wrap: anywhere; }
.gateway-guide :deep(img) { max-width: 100%; }
.gateway-guide :deep(.doc) { min-width: 0; max-width: 100%; height: auto !important; overflow: visible; }
.gateway-guide :deep(pre) { max-width: 100%; white-space: pre-wrap; overflow-wrap: anywhere; }
.gateway-guide :deep(.ant-descriptions-view) { max-width: 100%; overflow-x: auto; }
.gateway-guide :deep(.ant-descriptions-view table) { table-layout: fixed; }
.gateway-guide :deep(.ant-badge-status-text) { white-space: normal; overflow-wrap: anywhere; }
</style>
