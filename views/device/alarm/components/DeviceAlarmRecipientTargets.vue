<template>
  <span class="notification-targets" :class="{ 'notification-targets--form': layout === 'form', 'notification-targets--compact': layout === 'compact', 'notification-targets--single': targets.kinds.length === 1 }">
    <a-radio-group v-if="targets.kinds.length > 1" :value="targets.kind" size="small" :disabled="disabled"
      :aria-label="$t('DeviceAlarm.notification.targetKind')" @update:value="$emit('kind', $event)">
      <a-radio-button v-for="kind in targets.kinds" :key="kind" :value="kind">{{ $t(`DeviceAlarm.notification.workTarget.${kind}`) }}</a-radio-button>
    </a-radio-group>
    <DeviceAlarmRecipients v-if="targets.kind === 'people'" :value="targets.ids" :scope-key="scopeKey" :layout="layout === 'form' ? 'form' : 'inline'" :compact="layout === 'compact'"
      :disabled="disabled" :open="open" @update:open="$emit('update:open', $event)" @update:value="$emit('targets', 'people', $event)" />
    <template v-else>
      <a-alert v-if="targets.directory?.failed" type="error" show-icon :message="$t('DeviceAlarm.notification.targetsFailed')">
        <template #action><a-button type="link" size="small" :disabled="disabled" @click="$emit('retry', targets.kind)">{{ $t('PropertyRules.retry') }}</a-button></template>
      </a-alert>
      <a-select :value="targets.ids" :options="targets.options" mode="multiple" show-search :size="layout === 'inline' ? 'small' : 'middle'"
        option-filter-prop="label" :max-tag-count="layout === 'compact' ? 0 : 2" :loading="targets.directory?.loading"
        :max-tag-placeholder="layout === 'compact' ? () => $t('DeviceAlarm.notification.selectedCount', { count: targets.ids.length }) : undefined"
        :disabled="disabled || targets.directory?.loading || targets.directory?.failed"
        :placeholder="$t(`DeviceAlarm.notification.workTargetSearch.${targets.kind}`)" :aria-label="$t(`DeviceAlarm.notification.workTargetSearch.${targets.kind}`)"
        @update:value="$emit('targets', targets.kind, $event)" />
    </template>
  </span>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DeviceAlarmRecipients from './DeviceAlarmRecipients.vue'
import type { alarmRecipientTargets, AlarmRecipientKind } from '../notificationTargets'
import type { DeviceAlarmDimensionKind } from '../types'

withDefaults(defineProps<{ targets: ReturnType<typeof alarmRecipientTargets>; scopeKey: string; layout?: 'inline' | 'form' | 'compact'; disabled?: boolean; open: boolean }>(), { layout: 'inline', disabled: false })
defineEmits<{ kind: [value: unknown]; targets: [kind: AlarmRecipientKind, value: unknown]; retry: [kind: DeviceAlarmDimensionKind]; 'update:open': [open: boolean] }>()
const { t: $t } = useI18n()
</script>
<style scoped>
.notification-targets { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); min-width: 0; max-width: 100%; }
.notification-targets :deep(.ant-select) { width: calc(var(--space-4) * 12); max-width: 100%; }
.notification-targets :deep(.ant-radio-group) { display: inline-flex; flex-wrap: wrap; }
.notification-targets--form { display: grid; gap: var(--space-3); width: 100%; }
.notification-targets--form :deep(.ant-select), .notification-targets--form :deep(.notification-chip) { width: 100%; }
.notification-targets--compact { display: grid; grid-template-columns: max-content minmax(0, 1fr); align-items: stretch; gap: var(--space-2); width: min(100%, calc(var(--space-4) * 24)); }
.notification-targets--compact.notification-targets--single { grid-template-columns: minmax(0, 1fr); }
.notification-targets--compact :deep(.ant-radio-group) { flex: none; align-items: center; border: 1px solid var(--line); background: var(--bg-sunken); border-radius: var(--r-1); }
.notification-targets--compact :deep(.ant-radio-button-wrapper) { height: calc(var(--rule-control-height, 32px) - 2px); line-height: calc(var(--rule-control-height, 32px) - 2px); border: 0; background: transparent; padding-inline: var(--space-2); border-radius: var(--r-1); }
.notification-targets--compact :deep(.ant-radio-button-wrapper::before) { display: none; }
.notification-targets--compact :deep(.ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled)) { background: var(--jet-theme-primary-soft); color: var(--jet-theme-primary); }
.notification-targets--compact :deep(.ant-radio-group) { grid-row: 1; }
.notification-targets--compact :deep(.ant-select) { grid-row: 1; width: 100%; min-width: 0; }
.notification-targets--compact :deep(.notification-chip) { grid-row: 1; width: 100%; min-width: 0; max-width: 100%; height: auto; min-height: var(--rule-control-height, 32px); padding-inline: var(--space-2); border: 1px solid var(--line); border-radius: var(--r-1); background: var(--bg); text-align: start; }
.notification-targets--compact :deep(.notification-chip__arrow) { margin-inline-start: auto; }
.notification-targets--compact :deep(.ant-alert) { grid-column: 1 / -1; grid-row: 2; }
@media (max-width: 540px) {
  .notification-targets--compact { grid-template-columns: minmax(0, 1fr); }
  .notification-targets--compact :deep(.ant-select), .notification-targets--compact :deep(.notification-chip) { grid-row: auto; }
  .notification-targets--compact :deep(.ant-alert) { grid-row: auto; }
}
</style>
