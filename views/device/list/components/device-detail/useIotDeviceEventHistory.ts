import { computed, reactive, ref, watch, type Ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { onlyMessage } from '@jetlinks-web/utils'
import { formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimeEventRow } from './iotDeviceDetail.types'
import { formatPropertyValueWithUnit } from './iotDevicePropertyDisplay'
import { formatPropertyUnit, usePropertyUnits } from '../../../alarm/hooks/usePropertyUnits'
import {
  eventHistoryValueText, formatEventHistoryValue, getEventFieldValue, getEventHistoryValues,
  type EventHistoryDetail, type EventHistoryField, type EventHistoryRecord,
} from './event-history/eventHistoryValue'

export type { EventHistoryField, EventHistoryRecord } from './event-history/eventHistoryValue'

type UseIotDeviceEventHistoryInput = {
  deviceId: Readonly<Ref<string>>
  events: Readonly<Ref<RealtimeEventRow[]>>
  timeRange: Readonly<Ref<string>>
}

const $t = i18n.global.t

/** 查询事件历史并维护详情快照，列表刷新不修改已经打开的上报记录。 */
export function useIotDeviceEventHistory(input: UseIotDeviceEventHistoryInput) {
  usePropertyUnits()
  const eventId = ref('')
  const eventLoading = ref(false)
  const eventRows = ref<EventHistoryRecord[]>([])
  const eventDetail = ref<EventHistoryDetail | null>(null)
  let latestRequest = 0
  const eventPagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  const currentEvent = computed(() => input.events.value.find((item) => item.id === eventId.value) ?? input.events.value[0])
  const eventFields = computed<EventHistoryField[]>(() => {
    const valueType = currentEvent.value?.valueType
    const properties = currentEvent.value?.outputs || valueType?.properties
    if (Array.isArray(properties) && properties.length) {
      return [...properties].reverse().map((item: any, index: number) => ({
        id: String(item.id || item.property || item.name || `field-${index + 1}`),
        name: String(item.name || item.id || $t('IotDeviceDetail.eventGroups.parameter', { index: index + 1 })),
        valueType: item.valueType || { type: 'string' },
      }))
    }
    return [{
      id: 'value',
      name: $t('IotDeviceDetail.eventGroups.value'),
      valueType: valueType || { type: 'string' },
    }]
  })

  const eventEmptyText = computed(() => input.events.value.length ? $t('IotDeviceDetail.eventHistory.emptyRecords') : $t('IotDeviceDetail.eventHistory.emptyDefinition'))
  const eventRangeText = computed(() => {
    if (!eventPagination.total) return $t('IotDeviceDetail.eventHistory.noRecords')
    const start = (eventPagination.current - 1) * eventPagination.pageSize + 1
    const end = Math.min(eventPagination.current * eventPagination.pageSize, eventPagination.total)
    return $t('IotDeviceDetail.eventHistory.rangeText', { start, end, total: eventPagination.total })
  })

  function buildEventQuery(page = eventPagination.current) {
    return {
      pageIndex: Math.max(page - 1, 0),
      pageSize: eventPagination.pageSize,
      sorts: [{ name: 'timestamp', order: 'desc' }],
      terms: buildTimeRangeTerms(),
    }
  }

  function buildTimeRangeTerms() {
    const now = Date.now()
    const rangeMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }
    const duration = rangeMs[input.timeRange.value]
    return duration
      ? [{ column: 'timestamp', termType: 'gte', value: now - duration }]
      : []
  }

  function unwrapEventResult(response: any) {
    const result = response?.result ?? response
    const data = Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result)
        ? result
        : []
    return {
      data,
      total: Number(result?.total ?? data.length),
      pageIndex: Number(result?.pageIndex ?? 0),
    }
  }

  async function loadEventRows(page = 1) {
    const requestId = ++latestRequest
    if (!input.deviceId.value || !eventId.value) {
      eventRows.value = []
      eventPagination.total = 0
      eventLoading.value = false
      return
    }

    eventLoading.value = true
    try {
      const response = await iotDeviceDetailRealApi.queryEvent(input.deviceId.value, eventId.value, buildEventQuery(page))
      const result = unwrapEventResult(response)
      // 事件切换很快时，只保留最后一次查询结果，避免旧事件覆盖当前列表。
      if (requestId !== latestRequest) return
      eventPagination.current = result.pageIndex + 1
      eventPagination.total = result.total
      eventRows.value = result.data.map((item: Record<string, any>, index: number) => normalizeEventRecord(item, index))
    } catch (error) {
      if (requestId !== latestRequest) return
      eventRows.value = []
      eventPagination.total = 0
      onlyMessage(error instanceof Error ? error.message : $t('IotDeviceDetail.eventHistory.queryFailed'), 'error')
    } finally {
      if (requestId === latestRequest) {
        eventLoading.value = false
      }
    }
  }

  /** 原始记录独立保留；格式化字段只影响 values，不能覆盖原始数据。 */
  function normalizeEventRecord(item: Record<string, unknown>, index: number): EventHistoryRecord {
    const timestamp = item.timestamp ?? item.time ?? item.createTime ?? item.reportTime
    return {
      id: String(item.id ?? item.messageId ?? `${eventId.value}-${timestamp ?? index}`),
      time: formatApiTime(timestamp, '--'),
      values: getEventHistoryValues(item),
      raw: item,
    }
  }

  /** 点击时固定事件定义和记录，避免后续元数据刷新改变详情的字段含义。 */
  function openEventDetail(row: EventHistoryRecord) {
    eventDetail.value = {
      eventId: eventId.value,
      eventName: currentEvent.value?.name || eventId.value,
      fields: eventFields.value.map(field => ({ ...field })),
      row,
    }
  }

  /** 关闭时释放长文本引用；切换设备或事件也走同一清理路径。 */
  function closeEventDetail() {
    eventDetail.value = null
  }

  /** 展示值与原始值分离，保留 false、0 和不同空值的含义。 */
  function eventDetailValue(row: EventHistoryRecord, field: EventHistoryField) {
    const value = getEventFieldValue(row, field)
    const display = formatEventHistoryValue(value, field.valueType, {
      missing: $t('IotDeviceDetail.eventDetail.notReported'),
      emptyString: $t('IotDeviceDetail.eventDetail.emptyString'),
      yes: $t('IotDeviceDetail.common.yes'),
      no: $t('IotDeviceDetail.common.no'),
    }, value => formatApiTime(value, '--'))
    return value !== undefined && value !== null && value !== '' && ['int', 'long', 'float', 'double'].includes(String(field.valueType?.type))
      ? formatPropertyValueWithUnit(display, formatPropertyUnit(field.valueType))
      : display
  }

  /** 悬浮提示和单元格只显示摘要，长数据通过详情完整读取。 */
  function eventValueText(row: EventHistoryRecord, field: EventHistoryField) {
    return eventHistoryValueText(eventDetailValue(row, field), 200)
  }

  watch(
    () => input.events.value.map((item) => item.id).join(','),
    () => {
      eventId.value = input.events.value[0]?.id ?? ''
    },
    { immediate: true },
  )

  watch(
    [eventId, input.timeRange, input.deviceId],
    () => {
      closeEventDetail()
      eventRows.value = []
      eventPagination.current = 1
      void loadEventRows(1)
    },
    { immediate: true },
  )

  return {
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
  }
}
