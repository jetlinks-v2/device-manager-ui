<template>
  <span
    class="iot-health-tree-title"
    :class="{ 'is-device': Boolean(node.deviceId) }"
    :data-tone="node.tone"
  >
    <AIcon v-if="!node.deviceId" class="iot-health-tree-title__icon" :type="node.icon" />
    <j-ellipsis>
      <span class="iot-health-tree-title__name">{{ node.title }}</span>
    </j-ellipsis>
    <span v-if="node.deviceId" class="iot-health-tree-title__score">{{ node.score }}</span>
    <span v-else class="iot-health-tree-title__count">{{ node.count }}</span>
  </span>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import type { HealthTreeNode } from '../hooks/useIotDeviceHealthPage'

type TreeTitleNode = {
  title: string
  count: number
  tone: HealthTreeNode['tone']
  icon: string
  deviceId?: string
  score?: number
}

defineProps({
  node: {
    type: Object as PropType<TreeTitleNode>,
    required: true,
  },
})
</script>

<style scoped>
.iot-health-tree-title {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.25rem;
  color: var(--jet-theme-text-secondary);
}

.iot-health-tree-title.is-device {
  grid-template-columns: minmax(0, 1fr) auto;
  padding-left: 0.5rem;
}

.iot-health-tree-title__icon {
  color: var(--jet-theme-text-disabled);
}

.iot-health-tree-title[data-tone='danger'] .iot-health-tree-title__icon {
  color: var(--jet-theme-error);
}

.iot-health-tree-title[data-tone='warn'] .iot-health-tree-title__icon {
  color: var(--jet-theme-warning);
}

.iot-health-tree-title[data-tone='good'] .iot-health-tree-title__icon {
  color: var(--jet-theme-success);
}

.iot-health-tree-title__name {
  overflow: hidden;
  font-size: var(--fs-14);
  line-height: 1.25rem;
}

.iot-health-tree-title__count,
.iot-health-tree-title__score {
  color: var(--jet-theme-text-disabled);
  font-size: 0.8125rem;
  font-weight: 400;
  line-height: 1rem;
  text-align: center;
}

.iot-health-tree-title[data-tone='danger'] .iot-health-tree-title__count,
.iot-health-tree-title[data-tone='danger'] .iot-health-tree-title__score {
  color: var(--jet-theme-error);
}

.iot-health-tree-title[data-tone='warn'] .iot-health-tree-title__count,
.iot-health-tree-title[data-tone='warn'] .iot-health-tree-title__score {
  color: var(--jet-theme-warning);
}

.iot-health-tree-title[data-tone='good'] .iot-health-tree-title__count,
.iot-health-tree-title[data-tone='good'] .iot-health-tree-title__score {
  color: var(--jet-theme-success);
}
</style>
