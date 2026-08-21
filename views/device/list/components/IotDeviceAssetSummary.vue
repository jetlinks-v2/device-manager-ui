<template>
  <MetricCards :items="items" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { MetricCards, type MetricCardItem } from '@jetlinks-web-core/components'
import type { DeviceGroupSummary } from '@device-manager-ui/api/deviceGroup'

const props = defineProps<{
  summary?: DeviceGroupSummary
}>()

const { t: $t } = useI18n()

const items = computed<MetricCardItem[]>(() => [
  {
    key: 'total',
    label: $t('IotDeviceList.summary.total'),
    value: props.summary?.deviceCount ?? '--',
    icon: 'ApiOutlined',
  },
  {
    key: 'online',
    label: $t('IotDeviceList.summary.online'),
    value: props.summary?.online ?? '--',
    icon: 'CheckCircleOutlined',
    iconColor: 'var(--jet-theme-success)',
  },
  {
    key: 'offline',
    label: $t('IotDeviceList.summary.offline'),
    value: props.summary?.offline ?? '--',
    icon: 'DisconnectOutlined',
    iconColor: 'var(--jet-theme-text-disabled)',
  },
])
</script>
