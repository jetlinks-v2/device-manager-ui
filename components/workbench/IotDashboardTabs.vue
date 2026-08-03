<template>
  <section class="dashboard-tabs" :aria-label="$t('IotWorkbench.tabs.aria')">
    <a-segmented
      v-model:value="activeView"
      class="dashboard-tabs__segmented"
      :options="segmentedOptions"
    />
    <div class="dashboard-tabs__actions">
      <span>{{ activeDesc }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DashboardViewKey } from '../useIotDeviceWorkbench'

const props = defineProps<{
  modelValue: DashboardViewKey
  views: Array<{ key: DashboardViewKey; label: string; desc: string }>
  activeDesc: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DashboardViewKey]
}>()

const segmentedOptions = computed(() => props.views.map((view) => ({
  label: view.label,
  value: view.key,
})))

const activeView = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value as DashboardViewKey),
})

const { t: $t } = useI18n()
</script>
