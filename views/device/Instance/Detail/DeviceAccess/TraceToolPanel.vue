<template>
  <div class="trace-tool-panel">
    <TraceDebugPanel @trace-match="(traceId) => emit('trace-match', traceId)" />
  </div>
</template>

<script setup lang="ts">
import TraceDebugPanel from './TraceDebugPanel.vue'

const emit = defineEmits<{
  (e: 'trace-match', traceId: string): void
}>()
</script>

<style scoped lang="less">
.trace-tool-panel {
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
