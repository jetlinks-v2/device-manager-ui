<template>
  <span
    class="pill"
    :class="[
      `pill--${pillTone}`,
      {
        'pill--risk': variant === 'risk',
        'pill--risk-ok': variant === 'risk' && pillTone === 'ok',
        'pill--risk-alert': variant === 'risk' && pillTone !== 'ok',
      },
    ]"
  >
    <AIcon v-if="variant === 'risk'" class="pill__risk-icon" :type="riskIcon" aria-hidden="true" />
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
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import { useIotDeviceMeta } from '../hooks/useIotDeviceMeta'
import type { IotDeviceRisk, IotDeviceStatus, IotTelemetryStatus } from '../types'

const props = defineProps({
  label: {
    type: String,
    default: undefined,
  },
  tone: {
    type: String as PropType<'ok' | 'warn' | 'err' | 'info' | 'muted'>,
    default: undefined,
  },
  status: {
    type: String as PropType<IotDeviceStatus | IotTelemetryStatus>,
    default: undefined,
  },
  risk: {
    type: String as PropType<IotDeviceRisk>,
    default: undefined,
  },
  variant: {
    type: String as PropType<'status' | 'risk'>,
    default: 'status',
  },
})

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
const riskIcon = computed(() => (
  pillTone.value === 'ok' ? 'CheckCircleFilled' : 'ExclamationCircleFilled'
))
</script>

<style scoped>
.pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  width: max-content;
  min-width: max-content;
  min-height: 1.5rem;
  box-sizing: border-box;
  padding: var(--space-1) var(--space-3);
  border: var(--jet-theme-stroke-width) solid transparent;
  border-radius: 62.4375rem;
  background: var(--jet-theme-bg-container);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  font-variant-numeric: tabular-nums;
  line-height: 1rem;
  white-space: nowrap;
}

.pill--ok {
  border-color: color-mix(in srgb, var(--jet-theme-success) 20%, transparent);
  background: color-mix(in srgb, var(--jet-theme-success) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-success);
}

.pill--warn {
  border-color: color-mix(in srgb, var(--jet-theme-warning) 20%, transparent);
  background: color-mix(in srgb, var(--jet-theme-warning) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-warning);
}

.pill--err {
  border-color: color-mix(in srgb, var(--jet-theme-error) 20%, transparent);
  background: color-mix(in srgb, var(--jet-theme-error) 12%, var(--jet-theme-bg-container));
  color: var(--jet-theme-error);
}

.pill--info {
  border-color: color-mix(in srgb, var(--jet-theme-primary) 20%, transparent);
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}

.pill--muted {
  border-color: var(--jet-theme-border-secondary);
  background: var(--bg-hover);
  color: var(--jet-theme-text-disabled);
}

.pill--risk {
  gap: 0.125rem;
  min-height: 1.5rem;
  padding: 0.25rem 0.625rem;
  border: 0;
  border-radius: 0.6875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1rem;
}

.pill--risk-ok {
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}

.pill--risk-alert {
  background: var(--warn-bg);
  color: var(--jet-theme-warning);
}

.pill__risk-icon {
  flex: 0 0 auto;
  width: 0.875rem;
  height: 0.875rem;
  font-size: 0.875rem;
  line-height: 1;
}
</style>
