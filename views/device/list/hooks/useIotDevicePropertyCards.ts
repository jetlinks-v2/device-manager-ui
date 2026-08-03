import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs, { type Dayjs } from 'dayjs'
import { onlyMessage } from '@jetlinks-web/utils'

import {
  extractRows,
  formatApiTime,
  iotDeviceDetailRealApi,
  type DevicePropertyValue,
} from '../services/iotDeviceDetailReal.service'
import type { RealtimeAccessMode, RealtimePropertyRow } from '../components/device-detail/iotDeviceDetail.types'

interface HistoryRow {
  id: string
  reportedAt: string
  value: string
  unit?: string
  quality: string
  tone: RealtimePropertyRow['tone']
  raw?: any
}

export type IotDevicePropertyCardsProps = {
  deviceId: string
  properties: RealtimePropertyRow[]
  filteredProperties: RealtimePropertyRow[]
  keyword: string
  accessFilter: 'all' | RealtimeAccessMode
}

type IotDevicePropertyCardsEmit = {
  propertyValue: (value: DevicePropertyValue) => void
  visibleKeysChange: (keys: string[]) => void
}

export function useIotDevicePropertyCards(
  props: Readonly<IotDevicePropertyCardsProps>,
  emitters: IotDevicePropertyCardsEmit,
) {
  const { t: $t } = useI18n()
  const historyDrawerOpen = ref(false)
  const selectedHistoryProperty = ref<RealtimePropertyRow | null>(null)
  const historyActiveTab = ref<'table' | 'chart'>('table')
  const historyTimeRange = ref<[Dayjs, Dayjs]>(getDefaultHistoryRange())
  const historyLoading = ref(false)
  const historyRows = ref<HistoryRow[]>([])
  const historyDetailOpen = ref(false)
  const selectedHistoryRow = ref<HistoryRow | null>(null)
  const readingId = ref('')
  const settingOpen = ref(false)
  const settingSaving = ref(false)
  const settingProperty = ref<RealtimePropertyRow | null>(null)
  const settingDraft = ref<any>()
  const PAGE_SIZE_OPTIONS = ['12', '24', '48', '96']
  const visibleProperties = ref<RealtimePropertyRow[]>([])
  const accessFilterOptions = computed(() => [
    { label: $t('IotDeviceDetail.runtime.filter.all'), value: 'all' },
    { label: $t('IotDeviceDetail.runtime.filter.read'), value: 'read' },
    { label: $t('IotDeviceDetail.runtime.filter.readwrite'), value: 'readwrite' },
    { label: $t('IotDeviceDetail.runtime.filter.write'), value: 'write' },
  ])

  const tableParams = computed(() => ({
    keyword: props.keyword,
    accessFilter: props.accessFilter,
    total: props.filteredProperties.length,
    keys: props.filteredProperties.map((item) => item.id).join('|'),
  }))
  const paginationOptions = {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    showSizeChanger: true,
    showLessItems: true,
  }

  const requestProperties = async (params: Record<string, unknown>) => {
    const pageIndex = Number(params.pageIndex ?? 0)
    const pageSize = Number(params.pageSize ?? 12)
    const start = pageIndex * pageSize
    const data = props.filteredProperties.slice(start, start + pageSize)
    visibleProperties.value = data

    return {
      success: true,
      result: {
        data,
        pageIndex,
        pageSize,
        total: props.filteredProperties.length,
      },
    }
  }

  const visiblePropertyKeys = computed(() =>
    visibleProperties.value.map((item) => item.identifier).filter(Boolean),
  )

  const historyDrawerTitle = computed(() => selectedHistoryProperty.value?.name || $t('IotDeviceDetail.propertyCards.dataTitle'))

  const settingOptions = computed(() => {
    const elements = settingProperty.value?.valueType?.elements
    return Array.isArray(elements)
      ? elements.map((item: any) => ({ label: item.text || item.label || item.value, value: item.value }))
      : []
  })

  const isSettingNumber = computed(() => ['int', 'long', 'float', 'double', 'number'].includes(settingProperty.value?.dataType || ''))

  function toneLabel(tone: RealtimePropertyRow['tone']) {
    if (tone === 'critical') return $t('IotDeviceDetail.common.quality.exception')
    if (tone === 'warning') return $t('IotDeviceDetail.common.quality.warning')
    if (tone === 'stale') return $t('IotDeviceDetail.common.quality.stale')
    return $t('IotDeviceDetail.common.quality.normal')
  }

  function getPropertyActions(item: RealtimePropertyRow) {
    return [
      {
        key: 'read',
        title: $t('IotDeviceDetail.runtime.read'),
        icon: 'ReloadOutlined',
        show: item.accessMode === 'read' || item.accessMode === 'readwrite',
        loading: readingId.value === item.id,
      },
      {
        key: 'setting',
        title: $t('IotDeviceDetail.runtime.set'),
        icon: 'EditOutlined',
        show: item.writable,
      },
      {
        key: 'history',
        title: $t('IotDeviceDetail.runtime.historyData'),
        icon: 'HistoryOutlined',
      },
    ]
  }

  async function onPropertyAction(action: string, item: RealtimePropertyRow) {
    if (action === 'read') {
      await readPropertyValue(item)
    } else if (action === 'setting') {
      openSetting(item)
    } else if (action === 'history') {
      await openHistoryDrawer(item)
    }
  }

  async function openHistoryDrawer(item: RealtimePropertyRow) {
    selectedHistoryProperty.value = item
    historyActiveTab.value = 'table'
    historyDrawerOpen.value = true
    historyRows.value = []
    await loadHistoryRows(item, 10, historyRows, historyLoading, historyTimeRange.value)
  }

  function getDefaultHistoryRange(): [Dayjs, Dayjs] {
    return [dayjs().startOf('day'), dayjs()]
  }

  async function loadHistoryRows(
    item: RealtimePropertyRow,
    pageSize: number,
    target: { value: HistoryRow[] },
    loading: { value: boolean },
    timeRange?: [Dayjs, Dayjs],
  ) {
    if (!props.deviceId) return
    loading.value = true
    try {
      const terms = timeRange?.length
        ? [{
            terms: [{
              column: 'timestamp',
              termType: 'btw',
              value: timeRange.map((time) => time.valueOf()),
            }],
          }]
        : []
      const resp: any = await iotDeviceDetailRealApi.queryPropertyData(props.deviceId, item.identifier, {
        pageIndex: 0,
        pageSize,
        sorts: [{ name: 'timestamp', order: 'desc' }],
        terms,
      })
      target.value = extractRows(resp?.result).map((row: any, index) => mapHistoryRow(row, item, index))
    } finally {
      loading.value = false
    }
  }

  function mapHistoryRow(row: any, item: RealtimePropertyRow, index: number): HistoryRow {
    const valueSource = row?.value && typeof row.value === 'object' ? row.value : row
    const value = valueSource?.formatValue ?? valueSource?.value ?? row?.formatValue ?? row?.numberValue ?? row?.value ?? '--'
    const timestamp = row?.timestamp ?? valueSource?.timestamp ?? row?.createTime ?? row?.time
    return {
      id: `${item.id}-history-${row?.id ?? timestamp ?? index}`,
      reportedAt: formatApiTime(timestamp, '--'),
      value: String(value ?? '--'),
      unit: item.unit,
      quality: toneLabel(item.tone),
      tone: item.tone,
      raw: row,
    }
  }

  function openHistoryDetail(row: HistoryRow) {
    selectedHistoryRow.value = row
    historyDetailOpen.value = true
  }

  async function readPropertyValue(item: RealtimePropertyRow) {
    if (!props.deviceId) return
    readingId.value = item.id
    try {
      const resp: any = await iotDeviceDetailRealApi.readProperty(props.deviceId, item.identifier)
      const next = normalizePropertyValue(item, resp?.result)
      emitters.propertyValue(next)
      onlyMessage($t('IotDeviceDetail.propertyCards.readSuccess'))
    } finally {
      readingId.value = ''
    }
  }

  function openSetting(item: RealtimePropertyRow) {
    settingProperty.value = item
    settingDraft.value = parseDraftValue(item)
    settingOpen.value = true
  }

  async function submitSetting() {
    if (!props.deviceId || !settingProperty.value) return
    settingSaving.value = true
    try {
      const property = settingProperty.value
      await iotDeviceDetailRealApi.setProperty(props.deviceId, {
        [property.identifier]: normalizeSettingValue(settingDraft.value, property),
      })
      emitters.propertyValue(normalizePropertyValue(property, { value: settingDraft.value }))
      onlyMessage($t('IotDeviceDetail.propertyCards.setSuccess'))
      settingOpen.value = false
    } finally {
      settingSaving.value = false
    }
  }

  function parseDraftValue(item: RealtimePropertyRow) {
    if (item.dataType === 'boolean') return item.value === 'true' || item.value === '是'
    if (['int', 'long', 'float', 'double', 'number'].includes(item.dataType)) {
      const value = Number(item.value)
      return Number.isNaN(value) ? undefined : value
    }
    return item.value === '--' ? undefined : item.value
  }

  function normalizeSettingValue(value: any, item: RealtimePropertyRow) {
    if (item.dataType === 'boolean') return Boolean(value)
    if (['int', 'long', 'float', 'double', 'number'].includes(item.dataType)) return Number(value)
    return value
  }

  function normalizePropertyValue(item: RealtimePropertyRow, result: any): DevicePropertyValue {
    const valueSource = result?.value && typeof result.value === 'object' ? result.value : result
    const value = valueSource?.value ?? result?.value ?? result?.formatValue ?? result
    return {
      ...result,
      ...valueSource,
      property: item.identifier,
      value,
      formatValue: valueSource?.formatValue ?? result?.formatValue ?? value,
      timestamp: result?.timestamp ?? Date.now(),
      timeString: result?.timeString ?? formatApiTime(Date.now()),
    }
  }

  watch(historyTimeRange, async () => {
    if (historyDrawerOpen.value && selectedHistoryProperty.value) {
      await loadHistoryRows(selectedHistoryProperty.value, 10, historyRows, historyLoading, historyTimeRange.value)
    }
  })

  watch(
    visiblePropertyKeys,
    (keys) => {
      emitters.visibleKeysChange(keys)
    },
    { immediate: true },
  )

  return {
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
  }
}
