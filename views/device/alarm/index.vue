<template>
  <j-page-container>
    <main class="device-alarm-page">
      <PageHeader :title="$t('DeviceAlarm.title.page')" :description="$t('DeviceAlarm.description.page')" style="margin: 0" />
      <FullPage flex class="alarm-content">
            <ContentPanel>
        <EqualHeightColumns left-width="18.75rem" right-width="1fr">
          <template #left>
            <section class="alarm-rule-list">
              <header class="alarm-list-heading"><strong>{{ $t('DeviceAlarm.workspace.rules') }}</strong><span>{{ $t('DeviceAlarm.workspace.total', { total }) }}</span></header>
              <div class="alarm-rule-search">
                <ConditionFilter :fields="filterFields" :modelValue="filterTerms" :placeholder="$t('DeviceAlarm.workspace.ruleSearch')"
                                 @update:modelValue="handleFilterTermsUpdate" @change="handleSearch" />
                <a-button type="primary" :loading="busy" @click="run(openCreate)"><AIcon type="PlusOutlined" />{{ $t('DeviceAlarm.workspace.createShort') }}</a-button>
              </div>
              <a-button class="alarm-all-rules" :type="selected ? 'default' : 'primary'" ghost @click="showAllRecords">{{ $t('DeviceAlarm.workspace.allRules') }}</a-button>
              <a-alert v-if="statusError" type="warning" show-icon :message="$t('DeviceAlarm.workspace.statusError')"><template #action><a-button type="link" size="small" @click="loadCounts">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <a-alert v-if="listError" type="error" :message="$t('DeviceAlarm.workspace.listError')"><template #action><a-button @click="load()">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <div v-else class="alarm-scroll">
                <a-spin :spinning="loading">
                  <DeviceAlarmRuleCard v-for="row in rows" :key="row.key" :row="row" :selected="selected?.id === row.id"
                                       :levels="levelOptions" :active-count="row.id ? activeCounts?.[row.id] : undefined" :busy="busy"
                                       @select="select" @edit="item => run(() => openEdit(item))" @remove="item => run(() => remove(item))" />
                  <CloudEmpty v-if="!rows.length && !loading" :description="$t('DeviceAlarm.empty')" />
                </a-spin>
              </div>
              <footer class="alarm-list-footer"><a-pagination size="small" simple :current="pageIndex + 1" :page-size="pageSize" :total="total" @change="value => load(value - 1)" /></footer>
            </section>
          </template>
          <template #right>
            <section class="alarm-record-list">
              <header class="alarm-list-heading"><strong>{{ $t('DeviceAlarm.workspace.records') }}</strong><span>{{ $t('DeviceAlarm.workspace.total', { total: recordTotal }) }}</span></header>
              <ConditionFilter :fields="recordFields" :modelValue="recordTerms" :placeholder="$t('DeviceAlarm.workspace.recordSearch')"
                               @update:modelValue="value => recordTerms = value" @change="searchRecords" />
              <div class="alarm-record-scope">
                <span>{{ $t('DeviceAlarm.workspace.scope') }}</span>
                <a-tag v-if="selected" closable @close="showAllRecords">{{ selected.name }}</a-tag>
                <span v-else>{{ $t('DeviceAlarm.workspace.allRules') }}</span>
                <a-button type="text" :loading="recordsLoading" :aria-label="$t('DeviceAlarm.workspace.refresh')" @click="loadRecords()"><AIcon type="ReloadOutlined" /></a-button>
              </div>
              <a-alert v-if="recordsError" type="error" show-icon :message="$t('DeviceAlarm.workspace.summaryError')"><template #action><a-button @click="loadRecords()">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <div v-else class="alarm-scroll">
                <a-spin :spinning="recordsLoading"><div class="alarm-record-items">
                  <DeviceAlarmRecordCard v-for="record in records" :key="record.id" :row="record" :levels="levelOptions" :now="now.getTime()"
                                         @handle="handling.show" @history="history.show" />
                  <CloudEmpty class="alarm-record-empty" v-if="!records.length && !recordsLoading" :description="$t('DeviceAlarm.workspace.recordsEmpty')" />
                </div></a-spin>
              </div>
              <footer class="alarm-list-footer"><a-pagination size="small" :current="recordPage + 1" :page-size="recordSize" :total="recordTotal"
                                                              show-size-changer @change="(value, size) => loadRecords(value - 1, size)" /></footer>
            </section>
          </template>
        </EqualHeightColumns>
      
            </ContentPanel>
        </FullPage>
      <a-modal :open="history.open" :width="1000" :footer="null" :title="$t('DeviceAlarm.workspace.' + history.history.tab)" destroy-on-close @cancel="history.close">
        <p class="alarm-history-caption">{{ history.selectedRecord?.alarmName }} · {{ history.selectedRecord?.sourceName || history.selectedRecord?.targetName }}</p>
        <DeviceAlarmHistory :state="history.history" :range="history.range" :rule-key="history.selectedRecord?.id || ''"
          @tab="history.changeTab" @range="history.changeRange" @page="history.changePage" @retry="history.loadHistory" />
      </a-modal>
      <DeviceAlarmHandleModal :state="handling" @description="value => handling.description = value" @close="handling.close" @submit="handling.submit" />
      <DeviceAlarmEditorModal v-model:open="editorOpen" :model="form" :readonly-scope="Boolean(editingRow)"
        :level-options="levelOptions" :trigger-options="triggerOptions" :product-option="selectedProductOption"
        :device-option="selectedDeviceOption" :product-request="requestProducts" :device-request="requestDevices"
        :property-options="propertyOptions" :notify-methods="notifyMethods" :notify-users="notifyUsers" :notify-loading="notifyLoading"
        :product-reload-key="productReloadKey" @product-change="onProductChange" @device-change="onDeviceChange"
        @property-change="onPropertyChange" @load-more-users="loadMoreNotifyUsers" @save="run(save)" />
    </main>
  </j-page-container>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useNow } from '@vueuse/core'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import { PageHeader } from '@jetlinks-web-core/components'
import DeviceAlarmEditorModal from './components/DeviceAlarmEditorModal.vue'
import DeviceAlarmRuleCard from './components/DeviceAlarmRuleCard.vue'
import DeviceAlarmRecordCard from './components/DeviceAlarmRecordCard.vue'
import DeviceAlarmHandleModal from './components/DeviceAlarmHandleModal.vue'
import DeviceAlarmHistory from './components/DeviceAlarmHistory.vue'
import { useDeviceAlarmWorkspace } from './hooks/useDeviceAlarmWorkspace'
import { useDeviceAlarmRecords } from './hooks/useDeviceAlarmRecords'
import { useDeviceAlarmHistory } from './hooks/useDeviceAlarmHistory'
import { useDeviceAlarmHandling } from './hooks/useDeviceAlarmHandling'
const { t: $t } = useI18n()
const { page, selected, ruleId, activeCounts, statusError, listError, loading, busy,
  load, loadCounts, select, showAllRecords, remove, run } = useDeviceAlarmWorkspace($t)
const { rows, total, pageIndex, pageSize, filterTerms, filterFields, levelOptions, triggerOptions, propertyOptions,
  selectedProductOption, selectedDeviceOption, notifyMethods, notifyUsers, notifyLoading, editorOpen, productReloadKey,
  editingRow, form, handleFilterTermsUpdate, handleSearch, openCreate, openEdit, requestProducts, requestDevices,
  onProductChange, onDeviceChange, onPropertyChange, loadMoreNotifyUsers, save } = page
const { rows: records, total: recordTotal, pageIndex: recordPage, pageSize: recordSize,
  loading: recordsLoading, error: recordsError, fields: recordFields, terms: recordTerms,
  search: searchRecords, load: loadRecords } = useDeviceAlarmRecords(ruleId, $t)
const history = reactive(useDeviceAlarmHistory())
const handling = reactive(useDeviceAlarmHandling($t, async record => {
  message.success($t('DeviceAlarm.workspace.handledSuccess', { name: record.alarmName || '—' }))
  await Promise.all([loadRecords(), loadCounts()])
}))
const now = useNow({ interval: 1000 })
</script>

<style scoped lang="less">
.device-alarm-page { display: flex; flex-direction: column; gap: var(--space-4); }
.alarm-content { overflow: hidden; }
.alarm-workspace { display: grid; flex: 1; min-height: 0; grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(300px, 26%) minmax(0, 1fr); }
.alarm-rule-list, .alarm-record-list { height: 100%; display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: var(--space-3); overflow: hidden; }
.alarm-list-heading { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.alarm-list-heading span { color: var(--jet-theme-text-secondary); font-size: 12px; }
.alarm-rule-search { display: flex; gap: var(--space-2); align-items: center; }
.alarm-rule-search > :first-child { flex: 1; min-width: 0; }
.alarm-rule-search :deep(.condition-filter__tail), .alarm-rule-search :deep(.condition-filter__text-input--tail) { min-width: 0; }
.alarm-rule-search :deep(.condition-filter__text-input--tail) { overflow: hidden; text-overflow: ellipsis; }
.alarm-rule-search :deep(.ant-btn) { flex-shrink: 0; }
.alarm-all-rules { text-align: left; }
.alarm-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.alarm-record-list { container: alarm-records / inline-size; }
.alarm-record-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: var(--space-4); }
.alarm-record-empty { grid-column: 1 / -1; }
@container alarm-records (max-width: 760px) { .alarm-record-items { grid-template-columns: minmax(0, 1fr); } }
.alarm-record-scope { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; min-width: 0; }
.alarm-record-scope > span:first-child { color: var(--jet-theme-text-secondary); }
.alarm-record-scope :deep(.ant-tag) { max-width: 75%; overflow: hidden; text-overflow: ellipsis; }
.alarm-record-scope :deep(.ant-btn) { margin-left: auto; }
.alarm-list-footer { margin-top: auto; display: flex; justify-content: flex-end; flex-shrink: 0; }
.alarm-history-caption { color: var(--jet-theme-text-secondary); }
@media (max-width: 800px) {
  .alarm-workspace { display: flex; flex-direction: column; overflow-y: auto; }
  .alarm-rule-list { border-right: 0; border-bottom: 1px solid var(--jet-theme-border); flex-shrink: 0; }
  .alarm-rule-list .alarm-scroll { max-height: 230px; flex: auto; }
  .alarm-record-list { flex: 1 0 auto; overflow: visible; }
  .alarm-record-list .alarm-scroll { overflow: visible; }
}
</style>
