<template>
  <PropertyRulesPanel :scope="scope" :properties="properties" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import PropertyRulesPanel from '../../../components/PropertyRules/PropertyRulesPanel.vue'
import type { ThingModelProperty } from '../../../alarm/types'
import type { IotDevice } from '../../types'
const props = defineProps<{ device: IotDevice; properties: ThingModelProperty[]; canUpdate: boolean }>()
// 更新权限由详情宿主统一解析，嵌入网关时不能改用当前路由重新推断。
const scope = computed(() => ({ productId: String(props.device.productId ?? ''), deviceId: props.device.id, name: props.device.name, canUpdate: props.canUpdate }))
</script>
