<template>
  <section class="event-history" :aria-label="$t('IotDeviceDetail.eventGroups.aria')">
    <a-tabs
      v-if="events.length"
      v-model:active-key="eventId"
      class="event-history__tabs"
      tab-position="left"
    >
      <a-tab-pane v-for="event in events" :key="event.id">
        <template #tab>
          <span class="event-history__tab" :title="event.name + event.id">
            <strong>{{ event.name || event.id }}</strong>
            <small v-if="event.id">{{ event.id }}</small>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>

    <section :class="['event-history__content', { 'event-history__content--full': !events.length }]">
      <header v-if="currentEvent" class="event-history__head">
        <div>
          <strong>{{ currentEvent?.name || currentEvent?.id }}</strong>
          <span v-if="currentEvent?.id">{{ currentEvent.id }}</span>
        </div>
        <a-button :loading="eventLoading" @click="loadEventRows(eventPagination.current)">
          <template #icon><AIcon type="ReloadOutlined" /></template>
          {{ $t('DeviceAlarm.action.refresh') }}
        </a-button>
      </header>

      <div class="event-history__table">
        <div class="event-history__row event-history__row--head" :style="tableGridStyle">
          <span>{{ $t('IotDeviceDetail.logs.column.time') }}</span>
          <span v-for="field in eventFields" :key="field.id">{{ field.name }}</span>
          <span class="event-history__action">{{ $t('IotDeviceDetail.common.action') }}</span>
        </div>
        <div v-for="row in eventRows" :key="row.id" class="event-history__row" :style="tableGridStyle">
          <time>{{ row.time }}</time>
          <a-tooltip v-for="field in eventFields" :key="field.id" :title="eventValueText(row, field)">
            <span class="event-history__value">{{ eventValueText(row, field) }}</span>
          </a-tooltip>
          <span class="event-history__action">
            <a-tooltip :title="$t('IotDeviceDetail.eventGroups.viewDetail')">
              <a-button type="text" size="small" :aria-label="$t('IotDeviceDetail.eventGroups.viewDetail')" @click="openEventDetail(row)">
                <template #icon><AIcon type="SearchOutlined" /></template>
              </a-button>
            </a-tooltip>
          </span>
        </div>
        <CloudEmpty
          v-if="!eventLoading && !eventRows.length"
          class="event-history__empty"
          :description="eventEmptyText"
        />
      </div>

      <footer class="event-history__footer">
        <span>{{ eventRangeText }}</span>
        <a-pagination
          v-model:current="eventPagination.current"
          :page-size="eventPagination.pageSize"
          :total="eventPagination.total"
          simple
          @change="loadEventRows"
        />
      </footer>
    </section>
    <IotDeviceEventDetailDrawer :detail="eventDetail" :field-value="eventDetailValue" @close="closeEventDetail" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RealtimeEventRow } from './iotDeviceDetail.types'
import { useIotDeviceEventHistory } from './useIotDeviceEventHistory'
import IotDeviceEventDetailDrawer from './event-history/IotDeviceEventDetailDrawer.vue'

const props = defineProps<{
  deviceId: string
  events: RealtimeEventRow[]
  timeRange: string
}>()

const currentEvent = computed(() => props.events.find((item) => item.id === eventId.value))
const {
  eventId,
  eventLoading,
  eventRows,
  eventDetail,
  openEventDetail,
  closeEventDetail,
  eventDetailValue,
  eventFields,
  eventPagination,
  eventEmptyText,
  eventRangeText,
  loadEventRows,
  eventValueText,
} = useIotDeviceEventHistory({
  deviceId: computed(() => props.deviceId),
  events: computed(() => props.events),
  timeRange: computed(() => props.timeRange),
})

const tableGridStyle = computed(() => ({
  gridTemplateColumns: `10rem repeat(${Math.max(eventFields.value.length, 1)}, minmax(10rem, 1fr)) 4.5rem`,
  minWidth: `calc(${14.5 + Math.max(eventFields.value.length, 1) * 10}rem + ${Math.max(eventFields.value.length, 1) + 1} * var(--space-3) + 2 * var(--space-4))`,
}))
</script>

<style scoped src="./IotDeviceEventHistoryPane.css"></style>
