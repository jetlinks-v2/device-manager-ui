<template>
  <span class="pill" :class="`pill--${pillTone}`">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
/**
 * IotDeviceStatusPill —— 走全局 .pill + .pill--{tone} 原语（A8 · 决议见 P40 + 宪法）。
 *
 * tone 映射：
 *   - ok   → 在线 / 正常
 *   - warn → 观察 / 无数据 / warning
 *   - err  → 离线 / 告警中 / 紧急 / critical
 *   - info → 维护中（仅 healthStatus 用得到）
 *   - muted → 停用 / stale 数据
 *
 * 输入可二选一：传 status / risk / 直接传 label + tone（自由文本场景）。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIotDeviceMeta } from '../hooks/useIotDeviceMeta'
import type { IotDeviceRisk, IotDeviceStatus, IotTelemetryStatus } from '../types'

const props = defineProps<{
  label?: string
  tone?: 'ok' | 'warn' | 'err' | 'info' | 'muted'
  status?: IotDeviceStatus | IotTelemetryStatus
  risk?: IotDeviceRisk
}>()

const { statusMeta, riskMeta, telemetryMeta } = useIotDeviceMeta()
const { t: $t } = useI18n()

const meta = computed(() => {
  if (props.label && props.tone) return { label: props.label, tone: props.tone }
  if (props.risk) return riskMeta(props.risk)
  if (props.status && ['normal', 'warning', 'critical', 'stale'].includes(props.status)) {
    return telemetryMeta(props.status as IotTelemetryStatus)
  }
  if (props.status) return statusMeta(props.status as IotDeviceStatus)
  return { label: props.label ?? $t('IotDeviceDetail.commandMeta.status.unknown'), tone: 'muted' as const }
})

const label = computed(() => props.label ?? meta.value.label)
const pillTone = computed(() => meta.value.tone)
</script>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: max-content;
  min-width: max-content;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  height: 1.375rem;
  padding: 0 var(--space-3);
  border: var(--jet-theme-stroke-width) solid transparent;
  border-radius: 62.4375rem;
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.pill::before {
  flex: 0 0 auto;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 62.4375rem;
  background: currentColor;
  content: '';
}

.pill--ok {
  background: color-mix(in srgb, var(--jet-theme-success) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-success);
}

.pill--warn {
  background: color-mix(in srgb, var(--jet-theme-warning) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-warning);
}

.pill--err {
  background: color-mix(in srgb, var(--jet-theme-error) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-error);
}

.pill--info {
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}

.pill--muted {
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-disabled);
}
</style>
