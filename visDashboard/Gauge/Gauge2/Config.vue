<template>
  <BaseGaugeConfig
    :configData="configData"
    type="gauge2"
    :fields="fields"
  />
</template>

<script setup lang="ts">
import BaseGaugeConfig from '../components/BaseGaugeConfig.vue'
import type { GaugeConfigField } from '../shared'

defineProps<{
  configData?: Record<string, unknown>
}>()

const fields: GaugeConfigField[] = [
  {
    key: 'barHeight',
    label: '刻度高度',
    kind: 'slider',
    min: 8,
    max: 26,
    step: 1
  },
  {
    key: 'showName',
    label: '显示名称',
    kind: 'switch'
  },
  {
    key: 'coldColor',
    label: '冷端颜色',
    kind: 'color'
  },
  {
    key: 'hotColor',
    label: '热端颜色',
    kind: 'color'
  },
  {
    key: 'markerColor',
    label: '游标颜色',
    kind: 'color'
  },
  {
    key: 'titleColor',
    label: '标题颜色',
    kind: 'color'
  }
]
</script>
