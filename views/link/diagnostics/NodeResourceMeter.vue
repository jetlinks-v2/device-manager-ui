<template>
  <div class="node-resource-meter" :class="{ 'node-resource-meter--dense': dense }">
    <div v-if="!dense || !capacity" class="meter-caption"><span class="meter-label">{{ label }}</span><strong v-if="!dense">{{ percentage }}</strong></div>
    <div v-if="capacity" class="meter-capacity-row"><div class="meter-capacity-track" :title="`${label} · ${t('runtimeDiagnostics.usedAndTotal')}`"><a-progress :percent="percent ?? 0" :show-info="false" :stroke-width="dense ? 16 : 18" :stroke-color="capacityColor" :trail-color="token.colorFillQuaternary" /><span>{{ size(used) }} / {{ size(total) }}</span></div></div>
    <a-progress v-else :percent="percent ?? 0" :show-info="false" :stroke-width="dense ? 3 : 4" :stroke-color="color" :trail-color="token.colorFillSecondary" :aria-label="`${label} ${percentage}`" />
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { formatMemorySize } from '../../../visDashboard/SystemMonitor/utils/monitorData'
const props = defineProps({ label: { type: String, required: true }, percent: { type: Number, default: undefined }, used: { type: Number, default: undefined }, total: { type: Number, default: undefined }, capacity: { type: Boolean, default: false }, dense: { type: Boolean, default: false } })
const { t } = useI18n(), { token } = theme.useToken()
const percentage = computed(() => props.percent === undefined || !Number.isFinite(props.percent) ? '—' : `${props.percent.toFixed(1)}%`)
const color = computed(() => token.value.colorPrimary)
const capacityColor = computed(() => token.value.colorPrimaryBgHover)
const size = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : formatMemorySize(value).replace(/\s+(?=[KMGT]?B$)/, '')
</script>
<style scoped>
.node-resource-meter { min-width:0; font-variant-numeric:tabular-nums; }.meter-caption { display:flex; gap:4px; align-items:baseline; white-space:nowrap; font-size:var(--fs-caption,12px); line-height:18px; }
.meter-label { color:var(--ink-3); }.meter-caption strong { margin-inline-start:auto; }.node-resource-meter strong { font-size:var(--fs-caption,12px); font-weight:500; white-space:nowrap; }
.node-resource-meter :deep(.ant-progress) { display:block; margin:0; line-height:3px; }.node-resource-meter :deep(.ant-progress-outer) { display:block; }
.meter-capacity-row { display:flex; align-items:center; gap:4px; min-width:0; }.meter-capacity-track { position:relative; flex:1; min-width:0; }.meter-capacity-track > span { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--ink-1); white-space:nowrap; font-size:var(--fs-caption,12px); line-height:18px; }
.node-resource-meter--dense .meter-caption { font-size:var(--fs-caption,12px); line-height:17px; }.node-resource-meter--dense strong { font-size:var(--fs-caption,12px); }
</style>
