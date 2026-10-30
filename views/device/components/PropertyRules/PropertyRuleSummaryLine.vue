<template>
  <PropertyRuleLine :icon="row.icon" :title="row.title" :color="row.color" :notice="row.notice" :class="{ 'rule-line-alarm': row.alarm }">
    <template #sentence>
      <span v-if="row.alarm" class="summary-alarm-flow">
        <span class="summary-alarm-row">
          <AIcon type="ThunderboltOutlined" class="summary-trigger-icon" />
          <I18nT keypath="DeviceAlarm.sentence.trigger" scope="global" tag="span" class="summary-alarm-body">
            <template #condition>{{ row.sentence }}</template>
            <template #level><a-tag :color="row.alarm.level == null ? undefined : levelTone(row.alarm.level)" class="summary-alarm-level">{{ levelLabel }}</a-tag></template>
          </I18nT>
        </span>
        <span class="summary-alarm-row" :class="{ 'is-off': !row.alarm.autoRelieve }">
          <AIcon type="CheckCircleOutlined" class="summary-recovery-icon" />
          <span>{{ row.details || $t('DeviceAlarm.condition.recovery.off') }}</span>
        </span>
        <span class="summary-alarm-row summary-notification" :class="{ 'is-off': !row.alarm.notification?.enabled }">
          <AIcon :type="row.alarm.notification?.enabled ? 'BellFilled' : 'BellOutlined'" />
          <span>{{ notificationText }}</span>
        </span>
      </span>
      <template v-else>{{ row.sentence }}</template>
    </template>
    <template v-if="!row.alarm && row.details" #details>{{ row.details }}</template>
  </PropertyRuleLine>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import type { AlarmLevelOption } from '../../alarm/types'
import { defaultAlarmLevelOptions, levelTone } from '../../alarm/utils'
import type { RuleRowSummary } from './summary'
import PropertyRuleLine from './PropertyRuleLine.vue'

const props = defineProps<{ row: RuleRowSummary; levels?: AlarmLevelOption[] }>()
const { t: $t } = useI18n()
const levelLabel = computed(() => (props.levels?.length ? props.levels : defaultAlarmLevelOptions($t))
  .find(option => option.value === props.row.alarm?.level)?.label ?? String(props.row.alarm?.level ?? '—'))
// Counts describe saved configuration only; the summary does not fetch contacts or imply delivery.
const notificationText = computed(() => {
  const notification = props.row.alarm?.notification
  if (!notification?.enabled) return $t('DeviceAlarm.notification.off')
  const count = new Set(notification.channelProviders).size || new Set(notification.notifyChannelIds).size
  return [count ? $t('DeviceAlarm.notification.channelCount', { count }) : $t('DeviceAlarm.notification.enabled'),
    notification.userIds.length ? $t('DeviceAlarm.notification.recipientCount', { count: new Set(notification.userIds).size }) : '',
    props.row.alarm?.autoRelieve && notification.includeRelieve ? $t('DeviceAlarm.notification.includeRelieve') : ''].filter(Boolean).join(' · ')
})
</script>
<style scoped>
.summary-alarm-flow { display: flex; flex-direction: column; width: 100%; min-width: 0; }
.summary-alarm-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: 6px; min-width: 0; line-height: 24px; }
.summary-alarm-row > :deep(.anticon) { display: inline-flex; align-items: center; justify-content: center; height: 24px; font-size: 14px; }
.summary-alarm-body { min-width: 0; }
.summary-alarm-level { display: inline-flex; margin: 0; padding-inline: var(--space-1); font-size: inherit; line-height: 20px; vertical-align: baseline; }
.summary-trigger-icon { color: var(--jet-theme-warning); }
.summary-recovery-icon { color: var(--jet-theme-success, #52c41a); }
.summary-notification { color: var(--jet-theme-text-secondary); }
.summary-notification > :deep(.anticon) { color: var(--jet-theme-primary); }
.summary-alarm-row.is-off, .summary-alarm-row.is-off > :deep(.anticon) { color: var(--jet-theme-text-secondary); }
</style>
