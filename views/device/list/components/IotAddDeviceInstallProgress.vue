<template>
  <section v-if="visible" class="add-device-confirm__install-progress" :class="{ 'is-error': state.hasError }">
    <header>
      <span>
        <AIcon :type="statusIcon" aria-hidden="true" />
      </span>
      <strong>{{ statusTitle }}</strong>
    </header>
    <ol>
      <li v-for="item in visibleLogs" :key="item.id" :class="logClass(item)">
        <span>{{ item.message }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

type InstallProgressLog = {
  id: string
  type: string
  message: string
}

type InstallProgressState = {
  logs: InstallProgressLog[]
  running: boolean
  hasError: boolean
}

const props = defineProps({
  state: {
    type: Object as PropType<InstallProgressState>,
    default: () => ({
      logs: [],
      running: false,
      hasError: false,
    }),
  },
})

const { t: $t } = useI18n()
const visible = computed(() => props.state.logs.length > 0)
const visibleLogs = computed(() => props.state.logs.slice(-8))
const statusIcon = computed(() => {
  if (props.state.hasError) return 'CloseCircleOutlined'
  if (props.state.running) return 'LoadingOutlined'
  return 'CheckCircleOutlined'
})
const statusTitle = computed(() => {
  if (props.state.hasError) return $t('IotDeviceList.add.installProgressFailed')
  if (props.state.running) return $t('IotDeviceList.add.installProgressRunning')
  return $t('IotDeviceList.add.installProgressDone')
})

function logClass(item: InstallProgressLog) {
  return {
    'is-error': item.type === 'error',
  }
}
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
