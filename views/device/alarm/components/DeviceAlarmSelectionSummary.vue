<template>
  <span ref="container" class="notification-selection" :style="naturalWidth === undefined ? undefined : { width: `${naturalWidth}px` }">
    <span class="notification-selection__text">{{ labels.length ? visibleLabels : placeholder }}</span>
    <span v-if="hiddenCount" class="notification-selection__count">+{{ hiddenCount }}</span>
    <span ref="measure" class="notification-selection__measure" aria-hidden="true">
      <span v-for="(label, index) in labels" :key="index" data-name>{{ index ? '、' : '' }}{{ label }}</span>
      <span v-for="count in labels.length" :key="`count-${count}`" data-count>+{{ count }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { useAlarmSelectionOverflow } from '../hooks/useAlarmSelectionOverflow'

const props = defineProps<{ labels: string[]; placeholder: string }>()
const { container, measure, naturalWidth, visibleLabels, hiddenCount } = useAlarmSelectionOverflow(() => props.labels)
</script>

<style scoped>
.notification-selection { position: relative; display: inline-flex; flex: 1 1 auto; align-items: center; gap: var(--space-1, 4px); min-width: 0; overflow: hidden; }
.notification-selection__text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.notification-selection__count { flex-shrink: 0; font-variant-numeric: tabular-nums; }
.notification-selection__measure { position: absolute; top: 0; left: 0; display: flex; width: max-content; visibility: hidden; white-space: nowrap; pointer-events: none; }
.notification-selection__measure > span { flex-shrink: 0; }
.notification-selection__measure > [data-count] { font-variant-numeric: tabular-nums; }
</style>
