<template>
  <BaseGaugeConfig
    :configData="configData"
    type="gauge1"
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
    min: 180,
    max: 260,
    step: 1
  },
  {
    key: 'gaugeWidth',
    label: '环宽',
    kind: 'slider',
    min: 8,
    max: 32,
    step: 1
  },
  {
    key: 'pointerLength',
    label: '指针长度',
    kind: 'slider',
    min: 50,
    max: 100,
    step: 1
  },
  {
    key: 'showName',
    label: '显示名称',
    kind: 'switch'
  },
  {
    key: 'color1',
    label: '冷区颜色',
    kind: 'color'
  },
  {
    key: 'centerColor',
    label: '中区颜色',
    kind: 'color'
  },
  {
    key: 'color2',
    label: '热区颜色',
    kind: 'color'
  },
  {
    key: 'pointerColor',
    label: '指针颜色',
    kind: 'color'
  }
]
</script>
