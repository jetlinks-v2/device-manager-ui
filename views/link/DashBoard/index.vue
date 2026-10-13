<template>
  <main class="infrastructure-dashboard">
    <div v-if="loading" class="infrastructure-dashboard__state"><a-spin /></div>
    <a-result v-else-if="errors.length" status="error" :title="$t('components.SystemMonitor.loadError')">
      <template #extra><a-button @click="reload">{{ $t('components.SystemMonitor.retry') }}</a-button></template>
    </a-result>
    <DashBoardCanvas v-else :model-value="dashboard" :catalog="catalog"
      :editable="false" :layout-editable="true" :preview-mode="false" storage-key="infrastructure-dashboard" />
  </main>
</template>
<script setup lang="ts" name="DashBoardPage">
import { DashBoardCanvas } from '@jetlinks-web-core/components/DashBoardCanvas'
import { useInfrastructureDashboard } from './useInfrastructureDashboard'
const { catalog, loading, errors, reload, dashboard } = useInfrastructureDashboard()
</script>
<style scoped>
.infrastructure-dashboard { width: 100%; min-width: 0; padding-bottom: var(--space-4, 16px); }
.infrastructure-dashboard__state { min-height: 30rem; display: grid; place-items: center; }
.infrastructure-dashboard :deep(.dashboard-card-layout),
.infrastructure-dashboard :deep(.dashboard-card-content) { height: auto; overflow: visible; }
.infrastructure-dashboard :deep(.dashboard-card-content) { scrollbar-gutter: auto; }
.infrastructure-dashboard :deep(.dashboard-grid) { min-height: 0; }
</style>
