<template>
  <span v-if="error && !keyRecycled">{{ t('AMapComponent.AMap.errorGuide') }}</span>
  <div v-else>
    <div v-if="error">{{ t('components.DeviceMap.recycledKeyGuide') }}</div>
    <a-button v-if="canConfigure" type="link" @click="$emit('configure')">{{ t('components.DeviceMap.openConfig') }}</a-button>
    <span v-else>{{ t('components.DeviceMap.contactAdmin') }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ canConfigure: boolean; error?: { kind: string; code?: string; info?: string } }>()
defineEmits<{ configure: [] }>()
const { t } = useI18n()
// 只有明确的 Key 删除错误提供配置指引，其余失败保留地图的默认说明。
const keyRecycled = computed(() => props.error && ['sdk', 'map'].includes(props.error.kind)
  && (props.error.code === '10013' || props.error.info?.trim().toUpperCase() === 'USER_KEY_RECYCLED'))
</script>
