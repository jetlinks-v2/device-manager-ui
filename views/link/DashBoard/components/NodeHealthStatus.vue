<template>
  <a-tooltip v-if="health.evidence.length">
    <template #title>
      <div class="node-health__tooltip-title">{{ $t(`components.RealtimeResource.health.${health.level}`) }}</div>
      <div v-for="item in health.evidence" :key="`${item.signal}-${item.values.join('-')}`">
        {{ evidenceText(item) }}
      </div>
    </template>
    <span class="node-health" :class="`node-health--${health.level}`">
      <AIcon :type="health.level === 'critical' ? 'CloseCircleFilled' : 'ExclamationCircleFilled'" />
      {{ summary }}
    </span>
  </a-tooltip>
</template>

<script lang="ts" setup name="NodeHealthStatus">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NodeHealthEvidence, NodeHealthSummary } from './nodeHealthData'

const props = defineProps({
  health: { type: Object as PropType<NodeHealthSummary>, required: true },
})
const { t } = useI18n()
const summary = computed(() => t('components.RealtimeResource.health.summary', [
  t(`components.RealtimeResource.health.${props.health.level}`),
  props.health.evidence.length,
]))
const evidenceText = (item: NodeHealthEvidence) => t(
  `components.RealtimeResource.health.signal.${item.signal}`,
  item.values,
)
</script>

<style lang="less" scoped>
.node-health { display: inline-flex; align-items: center; gap: 0.25rem; max-width: 100%; margin-left: 1rem; padding: 0 0.375rem; border-radius: 0.625rem; font-size: 0.6875rem; line-height: 1.25rem; white-space: nowrap; }
.node-health--warning { color: #ad6800; background: #fff7e6; }
.node-health--critical { color: #cf1322; background: #fff1f0; }
.node-health__tooltip-title { margin-bottom: 0.25rem; font-weight: 600; }
</style>
