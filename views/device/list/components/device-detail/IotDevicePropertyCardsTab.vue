<template>
  <section class="property-tab" :aria-label="$t('IotDeviceDetail.properties.aria')">
    <JlDrawerShell
      :open="historyDrawerOpen"
      :width="680"
      icon="HistoryOutlined"
      :title="historyDrawerTitle"
      @update:open="historyDrawerOpen = $event"
    >
      <section v-if="selectedHistoryProperty" class="history-drawer" :aria-label="$t('IotDeviceDetail.properties.historyAria')">
        <div class="history-toolbar">
          <span><AIcon type="ClockCircleOutlined" aria-hidden="true" />{{ $t('IotDeviceDetail.properties.timeFilter') }}</span>
          <IotDevicePropertyTimeFilter v-model="historyTimeRange" />
        </div>

        <a-tabs v-model:active-key="historyActiveTab" class="detail-tabs">
          <a-tab-pane key="table" :tab="$t('IotDeviceDetail.common.tab.list')" />
          <a-tab-pane key="chart" :tab="$t('IotDeviceDetail.common.tab.chart')" />
        </a-tabs>

        <a-spin :spinning="historyLoading">
          <div v-if="historyActiveTab === 'table'" class="history-table">
            <div class="history-row history-row--head">
              <span>{{ $t('IotDeviceDetail.runtime.time') }}</span>
              <span>{{ $t('IotDeviceDetail.runtime.reportValue') }}</span>
              <span>{{ $t('IotDeviceDetail.runtime.quality') }}</span>
              <span>{{ $t('IotDeviceDetail.common.action') }}</span>
            </div>
            <div v-for="row in historyRows" :key="row.id" class="history-row">
              <time><AIcon type="ClockCircleOutlined" aria-hidden="true" />{{ row.reportedAt }}</time>
              <strong>{{ row.value }}</strong>
              <em :data-tone="row.tone">{{ row.quality }}</em>
              <a-tooltip :title="$t('IotDeviceDetail.properties.viewDetail')">
                <a-button
                  type="text"
                  size="small"
                  class="history-row__action"
                  :aria-label="$t('IotDeviceDetail.properties.viewDetail')"
                  @click="openHistoryDetail(row)"
                >
                  <template #icon>
                    <AIcon type="SearchOutlined" aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </div>
            <CloudEmpty v-if="!historyRows.length" class="history-empty" :description="$t('IotDeviceDetail.properties.noHistory')" />
          </div>

          <IotDevicePropertyHistoryChart
            v-else
            :device-id="deviceId"
            :property="selectedHistoryProperty"
            :time-range="historyTimeRange"
          />
        </a-spin>
      </section>

      <template #foot>
        <a-button @click="historyDrawerOpen = false">{{ $t('IotDeviceDetail.common.close') }}</a-button>
      </template>
    </JlDrawerShell>

    <IotDevicePropertyHistoryDetailModal
      v-model:open="historyDetailOpen"
      :row="selectedHistoryRow"
      :property-name="selectedHistoryProperty?.name"
    />

    <a-modal
      v-model:open="settingOpen"
      :title="$t('IotDeviceDetail.properties.setProperty')"
      :confirm-loading="settingSaving"
      @ok="submitSetting"
    >
      <a-form v-if="settingProperty" layout="vertical">
        <a-form-item :label="`${settingProperty.name}（${settingProperty.identifier}）`">
          <a-select
            v-if="settingOptions.length"
            v-model:value="settingDraft"
            :options="settingOptions"
          />
          <a-switch
            v-else-if="settingProperty.dataType === 'boolean'"
            v-model:checked="settingDraft"
          />
          <a-input-number
            v-else-if="isSettingNumber"
            v-model:value="settingDraft"
            style="width: 100%"
          />
          <a-input
            v-else
            v-model:value="settingDraft"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <div class="property-toolbar">
      <a-input
        class="property-toolbar__search"
        :value="keyword"
        :placeholder="$t('IotDeviceDetail.properties.searchPlaceholder')"
        allow-clear
        @update:value="(value) => emit('update:keyword', value)"
      >
        <template #prefix>
          <AIcon type="SearchOutlined" aria-hidden="true" />
        </template>
      </a-input>

      <a-select
        class="property-toolbar__select"
        :value="accessFilter"
        :options="accessFilterOptions"
        @change="(value) => emit('update:accessFilter', value as 'all' | RealtimeAccessMode)"
      />
      <span class="property-toolbar__count">{{ $t('IotDeviceDetail.properties.filteredTotal', { filtered: filteredProperties.length, total: properties.length }) }}</span>
    </div>

    <j-pro-table
      v-if="filteredProperties.length"
      class="property-table"
      :columns="[]"
      :request="requestProperties"
      :params="tableParams"
      :pagination="paginationOptions"
      :body-style="{ padding: 0, background: 'transparent' }"
      mode="CARD"
      :grid-columns="[1, 2, 3, 4]"
    >
      <template #card="item">
        <IotDevicePropertyCard
          :property="item"
          :actions="getPropertyActions(item)"
          @action="onPropertyAction"
        />
      </template>
    </j-pro-table>

    <CloudEmpty v-else class="property-empty">
      <template #description>
        <strong>{{ $t('IotDeviceDetail.properties.emptyNoMatch') }}</strong>
        <span>{{ $t('IotDeviceDetail.properties.emptyAdjustFilter') }}</span>
      </template>
    </CloudEmpty>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DevicePropertyValue } from '../../services/iotDeviceDetailReal.service'
import { useIotDevicePropertyCards } from '../../hooks/useIotDevicePropertyCards'
import JlDrawerShell from '../common/JlDrawerShell.vue'
import IotDevicePropertyCard from './IotDevicePropertyCard.vue'
import IotDevicePropertyHistoryDetailModal from './IotDevicePropertyHistoryDetailModal.vue'
import IotDevicePropertyHistoryChart from './IotDevicePropertyHistoryChart.vue'
import IotDevicePropertyTimeFilter from './IotDevicePropertyTimeFilter.vue'
import type { RealtimeAccessMode, RealtimePropertyRow } from './iotDeviceDetail.types'

const props = defineProps({
  deviceId: { type: String, required: true },
  properties: { type: Array as PropType<RealtimePropertyRow[]>, required: true },
  filteredProperties: { type: Array as PropType<RealtimePropertyRow[]>, required: true },
  keyword: { type: String, required: true },
  accessFilter: { type: String as PropType<'all' | RealtimeAccessMode>, required: true },
})

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:accessFilter': [value: 'all' | RealtimeAccessMode]
  'property-value': [value: DevicePropertyValue]
  'visible-keys-change': [keys: string[]]
}>()

const { t: $t } = useI18n()

const {
  accessFilterOptions,
  getPropertyActions,
  historyActiveTab,
  historyDetailOpen,
  historyDrawerOpen,
  historyDrawerTitle,
  historyLoading,
  historyRows,
  historyTimeRange,
  isSettingNumber,
  onPropertyAction,
  openHistoryDetail,
  paginationOptions,
  requestProperties,
  selectedHistoryProperty,
  selectedHistoryRow,
  settingDraft,
  settingOpen,
  settingOptions,
  settingProperty,
  settingSaving,
  submitSetting,
  tableParams,
} = useIotDevicePropertyCards(props, {
  propertyValue: (value) => emit('property-value', value),
  visibleKeysChange: (keys) => emit('visible-keys-change', keys),
})
</script>

<style scoped src="./IotDevicePropertyCardsTab.css"></style>
