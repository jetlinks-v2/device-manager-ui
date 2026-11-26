<template>
  <RemoteComponent :key="context.ownerType + ':' + context.ownerId" remote-name="rule-engine-manager-ui" component-name="MetricScopePanel" :component-props="{ context:panelContext }" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { MetricContext } from '@rule-engine-manager-ui/metric'
import RemoteComponent from '@jetlinks-web-core/components/RemoteComponent/index.vue'
import metricDimensions from '../../../metricDimensions'
const props = defineProps<{ context: MetricContext }>()
const panelContext = computed(() => ({ ...props.context,
  readScopes:props.context.readScopes || (props.context.ownerType === 'product' ? metricDimensions.product.readScopes() : props.context.ownerType === 'deviceGroup' ? metricDimensions.deviceGroup.readScopes() : undefined),
  ...(props.context.ownerType === 'product' ? { inheritance: metricDimensions.product.inheritance() } : {}) }))
</script>
