<template>
  <RemoteComponent :key="context.ownerType + ':' + context.ownerId" remote-name="rule-engine-manager-ui" component-name="MetricScopePanel" :component-props="{ context:panelContext, detailLinkLabel:links.workspaceEnabled.value ? t('DeviceMetrics.openWorkspace') : undefined }" :component-events="{ openDetailLink:links.openWorkspace }" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MetricContext } from '@rule-engine-manager-ui/metric'
import RemoteComponent from '@jetlinks-web-core/components/RemoteComponent/index.vue'
import { useMetricLinks } from './useMetricLinks'
import metricDimensions from '../../../metricDimensions'
const props = defineProps<{ context: MetricContext }>()
const { t } = useI18n()
const links = useMetricLinks()
const panelContext = computed(() => ({ ...props.context,
  readScopes:props.context.readScopes || (props.context.ownerType === 'product' ? metricDimensions.product.readScopes() : props.context.ownerType === 'deviceGroup' ? metricDimensions.deviceGroup.readScopes() : undefined),
  ...(props.context.ownerType === 'product' ? { inheritance: metricDimensions.product.inheritance() } : {}) }))
</script>
