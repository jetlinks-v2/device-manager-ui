<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { ObjectDataView } from '@jetlinks-web-core/components/ObjectOverview'
import type { ObjectCapabilityValue, ObjectPropertyMetadata } from '@jetlinks-web-core/components/ObjectOverview'
const props = defineProps<{ value?: ObjectCapabilityValue; state: 'loading' | 'ready' | 'failed' }>()
interface Snapshot { deviceId: string; metadata: ObjectPropertyMetadata; value: unknown; timestamp?: number }
const rows = computed(() => props.value?.values.flatMap(item => item.value as Snapshot[]) || [])
</script>
<template>
  <ObjectDataView v-if="state !== 'ready'" :state="state" />
  <div v-else class="object-property-snapshots">
    <article v-for="(row, index) in rows" :key="index">
      <span>{{ row.metadata.name || row.metadata.id }}</span>
      <ObjectDataView :value="row.value" :metadata="row.metadata.valueType" />
      <time v-if="row.timestamp != null" :datetime="new Date(row.timestamp).toISOString()">{{ dayjs(row.timestamp).format('MM-DD HH:mm:ss') }}</time>
    </article>
    <ObjectDataView v-if="!rows.length" />
  </div>
</template>
<style scoped>
.object-property-snapshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; }
.object-property-snapshots article { display: grid; align-content: start; gap: 6px; }.object-property-snapshots article > span { font-size: 12px; color: var(--ant-color-text-secondary, var(--ink-3)); }
.object-property-snapshots time { font-size: 11px; color: var(--ant-color-text-tertiary, var(--ink-4)); }
</style>
