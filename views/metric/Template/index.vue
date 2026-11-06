<template>
  <MetricTemplateManager :editable="editable" :starters="starters" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MetricTemplateManager } from '@jetlinks-web-core/components'
import { useAuthStore } from '@jetlinks-web-core/store'
import { useI18n } from 'vue-i18n'
import { createMetricStarters, starterMessages } from './starters'

const auth = useAuthStore()
const editable = computed(() => auth.hasPermission('device/MetricTemplate:save'))
const { t } = useI18n({ useScope: 'local', messages: starterMessages })
const starters = computed(() => createMetricStarters(t))
</script>
