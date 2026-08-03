<template>
  <section class="event-groups" :aria-label="$t('IotDeviceDetail.eventGroups.aria')">
    <a-tabs
      v-if="eventGroups.length"
      class="event-group-tabs"
      tab-position="left"
      :active-key="activeKey"
      @change="onEventChange"
    >
      <a-tab-pane v-for="group in eventGroups" :key="group.key">
        <template #tab>
          <div class="event-group-tab">
            <span>{{ group.name }}</span>
          </div>
        </template>
      </a-tab-pane>
    </a-tabs>

    <section class="event-group-panel">
      <header class="event-group-panel__head">
        <div>
          <strong>{{ currentEvent?.name || $t('IotDeviceDetail.eventGroups.defaultEvent') }}</strong>
        </div>
        <a-space>
          <a-range-picker
            v-model:value="timeRange"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            @change="search"
          />
          <a-button @click="resetSearch">{{ $t('IotDeviceDetail.common.reset') }}</a-button>
          <a-button type="primary" @click="search">{{ $t('IotDeviceDetail.common.search') }}</a-button>
        </a-space>
      </header>

      <a-table
        class="event-table"
        :columns="tableColumns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :row-key="(record) => record.id"
        :scroll="{ x: 'max-content' }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'timestamp'">
            <time>{{ record.timestamp }}</time>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-tooltip :title="$t('IotDeviceDetail.eventGroups.viewDetail')">
              <a-button type="text" class="event-table__action" @click="openDetail(record)">
                <template #icon>
                  <AIcon type="SearchOutlined" aria-hidden="true" />
                </template>
              </a-button>
            </a-tooltip>
          </template>
          <template v-else>
            <a-tooltip :title="eventValueTitle(record, String(column.dataIndex || column.key))">
              <span class="event-table__value">
                {{ eventValueText(record, String(column.dataIndex || column.key)) }}
              </span>
            </a-tooltip>
          </template>
        </template>
        <template #emptyText>
          <CloudEmpty :description="$t('IotDeviceDetail.eventGroups.empty')" />
        </template>
      </a-table>
    </section>

    <a-modal
      v-model:open="detailOpen"
      :title="$t('IotDeviceDetail.eventDetail.title')"
      :footer="null"
      :width="680"
    >
      <JsonViewer
        v-if="selectedRow"
        :expand-depth="5"
        :value="selectedRow.raw"
        style="max-height: calc(100vh - 22.5rem); overflow: auto"
      />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { JsonViewer } from 'vue3-json-viewer'

import { useIotDeviceEventGroups } from '../../hooks/useIotDeviceEventGroups'
import type { IotDevice } from '../../types'
import type { RealtimeEventRow } from './iotDeviceDetail.types'

const props = defineProps({
  device: { type: Object as PropType<IotDevice>, required: true },
  events: { type: Array as PropType<RealtimeEventRow[]>, required: true },
})

const { t: $t } = useI18n()

const {
  activeKey,
  currentEvent,
  detailOpen,
  eventGroups,
  eventValueText,
  eventValueTitle,
  loading,
  onEventChange,
  onTableChange,
  openDetail,
  pagination,
  resetSearch,
  rows,
  search,
  selectedRow,
  tableColumns,
  timeRange,
} = useIotDeviceEventGroups(props)
</script>

<style scoped src="./IotDeviceEventGroupsTab.css"></style>
