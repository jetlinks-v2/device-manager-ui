<template>
  <span v-if="loading" class="plugin-runtime-loading" role="status" :aria-label="t('pluginRuntime.loadingState')"><a-skeleton-input active size="small" /></span>
  <span v-else class="plugin-runtime-status" :style="{ color }">
    <slot name="icon" :icon="icon"><AIcon class="plugin-runtime-status__icon" :type="icon" aria-hidden="true" /></slot>
    <span class="plugin-runtime-status__label">{{ t(`pluginRuntime.${status.state}`) }}</span>
    <span v-if="status.ready" class="plugin-runtime-count">{{ t('pluginRuntime.effectiveNodes', { count: status.ready }) }}</span>
    <a-tooltip v-if="status.uncertain" :title="t('pluginRuntime.incomplete')"><AIcon class="plugin-runtime-status__icon" type="ClockCircleOutlined" /></a-tooltip>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import type { pluginAvailability } from './runtimeState'
const props = defineProps<{ status: ReturnType<typeof pluginAvailability>; loading?: boolean }>()
const { t } = useI18n()
const { token } = theme.useToken()
const icon = computed(() => ({ available: 'CheckCircleOutlined', partial: 'ExclamationCircleOutlined', pending: 'LoadingOutlined', unavailable: 'CloseCircleOutlined', unknown: 'QuestionCircleOutlined', previous: 'HistoryOutlined' })[props.status.state])
const color = computed(() => ({ available: token.value.colorSuccess, partial: token.value.colorWarning,
  previous: token.value.colorWarning, unavailable: token.value.colorError,
  pending: token.value.colorTextTertiary, unknown: token.value.colorTextTertiary })[props.status.state])
</script>
<style scoped>
.plugin-runtime-status { display:inline-flex; align-items:center; gap:calc(var(--space-3) / 2); min-width:0; max-width:100%; font-size:var(--fs-12,12px); line-height:18px; }
.plugin-runtime-status__icon { flex:none; font-size:12px; }
.plugin-runtime-status__label { min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.plugin-runtime-count { color:var(--ink-3); font-size:inherit; white-space:nowrap; }
.plugin-runtime-loading { display:inline-flex; align-items:center; width:120px; height:18px; overflow:hidden; border-radius:var(--r-1); }
</style>
