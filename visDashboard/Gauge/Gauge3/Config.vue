<template>
  <BaseGaugeConfig
    :configData="configData"
    type="gauge3"
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
    key: 'arcAngle',
    label: '仪表弧度',
    kind: 'slider',
    min: 220,
    max: 300,
    step: 1
  },
  {
    key: 'gaugeWidth',
    label: '环宽',
    kind: 'slider',
    min: 8,
    max: 24,
    step: 1
  },
  {
    key: 'showName',
    label: '显示名称',
    kind: 'switch'
  },
  {
    key: 'progressColor',
    label: '高值颜色',
    kind: 'color'
  },
  {
    key: 'pointerColor',
    label: '指针颜色',
    kind: 'color'
  },
  {
    key: 'backgroundColor',
    label: '背景颜色',
    kind: 'color'
  }
]
</script>
