<template>
  <BaseGaugeConfig
    :configData="configData"
    type="gaugeCompass"
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
    key: 'showName',
    label: '显示名称',
    kind: 'switch'
  },
  {
    key: 'backgroundColor',
    label: '背景颜色',
    kind: 'color'
  },
  {
    key: 'textColor',
    label: '文字颜色',
    kind: 'color'
  },
  {
    key: 'northColor',
    label: '北针颜色',
    kind: 'color'
  },
  {
    key: 'southColor',
    label: '南针颜色',
    kind: 'color'
  }
]
</script>
