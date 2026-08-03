<template>
  <div class="property-time-filter">
    <a-radio-group :value="activeShortcut" button-style="solid" @change="onShortcutChange">
      <a-radio-button value="today">{{ $t('IotDeviceDetail.timeFilter.today') }}</a-radio-button>
      <a-radio-button value="week">{{ $t('IotDeviceDetail.timeFilter.week') }}</a-radio-button>
      <a-radio-button value="month">{{ $t('IotDeviceDetail.timeFilter.month') }}</a-radio-button>
    </a-radio-group>
    <a-range-picker
      v-model:value="dateValue"
      show-time
      :allow-clear="false"
      :placeholder="[$t('IotDeviceDetail.timeFilter.start'), $t('IotDeviceDetail.timeFilter.end')]"
      @change="onRangeChange"
    />
  </div>
</template>

<script setup lang="ts">
import dayjs, { type Dayjs } from 'dayjs'
import { onMounted, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

type RangeValue = [Dayjs, Dayjs] | undefined
type ShortcutKey = 'today' | 'week' | 'month' | ''

const props = defineProps({
  modelValue: {
    type: Object as PropType<RangeValue>,
    default: undefined,
  },
})

const emit = defineEmits<{
  'update:modelValue': [value: RangeValue]
}>()

const { t: $t } = useI18n()
const activeShortcut = ref<ShortcutKey>('today')
const dateValue = ref<RangeValue>()

function getShortcutRange(type: ShortcutKey): RangeValue {
  const end = dayjs()
  if (type === 'today') return [dayjs().startOf('day'), end]
  if (type === 'week') return [dayjs().subtract(6, 'days'), end]
  if (type === 'month') return [dayjs().subtract(30, 'days'), end]
  return undefined
}

function onShortcutChange(event: any) {
  const value = event?.target?.value as ShortcutKey
  activeShortcut.value = value
  emit('update:modelValue', getShortcutRange(value))
}

function onRangeChange(value: RangeValue) {
  activeShortcut.value = ''
  emit('update:modelValue', value)
}

onMounted(() => {
  if (!props.modelValue) {
    emit('update:modelValue', getShortcutRange('today'))
  }
})

watch(
  () => props.modelValue,
  (value) => {
    dateValue.value = value
  },
  { immediate: true },
)
</script>

<style scoped>
.property-time-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
