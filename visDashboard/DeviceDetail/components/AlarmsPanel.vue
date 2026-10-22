<template>
  <ol v-if="rows.length" class="detail-alarms">
    <li v-for="item in rows" :key="item.id">
      <a-tooltip>
        <template #title>
          <div>{{ t('IotDeviceDetail.overview.alarmTrigger', { value: item.trigger }) }}</div>
          <div>{{ t('IotDeviceDetail.overview.alarmReason', { value: item.summary }) }}</div>
        </template>
        <div class="detail-alarm">
          <strong>{{ item.title }}</strong>
          <div><a-tag>{{ item.level }}</a-tag><span>{{ item.duration }}</span></div>
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
import type { RecentAlarmRecord } from '../shared'
defineProps({ rows: { type: Array as PropType<RecentAlarmRecord[]>, required: true } })
const { t } = useI18n()
</script>
<style scoped>
.detail-alarms { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); overflow: auto; }
.detail-alarm { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--jet-theme-border-secondary); border-radius: var(--r-2); }
.detail-alarm strong { overflow-wrap: anywhere; }
.detail-alarm time { grid-column: 1 / -1; color: var(--jet-theme-text-secondary); }
</style>
