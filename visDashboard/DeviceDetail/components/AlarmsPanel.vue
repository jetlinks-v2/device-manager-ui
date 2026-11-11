<template>
  <ol v-if="rows.length" class="detail-alarms">
    <li v-for="item in rows" :key="item.id">
      <a-tooltip>
        <template #title>
          <div>{{ t('IotDeviceDetail.overview.alarmTrigger', { value: item.trigger }) }}</div>
          <div>{{ t('IotDeviceDetail.overview.alarmReason', { value: item.summary }) }}</div>
        </template>
        <div class="detail-alarm">
          <a-tag class="detail-alarm__level" :color="alarmLevelColors[item.levelValue]">{{ item.level }}</a-tag>
          <div class="detail-alarm__content">
            <strong :title="item.title">{{ item.title }}</strong>
            <span class="detail-alarm__reason">{{ item.summary }}</span>
          </div>
          <time>{{ item.time }}</time>
        </div>
      </a-tooltip>
    </li>
  </ol>
  <CloudEmpty v-else :description="t('IotDeviceDetail.overview.emptyAlarmsHint')" />
</template>
<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'
import { alarmLevelColors, type RecentAlarmRecord } from '../shared'
defineProps({ rows: { type: Array as PropType<RecentAlarmRecord[]>, required: true } })
const { t } = useI18n()
</script>
<style scoped>
.detail-alarms { list-style: none; margin: 0; padding: 0; overflow: auto; }
.detail-alarms > li + li { border-top: 1px solid var(--jet-theme-border-secondary); }
.detail-alarm { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; }
.detail-alarm__level { margin: 0; white-space: nowrap; }
.detail-alarm__content { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.detail-alarm__content > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-alarm strong { font-weight: 500; }
.detail-alarm__reason,
.detail-alarm time { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.detail-alarm time { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
@container device-detail-widget (max-width: 420px) {
  .detail-alarm { gap: var(--space-2); }
  .detail-alarm time { max-width: 6.5em; white-space: normal; }
}
</style>
