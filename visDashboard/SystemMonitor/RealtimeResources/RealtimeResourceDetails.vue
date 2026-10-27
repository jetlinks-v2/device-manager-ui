<template>
  <div class="realtime-details">
    <section v-for="group in groups" :key="group.title" class="realtime-details__group">
      <h4>{{ group.title }}</h4>
      <dl>
        <div v-for="item in group.items" :key="item.label" class="realtime-details__metric">
          <dt>{{ item.label }}</dt>
          <dd>
            <a-tooltip v-if="item.tooltip" :title="item.tooltip"><span>{{ item.value }}</span></a-tooltip>
            <span v-else>{{ item.value }}</span>
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { RealtimeDetailGroup } from '../hooks/useRealtimeResources'
defineProps<{ groups: RealtimeDetailGroup[] }>()
</script>
<style scoped lang="less">
.realtime-details {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, .7fr) minmax(0, 1.2fr);
  padding: 18px 20px;
  border-radius: var(--r-2, 6px);
  background: var(--bg-2, #f7f8fa);
  color: var(--ink-1, #1d2129);
}
.realtime-details__group { min-width: 0; padding-inline: 24px; }
.realtime-details__group:first-child { padding-left: 0; }
.realtime-details__group:last-child { padding-right: 0; }
.realtime-details__group + .realtime-details__group { border-left: 1px solid var(--line, #e9edf2); }
h4 { margin: 0 0 14px; color: inherit; font-size: 12px; line-height: 18px; font-weight: 500; }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; margin: 0; }
.realtime-details__group:nth-child(2) dl { grid-template-columns: minmax(0, 1fr); }
.realtime-details__metric { min-width: 0; }
dt { color: var(--ink-3, #86909c); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
dd { margin: 5px 0 0; color: var(--ink-1, #1d2129); font-size: 14px; line-height: 20px; font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@container realtime-resources (max-width: 1100px) {
  .realtime-details { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px 0; padding: 16px; }
  .realtime-details__group { padding-inline: 18px; }
  .realtime-details__group:nth-child(2) { padding-right: 0; }
  .realtime-details__group:last-child { grid-column: 1 / -1; padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--line, #e9edf2); }
  .realtime-details__group:last-child dl { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@container realtime-resources (max-width: 600px) {
  .realtime-details { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .realtime-details__group { padding: 0; }
  .realtime-details__group + .realtime-details__group { padding-top: 16px; border-left: 0; border-top: 1px solid var(--line, #e9edf2); }
  .realtime-details__group:nth-child(2) dl,
  .realtime-details__group:last-child dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  dl { gap: 12px 16px; }
}
</style>
