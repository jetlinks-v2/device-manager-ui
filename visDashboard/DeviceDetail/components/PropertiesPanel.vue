<template>
  <div class="detail-properties">
    <CloudEmpty v-if="!rows.length" :description="t('IotDeviceDetail.overview.emptyPropertiesHint')" />
    <template v-else>
      <div class="detail-properties__grid">
        <CardSummary v-for="metric in paged" :key="metric.id" class="detail-property" :data="{ title: metric.name }" @click="openHistory(metric)">
          <template #title>{{ metric.name }} <code>{{ metric.identifier }}</code></template>
          <template #meta><strong>{{ getPropertyDisplayValue(metric) }}<em v-if="getPropertyDisplayUnit(metric)">{{ getPropertyDisplayUnit(metric) }}</em></strong></template>
          <template #footer><small>{{ metric.updatedAt || '--' }}</small></template>
        </CardSummary>
      </div>
      <a-pagination v-if="rows.length > pageSize" v-model:current="page" size="small" :page-size="pageSize" :total="rows.length" :show-size-changer="false" show-less-items />
    </template>
    <PropertyDetail v-if="detailOpen && selected" v-model:open="detailOpen" :device-id="deviceId" :property="selected" :tone="selectedTone" />
  </div>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { CardSummary } from '@jetlinks-web-core/components'
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import { getPropertyDisplayValue, getPropertyDisplayUnit } from '../../../views/device/list/components/device-detail/iotDevicePropertyDisplay'
import type { RealtimePropertyRow } from '../shared'
const PropertyDetail = defineAsyncComponent(() => import('../../../views/device/list/components/device-detail/IotDevicePropertyDetailModal.vue'))
const props = defineProps({ rows: { type: Array as PropType<RealtimePropertyRow[]>, required: true }, deviceId: { type: String, required: true }, pageSize: { type: Number, required: true }, isEdit: Boolean })
const { t } = useI18n()
const page = ref(1), selected = ref<RealtimePropertyRow>(), detailOpen = ref(false)
const paged = computed(() => props.rows.slice((page.value - 1) * props.pageSize, page.value * props.pageSize))
const selectedTone = computed(() => selected.value?.tone === 'critical' ? 'danger' : selected.value?.tone === 'warning' ? 'warning' : selected.value?.tone === 'normal' ? 'success' : 'primary')
watch(() => props.deviceId, () => { page.value = 1; detailOpen.value = false; selected.value = undefined }, { flush: 'sync' })
watch(() => [props.rows.length, props.pageSize], () => { page.value = Math.min(page.value, Math.max(1, Math.ceil(props.rows.length / props.pageSize))) })
function openHistory(metric: RealtimePropertyRow) {
  if (props.isEdit) return
  selected.value = metric; detailOpen.value = true
}
</script>
<style scoped>
.detail-properties { display: flex; flex-direction: column; gap: var(--space-3); height: 100%; min-height: 0; overflow: auto; }
.detail-properties > :first-child { flex: 1; }
.detail-properties__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: var(--space-3); }
.detail-property { cursor: pointer; min-width: 0; }
.detail-property strong { color: var(--jet-theme-text); font-size: var(--fs-26); overflow-wrap: anywhere; }
.detail-property code, .detail-property small, .detail-property em { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); font-style: normal; }
.detail-property em { margin-left: var(--space-1); }
.detail-properties .ant-pagination { flex: 0; text-align: right; }
@container device-detail-widget (max-width: 360px) { .detail-properties__grid { grid-template-columns: 1fr; } }
</style>
