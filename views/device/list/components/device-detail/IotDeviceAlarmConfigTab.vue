<template>
  <PropertyRulesPanel :scope="scope" :properties="properties" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import PropertyRulesPanel from '../../../components/PropertyRules/PropertyRulesPanel.vue'
import type { ThingModelProperty } from '../../../alarm/types'
import type { IotDevice } from '../../types'
import { useDeviceDetailPermissions } from '../../hooks/useDeviceDetailPermissions'
const props = defineProps<{ device: IotDevice; properties: ThingModelProperty[] }>()
const canAction = useDeviceDetailPermissions(computed(() => props.device))
const scope = computed(() => ({ productId: String(props.device.productId ?? ''), deviceId: props.device.id, name: props.device.name, canUpdate: canAction('update') }))
</script>
