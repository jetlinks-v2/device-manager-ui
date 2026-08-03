import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { extractRows, formatApiTime, iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import type { IotDevice } from '../types'
import type { RealtimeEventRow } from '../components/device-detail/iotDeviceDetail.types'

type EventTableRow = {
  id: string
  timestamp: string
  values: Record<string, unknown>
  raw: Record<string, unknown>
}

type EventField = {
  id: string
  name: string
  valueType?: Record<string, any>
}

export type IotDeviceEventGroupsProps = {
  device: IotDevice
  events: RealtimeEventRow[]
}

export function useIotDeviceEventGroups(props: Readonly<IotDeviceEventGroupsProps>) {
  const { t: $t } = useI18n()
  const activeKey = ref('')
  const pageCurrent = ref(1)
  const pageSize = ref(10)
  const rows = ref<EventTableRow[]>([])
  const total = ref(0)
  const loading = ref(false)
  const timeRange = ref<[string, string]>()
  const detailOpen = ref(false)
  const selectedRow = ref<EventTableRow | null>(null)
  const eventTotals = ref<Record<string, number>>({})

  const eventGroups = computed(() => props.events.map((event) => ({
    key: event.id,
    name: event.name || event.id,
  })))

  const currentEvent = computed(() => props.events.find((item) => item.id === activeKey.value) ?? props.events[0])

  const eventNotQueryable = computed(() => props.device.features?.some((item: any) => item?.id === 'eventNotQueryable'))

  const eventFields = computed<EventField[]>(() => {
    const valueType = currentEvent.value?.valueType
    if (!eventNotQueryable.value && valueType?.type === 'object' && Array.isArray(valueType.properties)) {
      return [...valueType.properties].reverse().map((item: any, index) => ({
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

  const tableColumns = computed(() => [
    ...eventFields.value.map((field) => ({
      key: field.id,
      title: field.name,
      dataIndex: field.id,
      width: columnWidth(field.valueType?.type),
      ellipsis: true,
    })),
    {
      key: 'timestamp',
      title: $t('IotDeviceDetail.runtime.time'),
      dataIndex: 'timestamp',
      width: 180,
    },
    {
      key: 'action',
      title: $t('IotDeviceDetail.common.action'),
      dataIndex: 'action',
      width: 72,
      fixed: 'right' as const,
    },
  ])

  const pagination = computed(() => ({
    current: pageCurrent.value,
    pageSize: pageSize.value,
    total: total.value,
    showSizeChanger: true,
    showTotal: (value: number) => $t('IotDeviceDetail.eventGroups.total', { total: value }),
  }))

  watch(
    () => props.events.map((event) => event.id).join(','),
    () => {
      eventTotals.value = {}
      activeKey.value = props.events[0]?.id || ''
      pageCurrent.value = 1
      void loadCurrentEvent()
    },
    { immediate: true },
  )

  watch(
    () => props.device.id,
    () => {
      eventTotals.value = {}
      pageCurrent.value = 1
      void loadCurrentEvent()
    },
  )

  function onEventChange(key: string | number) {
    activeKey.value = String(key)
    pageCurrent.value = 1
    rows.value = []
    total.value = 0
    void loadCurrentEvent()
  }

  function onTableChange(nextPagination: any) {
    pageCurrent.value = Number(nextPagination?.current ?? 1)
    pageSize.value = Number(nextPagination?.pageSize ?? pageSize.value)
    void loadCurrentEvent()
  }

  function search() {
    pageCurrent.value = 1
    void loadCurrentEvent()
  }

  function resetSearch() {
    timeRange.value = undefined
    search()
  }

  async function loadCurrentEvent() {
    const eventId = activeKey.value || props.events[0]?.id
    if (!props.device.id || !eventId) {
      rows.value = []
      total.value = 0
      return
    }

    loading.value = true
    try {
      const terms = buildTerms()
      const resp: any = await iotDeviceDetailRealApi.queryEvent(props.device.id, eventId, {
        pageIndex: pageCurrent.value - 1,
        pageSize: pageSize.value,
        terms,
        sorts: [{ name: 'timestamp', order: 'desc' }],
      })
      const result = resp?.result ?? resp
      const nextRows = extractRows(result).map((item: any, index) => normalizeEventRow(item, eventId, index))
      const nextTotal = Number(result?.total ?? result?.page?.total ?? resp?.result?.total ?? nextRows.length)
      rows.value = nextRows
      total.value = nextTotal
      eventTotals.value = {
        ...eventTotals.value,
        [eventId]: nextTotal,
      }
    } finally {
      loading.value = false
    }
  }

  function buildTerms() {
    if (!timeRange.value?.length) return []
    const [from, to] = timeRange.value
    return [
      { column: 'timestamp', termType: 'gte', value: from },
      { column: 'timestamp', termType: 'lte', value: to },
    ]
  }

  function normalizeEventRow(item: any, eventId: string, index: number): EventTableRow {
    const rawValue = item?.value ?? item?.data?.value ?? item?.payload
    const parsedValue = parseJsonLike(rawValue)
    const valueFields = parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)
      ? parsedValue as Record<string, unknown>
      : rawValue !== undefined
        ? { value: parsedValue }
        : {}
    return {
      id: String(item?.id || `${eventId}-${item?.timestamp || item?.createTime || index}`),
      timestamp: formatApiTime(item?.timestamp || item?.createTime || item?.time),
      values: {
        ...item,
        ...valueFields,
      },
      raw: {
        ...item,
        value: parsedValue ?? item?.value,
      },
    }
  }

  function openDetail(row: EventTableRow) {
    selectedRow.value = row
    detailOpen.value = true
  }

  function eventValueText(row: EventTableRow, key: string) {
    const field = eventFields.value.find((item) => item.id === key)
    const formatValue = row.values?.[`${key}_format`]
    const value = formatValue === undefined || formatValue === null || formatValue === ''
      ? row.values?.[key]
      : formatValue
    return formatEventValue(value, field?.valueType)
  }

  function eventValueTitle(row: EventTableRow, key: string) {
    const value = eventValueText(row, key)
    return value === '--' ? '' : value
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
    if (valueType?.type === 'date') return formatApiTime(parsedValue)
    if (parsedValue !== null && typeof parsedValue === 'object') return JSON.stringify(parsedValue)
    return String(parsedValue)
  }

  function parseJsonLike(value: unknown) {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (!text) return value
    if (!((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']')))) return value
    try {
      return JSON.parse(text)
    } catch {
      return value
    }
  }

  function columnWidth(type?: string) {
    if (type === 'object' || type === 'array') return 320
    if (type === 'file') return 300
    if (type === 'geoPoint') return 220
    if (type === 'date' || type === 'time') return 180
    if (type === 'enum' || type === 'boolean') return 140
    if (['int', 'long', 'float', 'double', 'number'].includes(type || '')) return 160
    return 240
  }

  return {
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
  }
}
