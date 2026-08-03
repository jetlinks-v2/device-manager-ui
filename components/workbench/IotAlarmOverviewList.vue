<template>
  <section class="alarm-overview-list" :data-mode="mode">
    <template v-if="mode === 'latest'">
      <ul v-if="realtimeMessages.length" class="alarm-stream-widget">
        <a-tooltip v-for="alarm in realtimeMessages" :key="alarm.id">
          <template #title>
            <div class="alarm-stream-widget__tooltip">
              <div>{{ $t('IotDeviceDetail.overview.alarmTrigger', { value: displayText(alarm.trigger) }) }}</div>
              <div>{{ $t('IotDeviceDetail.overview.alarmReason', { value: displayText(alarm.text) }) }}</div>
            </div>
          </template>
          <li class="alarm-stream-widget__row" :data-level="alarm.level" :data-tone="alarm.tone">
            <i aria-hidden="true" />
            <span>
              <strong>{{ alarm.title || alarm.text }}</strong>
              <small>{{ alarm.deviceName }}</small>
            </span>
            <small class="alarm-stream-widget__duration">{{ alarm.duration }}</small>
            <em class="alarm-stream-widget__time">{{ alarm.time }}</em>
            <a-button type="link" size="small" @click="alarm.deviceId && emit('open-device-alarm', alarm.deviceId)">
              {{ $t('DeviceAlarm.record.detail') }}
            </a-button>
          </li>
        </a-tooltip>
      </ul>
      <CloudEmpty v-else class="dashboard-widget-empty" :description="$t('IotWorkbench.card.empty')" />
      <footer v-if="latestAlarmPageTotal > 1" class="dashboard-card__pager">
        <a-button type="text" size="small" :aria-label="$t('IotWorkbench.pager.prev')" @click="emit('change-latest-alarm-page', -1)">
          <AIcon :type="'LeftOutlined'" aria-hidden="true" />
        </a-button>
        <span>{{ latestAlarmPageIndex + 1 }} / {{ latestAlarmPageTotal }}</span>
        <a-button type="text" size="small" :aria-label="$t('IotWorkbench.pager.next')" @click="emit('change-latest-alarm-page', 1)">
          <AIcon :type="'RightOutlined'" aria-hidden="true" />
        </a-button>
      </footer>
    </template>

    <template v-else>
      <ol v-if="alertTopDevices.length" class="top-device-widget">
        <li v-for="(item, rank) in alertTopDevices" :key="item.id" class="top-device-widget__row">
          <em>{{ alarmRankPageIndex * ALARM_RANK_PAGE_SIZE + rank + 1 }}</em>
          <span>
            <strong>{{ item.name }}</strong>
          </span>
          <strong>{{ $t('IotWorkbench.card.alertScore', { total: item.count }) }}</strong>
          <a-button type="link" size="small" @click="emit('open-device-alarm', item.deviceId)">
            {{ $t('DeviceAlarm.record.detail') }}
          </a-button>
        </li>
      </ol>
      <CloudEmpty v-else class="dashboard-widget-empty" :description="$t('IotWorkbench.card.empty')" />
      <footer v-if="alarmRankPageTotal > 1" class="dashboard-card__pager">
        <a-button type="text" size="small" :aria-label="$t('IotWorkbench.pager.prev')" @click="emit('change-alarm-rank-page', -1)">
          <AIcon :type="'LeftOutlined'" aria-hidden="true" />
        </a-button>
        <span>{{ alarmRankPageIndex + 1 }} / {{ alarmRankPageTotal }}</span>
        <a-button type="text" size="small" :aria-label="$t('IotWorkbench.pager.next')" @click="emit('change-alarm-rank-page', 1)">
          <AIcon :type="'RightOutlined'" aria-hidden="true" />
        </a-button>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ALARM_RANK_PAGE_SIZE } from '../useIotDeviceAlarmOverview'
import type { IotAlarmRankRow, RealtimeMessage } from '../useIotDeviceWorkbench'

defineProps<{
  mode: 'latest' | 'rank'
  alertTopDevices: IotAlarmRankRow[]
  realtimeMessages: RealtimeMessage[]
  alarmRankPageIndex: number
  alarmRankPageTotal: number
  latestAlarmPageIndex: number
  latestAlarmPageTotal: number
}>()

const emit = defineEmits<{
  'change-alarm-rank-page': [direction: number]
  'change-latest-alarm-page': [direction: number]
  'open-device-alarm': [deviceId: string]
}>()

const { t: $t } = useI18n()
const displayText = (value: unknown) => (value === undefined || value === null || value === '' ? '--' : String(value))
</script>
