<template>
  <div
    class="event-show-card"
    :style="style"
  >
    <div
      v-if="!selectedEvents.length"
      class="event-show-card__status"
    >
      <a-empty :description="emptyText" />
    </div>
    <div
      v-else
      class="event-show-card__list"
    >
      <div
        v-for="event in selectedEvents"
        :key="event.id"
        class="event-show-card__item"
      >
        <EventTable
          :event="event"
          :deviceId="deviceId"
          :isPreview="isPreview"
          :isAutoRefresh="config.isAutoRefresh"
          :interval="config.interval"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EventTable from './EventTable.vue'
import { useEventShowCard } from '../../DeviceManagement/hooks/useEventShowCard'
import type { PropType } from 'vue'

defineOptions({
  name: 'EventShowCard'
})

interface DashboardCardInfo {
  id?: string
  componentProps?: Record<string, unknown>
}

const props = defineProps({
  info: {
    type: Object as PropType<DashboardCardInfo>,
    default: () => ({})
  },
  style: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})
const infoRef = toRef(props, 'info')
const isEditRef = toRef(props, 'isEdit')

const { config, selectedEvents, deviceId, isPreview, emptyText } = useEventShowCard(infoRef, isEditRef)
</script>

<style scoped lang="less">
.event-show-card {
  width: 100%;
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  background-color: #fff;
}

.event-show-card__status {
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.event-show-card__list {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 24px;
}

.event-show-card__item {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
