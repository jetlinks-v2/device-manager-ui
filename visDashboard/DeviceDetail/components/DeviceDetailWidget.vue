<template>
  <section class="device-detail-widget" :data-device-detail-kind="kind" :class="{ 'is-metric': isMetric }" :aria-label="title">
    <header v-if="!isMetric || loading || error || (!deviceId && !isEdit)">
      <h3>{{ title }}</h3>
      <span v-if="kind === 'Properties'">{{ t('IotDeviceDetail.overview.thingModelReadonly') }}</span>
      <span v-else-if="kind === 'RecentAlarms'">{{ t('IotDeviceDetail.overview.recentAlarmCount', { count: alarms.length }) }}</span>
    </header>
    <div v-if="!deviceId && !isEdit" class="widget-state"><CloudEmpty :image-style="isMetric ? { height: '2rem' } : undefined" :description="t('deviceDetailDashboard.selectDevice')" /></div>
    <div v-else-if="loading" class="widget-state"><a-spin /></div>
    <div v-else-if="error" class="widget-state"><CloudEmpty :image-style="isMetric ? { height: '2rem' } : undefined" :description="t('deviceDetailDashboard.loadError')"><a-button size="small" @click="retry">{{ t('deviceDetailDashboard.retry') }}</a-button></CloudEmpty></div>
    <StatPanel v-else-if="isMetric" :card="statCard" :title="config.title" />
    <MessageTrendPanel v-else-if="kind === 'MessageTrend'" :option="option" :totals="totals" :traffic="traffic" />
    <PropertiesPanel v-else-if="kind === 'Properties'" :key="identity" :rows="properties" :device-id="deviceId" :page-size="config.pageSize" :is-edit="isEdit" />
    <AlarmsPanel v-else :rows="alarms" />
  </section>
</template>
<script setup lang="ts">
import { computed, toRef, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import { titleKeys, type DeviceDetailKind, type DeviceDetailInfo } from '../shared'
import { useDeviceDetailWidget } from '../hooks/useDeviceDetailWidget'
import { useSummaryPresentation } from '../hooks/useSummaryPresentation'
import StatPanel from './StatPanel.vue'
import MessageTrendPanel from './MessageTrendPanel.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import AlarmsPanel from './AlarmsPanel.vue'
const props = defineProps({ kind: { type: String as PropType<DeviceDetailKind>, required: true }, info: Object as PropType<DeviceDetailInfo>, isEdit: Boolean })
const { t } = useI18n()
const { config, deviceId, identity, summary, alarms, properties, loading, error, retry } = useDeviceDetailWidget(props.kind, toRef(props, 'info'), toRef(props, 'isEdit'))
const { cards, totals, traffic, option } = useSummaryPresentation(summary)
const isMetric = computed(() => ['ActiveDuration', 'Upstream', 'Downstream', 'Traffic'].includes(props.kind))
const statCard = computed(() => cards.value[props.kind as keyof typeof cards.value])
const title = computed(() => config.value.title || t(titleKeys[props.kind]))
</script>
<style scoped>
.device-detail-widget { display: flex; flex-direction: column; gap: var(--space-3); box-sizing: border-box; width: 100%; height: 100%; min-height: 0; padding: var(--space-4); border: 1px solid var(--jet-theme-border-color-1); border-radius: var(--r-3); background: var(--jet-theme-bg-container); color: var(--jet-theme-text); container: device-detail-widget / inline-size; overflow: hidden; }
.device-detail-widget > :last-child { flex: 1; min-height: 0; }
.device-detail-widget header { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
.device-detail-widget h3 { margin: 0; font-size: var(--fs-16); font-weight: 500; }
.device-detail-widget header span { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.device-detail-widget.is-metric { overflow: auto; }
.widget-state { display: grid; place-items: center; overflow: auto; }
</style>
