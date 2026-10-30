<template>
  <div ref="container" class="device-distribution-map">
    <Echarts :option="option" :events="events" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementSize } from '@vueuse/core'
import Echarts from '@jetlinks-web-core/components/Echarts/Echarts.vue'
import { buildDeviceDistributionOption } from './distribution'
import type { DeviceMapPoint } from '../shared'

const props = defineProps<{ points: DeviceMapPoint[] }>()
const emit = defineEmits<{ select: [deviceId: string] }>()
const { t } = useI18n()
const container = ref<HTMLElement>()
const { width, height } = useElementSize(container)
const option = computed(() => buildDeviceDistributionOption(props.points, {
  online: t('components.DeviceMap.online'), offline: t('components.DeviceMap.offline'),
  disabled: t('components.DeviceMap.disabled'), unknown: t('components.DeviceMap.unknownState'),
}, { width: width.value, height: height.value }))
// 地图只传回身份，选择、状态读取及详情均由原设备地图 hook 处理。
const events = { click: (params: unknown) => {
  const data = (params as { data?: DeviceMapPoint })?.data
  if (data?.deviceId) emit('select', data.deviceId)
} }
</script>

<style scoped>
.device-distribution-map { width: 100%; height: 100%; min-height: 0; border-radius: 6px; overflow: hidden; }
</style>
