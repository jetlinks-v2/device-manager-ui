<template>
  <FullPage flex class="device-alarm-workspace">
    <div class="device-alarm-workspace__layout">
      <aside class="device-alarm-workspace__rules">
        <header><strong>{{ $t('DeviceAlarm.workspace.rules') }}</strong><span>{{ $t('DeviceAlarm.workspace.total', { total: rows.length }) }}</span></header>
        <a-input v-model:value="keyword" allow-clear :placeholder="$t('DeviceAlarm.workspace.keywordSearch')" />
        <a-button :type="!selectedId ? 'primary' : 'default'" :ghost="!selectedId" @click="selectedId = undefined">{{ $t('DeviceAlarm.workspace.allRecords') }}</a-button>
        <a-alert v-if="error" type="error" show-icon :message="$t('DeviceAlarm.workspace.listError')">
          <template #action><a-button size="small" @click="load">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template>
        </a-alert>
        <a-alert v-if="countsError" type="warning" show-icon :message="$t('DeviceAlarm.workspace.statusError')">
          <template #action><a-button size="small" @click="refreshCounts">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template>
        </a-alert>
        <div class="device-alarm-workspace__scroll">
          <a-spin :spinning="loading">
            <DeviceAlarmRuleCard v-for="row in filtered" :key="row.key" :row="row" :levels="levels"
              :selected="selectedId === row.id" :active-count="row.id ? counts?.[row.id] : undefined" readonly
              @select="row => selectedId = row.id" />
            <CloudEmpty v-if="!filtered.length && !loading && !error" :description="$t('DeviceAlarm.empty')" />
          </a-spin>
        </div>
        <a-button v-if="canConfigureAlarms" block @click="configureAlarms"><AIcon type="PlusOutlined" />{{ $t('deviceDetailOptimization.configureAlarms') }}</a-button>
      </aside>
      <section class="device-alarm-workspace__records">
        <ConditionFilter v-model="terms" :fields="fields" :placeholder="$t('DeviceAlarm.workspace.recordSearch')" @change="search" />
        <a-alert v-if="recordError" type="error" show-icon :message="$t('DeviceAlarm.workspace.summaryError')">
          <template #action><a-button @click="reload">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template>
        </a-alert>
        <JProTable ref="tableRef" :key="table.key" mode="CARD" row-key="id" :request="table.request"
          :grid-columns="[1, 2, 3, 3]" :alert-show="false" :body-style="{ padding: 0 }">
          <template #card="record"><DeviceAlarmRecordCard :row="record" :levels="levels" :now="now.getTime()" :device-link="false" :can-handle="canHandle"
            @handle="handling.show" @history="history.show" /></template>
        </JProTable>
      </section>
    </div>
    <a-modal :open="history.open" :width="1000" :footer="null" :title="$t('DeviceAlarm.workspace.' + history.history.tab)" destroy-on-close @cancel="history.close">
      <p>{{ history.selectedRecord?.alarmName }} · {{ history.selectedRecord?.sourceName || history.selectedRecord?.targetName }}</p>
      <DeviceAlarmHistory :state="history.history" :range="history.range" :rule-key="history.selectedRecord?.id || ''"
        @tab="history.changeTab" @range="history.changeRange" @page="history.changePage" @retry="history.loadHistory" />
    </a-modal>
    <DeviceAlarmHandleModal v-if="canHandle" :state="handling" @description="value => handling.description = value" @close="handling.close" @submit="handling.submit" />
  </FullPage>
</template>
<script setup lang="ts">
import { computed, reactive, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNow } from '@vueuse/core'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import DeviceAlarmRuleCard from '../../../alarm/components/DeviceAlarmRuleCard.vue'
import DeviceAlarmRecordCard from '../../../alarm/components/DeviceAlarmRecordCard.vue'
import DeviceAlarmHistory from '../../../alarm/components/DeviceAlarmHistory.vue'
import DeviceAlarmHandleModal from '../../../alarm/components/DeviceAlarmHandleModal.vue'
import { useDeviceAlarmRecords } from '../../../alarm/hooks/useDeviceAlarmRecords'
import { useDeviceAlarmPermissions } from '../../../alarm/hooks/useDeviceAlarmPermissions'
import { useDeviceAlarmHandling } from '../../../alarm/hooks/useDeviceAlarmHandling'
import { useDeviceAlarmHistory } from '../../../alarm/hooks/useDeviceAlarmHistory'
import { useOverviewConfiguration } from '../../../../../visDashboard/DeviceDetail/hooks/useOverviewConfiguration'
import { useDeviceAlarmDetail } from './useDeviceAlarmDetail'
import type { IotDevice } from '../../types'
const props = defineProps<{ device: IotDevice }>()
const { t: $t } = useI18n()
const deviceId = computed(() => props.device.id)
const { rows, levels, filtered, keyword, selectedId, loading, error, counts, countsError, load, refreshCounts } = useDeviceAlarmDetail(toRef(props, 'device'))
const { tableRef, table, error: recordError, fields, terms, search, reload } = useDeviceAlarmRecords(selectedId, $t, deviceId)
const history = reactive(useDeviceAlarmHistory())
const { canHandle } = useDeviceAlarmPermissions()
const handling = reactive(useDeviceAlarmHandling($t, async () => { await Promise.all([reload(), refreshCounts()]) }, () => canHandle.value))
const now = useNow({ interval: 30000 })
const { canConfigureAlarms, configureAlarms } = useOverviewConfiguration(deviceId, computed(() => false))
</script>
<style scoped lang="less">
.device-alarm-workspace__layout { display: grid; grid-template-columns: 20rem minmax(0, 1fr); gap: var(--space-4); height: 100%; min-height: 32rem; }
.device-alarm-workspace__rules, .device-alarm-workspace__records { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; min-height: 0; }
.device-alarm-workspace__rules { padding-right: var(--space-4); border-right: 1px solid var(--jet-theme-border-secondary); }
.device-alarm-workspace__rules header { display: flex; justify-content: space-between; align-items: center; }
.device-alarm-workspace__rules header span { color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.device-alarm-workspace__scroll { flex: 1; min-height: 0; overflow-y: auto; }
.device-alarm-workspace__records { overflow: auto; }
@media (max-width: 60rem) {
  .device-alarm-workspace__layout { grid-template-columns: 1fr; height: auto; }
  .device-alarm-workspace__rules { max-height: 24rem; padding-right: 0; border-right: 0; }
}
</style>
