<template>
  <MetricPanel :key="context.ownerType + ':' + context.ownerId" :context="panelContext" :initial-reference="initialReference" :pick-source="picker.pickSource" :detail-link-label="links.workspaceEnabled.value ? t('DeviceMetrics.openWorkspace') : undefined" @create-alarm="createAlarm" @open-detail-link="links.openWorkspace" />
  <component :is="picker.host" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MetricPanel, type MetricContext, type MetricAlarmReference } from '@jetlinks-web-core/components'
import { useMetricSourceAdapter } from './useMetricSourceAdapter'
import { useMetricLinks } from './useMetricLinks'
import { metricReferenceFromQuery } from './metricLocation'
const props = defineProps<{ context: MetricContext }>()
const emit = defineEmits<{ createAlarm: [reference: MetricAlarmReference] }>()
const { t } = useI18n()
const picker = useMetricSourceAdapter(computed(() => props.context))
const links = useMetricLinks()
const route = useRoute()
const initialReference = computed(() => metricReferenceFromQuery(route.query, props.context))
const panelContext = computed(() => ({ ...props.context, alarmEnabled: links.alarmEnabled.value }))
function createAlarm(reference: MetricAlarmReference) {
  emit('createAlarm', reference)
  links.createAlarm(reference)
}
</script>
