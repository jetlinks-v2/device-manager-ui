<template>
  <j-page-container>
    <main class="device-alarm-page">
      <FullPage flex class="alarm-content">
            
        <EqualHeightColumns left-width="20rem" right-width="1fr">
          <template #left>
            <section class="alarm-rule-list">
              <header class="alarm-rule-heading">
                <strong>{{ $t('DeviceAlarm.workspace.rules') }}</strong>
                <span :title="$t('DeviceAlarm.workspace.total', { total })">{{ $t('DeviceAlarm.workspace.total', { total }) }}</span>
              </header>
              <div class="alarm-rule-search">
                <a-input :value="keyword" allow-clear :placeholder="$t('DeviceAlarm.workspace.keywordSearch')"
                         :aria-label="$t('DeviceAlarm.workspace.keywordSearch')"
                         @update:value="updateKeyword" @press-enter="handleSearch">
                  <template #prefix><AIcon type="icon-gaojingzhongxin-zhinengsousuo-sousuo" /></template>
                </a-input>
              </div>
              <a-alert v-if="statusError" type="warning" show-icon :message="$t('DeviceAlarm.workspace.statusError')"><template #action><a-button type="link" size="small" @click="loadCounts">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <a-alert v-if="listError" type="error" :message="$t('DeviceAlarm.workspace.listError')"><template #action><a-button @click="load()">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <div v-else class="alarm-scroll" @scroll.passive="onRuleScroll">
                <a-spin :spinning="loading">
                  <DeviceAlarmRuleCard v-for="row in rows" :key="row.key" :row="row" :selected="selected?.id === row.id"
                                       :levels="levelOptions" :active-count="row.id ? activeCounts?.[row.id] : undefined" :busy="busy"
                                       @select="select" @edit="item => run(() => openEdit(item))" @remove="confirmRemove" />
                  <CloudEmpty v-if="!rows.length && !loading" :description="$t('DeviceAlarm.empty')" />
                  <div v-if="rows.length" class="alarm-rule-more">
                    <a-spin v-if="loadingMore" size="small" />
                    <template v-else-if="loadMoreError">
                      <span>{{ $t('DeviceAlarm.workspace.loadMoreError') }}</span>
                      <a-button type="link" size="small" @click="loadMore">{{ $t('DeviceAlarm.workspace.retry') }}</a-button>
                    </template>
                    <span v-else-if="!hasMore">{{ $t('DeviceAlarm.workspace.loadedAll') }}</span>
                  </div>
                </a-spin>
              </div>
              <footer class="alarm-rule-footer">
                <a-button block class="alarm-rule-create" :loading="creating" :disabled="busy && !creating" @click="create">
                  <template #icon><AIcon type="PlusOutlined" /></template>
                  {{ $t('DeviceAlarm.action.create') }}
                </a-button>
              </footer>
            </section>
          </template>
          <template #right>
            <section class="alarm-record-list">
              <ConditionFilter :fields="recordFields" :modelValue="recordTerms" :placeholder="$t('DeviceAlarm.workspace.recordSearch')"
                               @update:modelValue="value => recordTerms = value" @change="searchRecords" />
              <a-alert v-if="recordsError" type="error" show-icon :message="$t('DeviceAlarm.workspace.summaryError')"><template #action><a-button @click="loadRecords()">{{ $t('DeviceAlarm.workspace.retry') }}</a-button></template></a-alert>
              <JProTable ref="recordTableRef" :key="recordTable.key" class="alarm-record-table" mode="CARD" row-key="id"
                         :request="recordTable.request" :grid-columns="[1, 2, 3, 3]" :alert-show="false" :body-style="{ padding: 0 }">
                <template #card="record">
                  <DeviceAlarmRecordCard :row="record" :levels="levelOptions" :now="now.getTime()"
                                         @handle="handling.show" @history="history.show" />
                </template>
              </JProTable>
            </section>
          </template>
        </EqualHeightColumns>
      
            
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
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import DeviceAlarmEditorModal from './components/DeviceAlarmEditorModal.vue'
import DeviceAlarmRuleCard from './components/DeviceAlarmRuleCard.vue'
import DeviceAlarmRecordCard from './components/DeviceAlarmRecordCard.vue'
import DeviceAlarmHandleModal from './components/DeviceAlarmHandleModal.vue'
import DeviceAlarmHistory from './components/DeviceAlarmHistory.vue'
import { useDeviceAlarmWorkspace } from './hooks/useDeviceAlarmWorkspace'
import { useDeviceAlarmRecords } from './hooks/useDeviceAlarmRecords'
import { useDeviceAlarmHistory } from './hooks/useDeviceAlarmHistory'
import { useDeviceAlarmHandling } from './hooks/useDeviceAlarmHandling'
import type { DeviceAlarmRow } from './types'
const { t: $t } = useI18n()
const { page, selected, ruleId, activeCounts, statusError, listError, loading, busy, creating,
  loadingMore, loadMoreError, hasMore, load, loadCounts, loadMore, select, showAllRecords, remove, run, create } = useDeviceAlarmWorkspace($t)
const { rows, total, keyword, levelOptions, triggerOptions, propertyOptions,
  selectedProductOption, selectedDeviceOption, notifyMethods, notifyUsers, notifyLoading, editorOpen, productReloadKey,
  editingRow, form, updateKeyword, handleSearch, openEdit, requestProducts, requestDevices,
  onProductChange, onDeviceChange, onPropertyChange, loadMoreNotifyUsers, save } = page
const { tableRef: recordTableRef, table: recordTable, error: recordsError, fields: recordFields, terms: recordTerms,
  search: searchRecords, reload: loadRecords } = useDeviceAlarmRecords(ruleId, $t)
const history = reactive(useDeviceAlarmHistory())
const handling = reactive(useDeviceAlarmHandling($t, async record => {
  message.success($t('DeviceAlarm.workspace.handledSuccess', { name: record.alarmName || '—' }))
  await Promise.all([loadRecords(), loadCounts()])
}))
const now = useNow({ interval: 1000 })

function onRuleScroll(event: Event) {
  // 失败后停止自动加载，改由页脚重试，避免同一滚动位置反复触发失败请求。
  if (loadMoreError.value || loading.value || loadingMore.value || !hasMore.value) return
  const target = event.currentTarget as HTMLElement
  if (target.scrollHeight - target.scrollTop - target.clientHeight > 48) return
  void loadMore()
}

function confirmRemove(row: DeviceAlarmRow) {
  Modal.confirm({
    title: $t('DeviceAlarm.confirm.delete', { name: row.name }),
    okText: $t('DeviceAlarm.action.delete'),
    okType: 'danger',
    cancelText: $t('DeviceAlarm.action.cancel'),
    onOk: () => run(() => remove(row)),
  })
}
</script>

<style scoped lang="less">
.device-alarm-page { display: flex; flex-direction: column; gap: var(--space-4); }
.alarm-content { overflow: hidden; }
.alarm-workspace { display: grid; flex: 1; min-height: 0; grid-template-rows: minmax(0, 1fr); grid-template-columns: minmax(300px, 26%) minmax(0, 1fr); }
.alarm-rule-list, .alarm-record-list { height: 100%; display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: var(--space-4); overflow: hidden; }
.alarm-list-heading { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.alarm-list-heading strong { font-size: var(--fs-18) }
.alarm-list-heading span { color: var(--jet-theme-text-secondary); font-size: 12px; }
.alarm-rule-heading { display: flex; align-items: center; gap: var(--space-2); min-width: 0; flex-shrink: 0; }
.alarm-rule-heading strong { flex-shrink: 0; color: var(--jet-theme-text-title); font-size: var(--fs-18); font-weight: 600; }
.alarm-rule-heading span { overflow: hidden; color: var(--jet-theme-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.alarm-rule-search { display: flex; min-width: 0; flex-shrink: 0; }
.alarm-rule-search > :first-child { flex: 1; min-width: 0; }
.alarm-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.alarm-rule-more { display: flex; min-height: 2.25rem; align-items: center; justify-content: center; gap: var(--space-1); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.alarm-rule-footer { flex-shrink: 0; }
.alarm-record-table { flex: 1; min-height: 0; }
.alarm-record-table :deep(.alarm-record-card) { width: 100%; }
.alarm-record-scope { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; min-width: 0; }
.alarm-record-scope > span:first-child { color: var(--jet-theme-text-secondary); }
.alarm-record-scope :deep(.ant-tag) { max-width: 75%; overflow: hidden; text-overflow: ellipsis; }
.alarm-record-scope :deep(.ant-btn) { margin-left: auto; }
.alarm-history-caption { color: var(--jet-theme-text-secondary); }
@media (max-width: 800px) {
  .alarm-workspace { display: flex; flex-direction: column; overflow-y: auto; }
  .alarm-rule-list { border-right: 0; border-bottom: 1px solid var(--jet-theme-border); flex-shrink: 0; }
  .alarm-rule-list .alarm-scroll { max-height: 230px; flex: auto; }
  .alarm-record-list { flex: 1 0 auto; overflow: visible; }
}
</style>
