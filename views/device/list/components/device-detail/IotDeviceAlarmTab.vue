<template>
  <section class="device-alarm-tab">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane key="records" :tab="$t('DeviceAlarm.detail.records')">
        <IotDeviceAlarmsTab
          ref="recordsRef"
          :device="device"
        />
      </a-tab-pane>
      <a-tab-pane key="config" :tab="$t('DeviceAlarm.detail.config')">
        <IotDeviceAlarmConfigTab :device="device" :properties="properties" />
      </a-tab-pane>
    </a-tabs>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import IotDeviceAlarmsTab from './IotDeviceAlarmsTab.vue'
import IotDeviceAlarmConfigTab from './IotDeviceAlarmConfigTab.vue'
import type { IotDevice, IotDeviceTodo } from '../../types'

defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  properties: { type: Array as PropType<any[]>, default: () => [] },
  todos: { type: Array as PropType<IotDeviceTodo[]>, default: () => [] },
  busyId: { type: String, default: '' },
  hasRelatedRules: { type: Boolean, default: false },
})

const { t: $t } = useI18n()
const activeKey = ref('records')
const recordsRef = ref<InstanceType<typeof IotDeviceAlarmsTab> | null>(null)

watch(activeKey, (key) => {
  if (key === 'config') {
    recordsRef.value?.resetSearch()
  }
})
</script>

<style scoped>
.device-alarm-tab {
  display: grid;
  min-width: 0;
}
</style>
