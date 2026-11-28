<script setup lang="ts">
import dayjs from 'dayjs'
import { ObjectDataView } from '@jetlinks-web-core/components/ObjectOverview'
import type { ObjectPropertyMetadata } from '@jetlinks-web-core/components/ObjectOverview'
interface Snapshot { deviceId: string; metadata: ObjectPropertyMetadata; value: unknown; timestamp?: number }
defineProps<{ value: Snapshot }>()
</script>
<template>
  <div class="object-property-snapshots">
    <article>
      <span>{{ value.metadata.name || value.metadata.id }}</span>
      <ObjectDataView :value="value.value" :metadata="value.metadata.valueType" />
      <time v-if="value.timestamp != null" :datetime="new Date(value.timestamp).toISOString()">{{ dayjs(value.timestamp).format('MM-DD HH:mm:ss') }}</time>
    </article>
  </div>
</template>
<style scoped>
.object-property-snapshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
.object-property-snapshots article { display: grid; align-content: start; gap: 6px; }.object-property-snapshots article > span { font-size: 12px; color: var(--ant-color-text-secondary, var(--ink-3)); }
.object-property-snapshots time { font-size: 11px; color: var(--ant-color-text-tertiary, var(--ink-4)); }
</style>
