<template>
  <MetricTemplateManager :editable="editable" :starters="iotMetricStarters" :pick-source="source.pickSource" :source-context="sourceContext" :apply-template="applyTemplate" />
  <component :is="source.host" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MetricTemplateManager, type MetricContext } from '@jetlinks-web-core/components'
import { useMetricSourceAdapter } from '../../device/metrics/useMetricSourceAdapter'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useProjectRouter } from '@jetlinks-web-core/hooks'
import { iotMetricStarters } from './starters'

const auth = useAuthStore()
const editable = computed(() => auth.hasPermission('device/MetricTemplate:save'))
const sourceContext = ref<MetricContext>({ownerType:'device',ownerId:'',targetType:'device'})
const source = useMetricSourceAdapter(sourceContext)
const router = useProjectRouter()
function applyTemplate(template:{id:string;version:string}) {
  void router.push({path:'/rule-engine/metrics',query:{metricApplyTemplate:template.id,metricApplyVersion:template.version}})
}
</script>
