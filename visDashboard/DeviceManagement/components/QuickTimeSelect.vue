<template>
  <div class="quick-time-select">
    <a-radio-group
      v-if="quickBtn"
      v-model:value="activeType"
      button-style="solid"
      @change="onShortcutChange"
    >
      <a-radio-button
        v-for="item in shortcutOptions"
        :key="item.value"
        :value="item.value"
      >
        {{ item.label }}
      </a-radio-button>
    </a-radio-group>

    <a-range-picker
      v-model:value="rangeValue"
      class="range-picker"
      format="YYYY-MM-DD HH:mm:ss"
      valueFormat="YYYY-MM-DD HH:mm:ss"
      :show-time="{ format: 'HH:mm:ss' }"
      :allowClear="false"
      @change="onRangeChange"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { TimeRangePayload, TimeShortcut } from '../shared'
import { getShortcutRange } from '../services/dashboardMetrics'

const props = withDefaults(
  defineProps<{
    quickBtn?: boolean
    defaultType?: TimeShortcut
  }>(),
  {
    quickBtn: true,
    defaultType: 'week'
  }
)

const emit = defineEmits<{
  (e: 'change', value: TimeRangePayload): void
}>()

const shortcutOptions = [
  { label: '今日', value: 'hour' },
  { label: '昨日', value: 'day' },
  { label: '近一周', value: 'week' }
]

const activeType = ref<TimeShortcut>(props.defaultType)
const rangeValue = ref<[string, string]>()

const applyRange = (range: TimeRangePayload) => {
  rangeValue.value = [
    dayjs(range.start).format('YYYY-MM-DD HH:mm:ss'),
    dayjs(range.end).format('YYYY-MM-DD HH:mm:ss')
  ]
  emit('change', range)
}

const onShortcutChange = () => {
  applyRange(getShortcutRange(activeType.value))
}

const onRangeChange = (value: [string, string] | null) => {
  if (!value) {
    return
  }

  emit('change', {
    start: dayjs(value[0]).valueOf(),
    end: dayjs(value[1]).valueOf()
  })
}

watch(
  () => props.defaultType,
  (value) => {
    activeType.value = value
    applyRange(getShortcutRange(value))
  },
  { immediate: true }
)
</script>

<style scoped lang="less">
.quick-time-select {
  display: flex;
  align-items: center;
}

.range-picker {
  margin-left: 12px;
}
</style>
