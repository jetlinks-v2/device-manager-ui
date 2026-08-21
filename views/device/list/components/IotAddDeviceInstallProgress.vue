<template>
  <section v-if="visible" class="add-device-confirm__install-progress" :class="{ 'is-error': state.hasError }">
    <header>
      <span>
        <AIcon :type="statusIcon" aria-hidden="true" />
      </span>
      <strong>{{ statusTitle }}</strong>
      <span v-if="deviceName" class="add-device-confirm__install-device">{{ deviceName }}</span>
    </header>
    <ol v-if="state.logs.length" ref="logContainer" @scroll="onLogScroll">
      <li v-for="item in state.logs" :key="item.id" :class="logClass(item)">
        <span>{{ item.message }}</span>
      </li>
    </ol>
    <a-button v-if="unseenCount" type="link" size="small" class="add-device-confirm__install-latest" @click="scrollToLatest">
      {{ $t('IotDeviceList.add.installProgressLatest', { count: unseenCount }) }}
    </a-button>
    <p class="add-device-confirm__install-hint">
      {{ $t('IotDeviceList.add.installProgressDetailHint') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type PropType } from 'vue'
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
  deviceName: { type: String, default: '' },
})

const { t: $t } = useI18n()
const visible = computed(() => props.state.running || props.state.logs.length > 0)
const logContainer = ref<HTMLOListElement | null>(null)
const followingLatest = ref(true)
const unseenCount = ref(0)
const statusIcon = computed(() => {
  if (props.state.hasError) return 'CloseCircleOutlined'
  if (props.state.running) return 'LoadingOutlined'
  return 'CheckCircleOutlined'
})
const statusTitle = computed(() => {
  if (props.state.hasError) return $t('IotDeviceList.add.installProgressFailed')
  if (props.state.running) return $t('IotDeviceList.add.installProgressCreating')
  return $t('IotDeviceList.add.installProgressDone')
})

function logClass(item: InstallProgressLog) {
  return {
    'is-error': item.type === 'error',
  }
}

function onLogScroll() {
  const element = logContainer.value
  if (!element) return
  followingLatest.value = element.scrollHeight - element.scrollTop - element.clientHeight < 8
  if (followingLatest.value) unseenCount.value = 0
}

function scrollToLatest() {
  const element = logContainer.value
  if (!element) return
  element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  followingLatest.value = true
  unseenCount.value = 0
}

watch(() => props.state.logs.length, async (next, previous) => {
  if (next <= previous) return
  if (!followingLatest.value) {
    unseenCount.value += next - previous
    return
  }
  await nextTick()
  scrollToLatest()
})
</script>

<style scoped src="./IotAddDeviceDrawer.css"></style>
