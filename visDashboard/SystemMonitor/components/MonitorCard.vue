<template>
  <a-card class="monitor-card" :bordered="false" :body-style="{ padding: '20px' }">
    <header class="monitor-card__header"><h3>{{ title }}</h3><slot name="controls" /></header>
    <div v-if="state.loading" class="monitor-card__state"><a-spin /></div>
    <div v-else-if="state.error" class="monitor-card__state" role="alert">
      <CloudEmpty :description="$t('components.SystemMonitor.loadError')">
        <a-button @click="$emit('retry')">{{ $t('components.SystemMonitor.retry') }}</a-button>
      </CloudEmpty>
    </div>
    <div v-else-if="state.empty" class="monitor-card__state"><CloudEmpty :description="$t('components.SystemMonitor.empty')" /></div>
    <div v-else class="monitor-card__content"><slot /></div>
    <slot name="footer" />
  </a-card>
</template>
<script setup lang="ts">
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import type { PropType } from 'vue'
import type { MonitorState } from '../types'
defineProps({ title: { type: String, required: true }, state: { type: Object as PropType<MonitorState>, required: true } })
defineEmits<{ retry: [] }>()
</script>
<style scoped lang="less">
.monitor-card { height: 100%; min-width: 0; overflow: hidden; border-radius: var(--r-3, 8px); background: var(--bg, #fff); box-shadow: 0 1px 3px rgb(31 35 41 / 4%); }
.monitor-card :deep(.ant-card-body) { display: flex; flex-direction: column; gap: var(--space-4, 16px); height: 100%; min-height: 0; overflow: auto; }
.monitor-card :deep(.ant-card-body::before), .monitor-card :deep(.ant-card-body::after) { display: none; }
.monitor-card__header { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3, 12px); flex: none; min-width: 0; }
.monitor-card__header h3 { margin: 0; font-size: var(--fs-18, 18px); line-height: 22px; font-weight: 600; }
.monitor-card__state { flex: 1; min-height: 80px; display: grid; place-items: center; }
.monitor-card__content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
</style>
