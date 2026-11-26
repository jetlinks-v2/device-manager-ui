<template>
  <a-drawer :open="!!detail" :title="$t('IotDeviceDetail.eventDetail.title')" width="min(50rem, 100vw)"
    placement="right" destroy-on-close @close="emit('close')">
    <div v-if="detail" class="event-detail">
      <dl class="event-detail__summary">
        <dt>{{ $t('IotDeviceDetail.eventDetail.name') }}</dt><dd>{{ detail.eventName }}</dd>
        <dt>{{ $t('IotDeviceDetail.eventDetail.identifier') }}</dt><dd>{{ detail.eventId }}</dd>
        <dt>{{ $t('IotDeviceDetail.eventDetail.time') }}</dt><dd>{{ detail.row.time }}</dd>
      </dl>
      <section class="event-detail__section">
        <h3>{{ $t('IotDeviceDetail.eventDetail.data') }}</h3>
        <div v-for="field in detail.fields" :key="field.id" class="event-detail__field">
          <div class="event-detail__label">{{ field.name }}</div>
          <IotDeviceHistoryValue :value="fieldValue(detail.row, field)" :value-type="field.valueType" />
        </div>
      </section>
      <section class="event-detail__section">
        <h3>{{ $t('IotDeviceDetail.eventDetail.rawData') }}</h3>
        <pre class="event-detail__raw">{{ rawText }}</pre>
      </section>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import IotDeviceHistoryValue from '../IotDeviceHistoryValue.vue'
import type { EventHistoryDetail, EventHistoryField, EventHistoryRecord } from './eventHistoryValue'

const props = defineProps({
  detail: { type: Object as PropType<EventHistoryDetail | null>, default: null },
  fieldValue: { type: Function as PropType<(row: EventHistoryRecord, field: EventHistoryField) => unknown>, required: true },
})
const emit = defineEmits<{ close: [] }>()
const { t: $t } = useI18n()
// 直接格式化服务端记录，不从已转换的字段值反向拼造“原始数据”。
const rawText = computed(() => JSON.stringify(props.detail?.row.raw, null, 2))
</script>

<style scoped src="./IotDeviceEventDetailDrawer.css"></style>
