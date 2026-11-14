<template>
  <MetricScopePanel :key="context.ownerType + ':' + context.ownerId" :context="panelContext" :initial-reference="initialReference" :pick-source="picker.pickSource" :detail-link-label="links.workspaceEnabled.value ? t('DeviceMetrics.openWorkspace') : undefined" @open-detail-link="links.openWorkspace" />
  <component :is="picker.host" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MetricScopePanel, type MetricContext } from '@jetlinks-web-core/components'
import { useMetricSourceAdapter } from './useMetricSourceAdapter'
import { useMetricLinks } from './useMetricLinks'
import { metricReferenceFromQuery } from '@jetlinks-web-core/components/Metric/location'
import metricDimensions from '../../../metricDimensions'
const props = defineProps<{ context: MetricContext }>()
const { t } = useI18n()
const picker = useMetricSourceAdapter(computed(() => props.context))
const links = useMetricLinks()
const route = useRoute()
const initialReference = computed(() => metricReferenceFromQuery(route.query, props.context))
const panelContext = computed(() => ({ ...props.context,
  readScopes:props.context.readScopes || (props.context.ownerType === 'product' ? metricDimensions.product.readScopes() : props.context.ownerType === 'deviceGroup' ? metricDimensions.deviceGroup.readScopes() : undefined),
  ...(props.context.ownerType === 'product' ? { inheritance: metricDimensions.product.inheritance() } : {}) }))
</script>
