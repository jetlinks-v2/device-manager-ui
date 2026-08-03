import { computed, reactive, ref, watch, type Ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { onlyMessage } from '@jetlinks-web/utils'
import { formatApiTime, iotDeviceDetailRealApi } from '../../services/iotDeviceDetailReal.service'
import type { RealtimeEventRow } from './iotDeviceDetail.types'

type UseIotDeviceEventHistoryInput = {
  deviceId: Readonly<Ref<string>>
  events: Readonly<Ref<RealtimeEventRow[]>>
  timeRange: Readonly<Ref<string>>
}

const $t = i18n.global.t

export type EventHistoryField = {
  id: string
  name: string
  valueType?: Record<string, any>
}

export type EventHistoryRecord = {
  id: string
  time: string
  values: Record<string, unknown>
}

export function useIotDeviceEventHistory(input: UseIotDeviceEventHistoryInput) {
  const eventId = ref('')
  const eventLoading = ref(false)
  const eventRows = ref<EventHistoryRecord[]>([])
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

  function normalizeEventRecord(item: Record<string, any>, index: number): EventHistoryRecord {
    const timestamp = item.timestamp ?? item.time ?? item.createTime ?? item.reportTime
    return {
      id: String(item.id ?? item.messageId ?? `${eventId.value}-${timestamp ?? index}`),
      time: formatApiTime(timestamp, '--'),
      values: getEventValues(item),
    }
  }

  function getEventValues(item: Record<string, any>) {
    const value = item.value ?? item.data?.value ?? item.payload ?? item.data
    const parsedValue = parseJsonLike(value)
    const valueFields = parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue as Record<string, unknown>
      : value !== undefined
        ? { value: parsedValue }
        : {}
    return {
      ...item,
      ...valueFields,
    }
  }

  function eventValueText(row: EventHistoryRecord, field: EventHistoryField) {
    const formatted = row.values[`${field.id}_format`]
    const value = formatted === undefined || formatted === null || formatted === ''
      ? row.values[field.id]
      : formatted
    return formatEventValue(value, field.valueType)
  }

  function formatEventValue(value: unknown, valueType?: Record<string, any>) {
    if (value === undefined || value === null || value === '') return '--'
    const parsedValue = parseJsonLike(value)
    if (valueType?.type === 'boolean') {
      const options = [
        { text: valueType.falseText ?? $t('IotDeviceDetail.common.no'), value: valueType.falseValue ?? false },
        { text: valueType.trueText ?? $t('IotDeviceDetail.common.yes'), value: valueType.trueValue ?? true },
      ]
      return String(options.find((item) => `${item.value}` === `${parsedValue}`)?.text ?? parsedValue)
    }
    if (valueType?.type === 'enum') {
      return String((valueType.elements || []).find((item: any) => `${item.value}` === `${parsedValue}`)?.text ?? parsedValue)
    }
    if (valueType?.type === 'date') return formatApiTime(parsedValue, '--')
    if (parsedValue !== null && typeof parsedValue === 'object') return JSON.stringify(parsedValue)
    return String(parsedValue)
  }

  function parseJsonLike(value: unknown) {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (!text || !((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) return value
    try {
      return JSON.parse(text)
    } catch {
      return value
    }
  }

  watch(
    () => input.events.value.map((item) => item.id).join(','),
    () => {
      eventId.value = input.events.value[0]?.id ?? ''
    },
    { immediate: true },
  )

  watch(
    [eventId, input.timeRange],
    () => {
      eventPagination.current = 1
      void loadEventRows(1)
    },
    { immediate: true },
  )

  return {
    eventId,
    eventLoading,
    eventRows,
    eventFields,
    eventPagination,
    eventEmptyText,
    eventRangeText,
    loadEventRows,
    eventValueText,
  }
}
