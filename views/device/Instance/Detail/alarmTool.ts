import {
  queryByDevice as queryDeviceAlarmRecord,
  queryHistoryCount,
  queryLogList
} from '../../../../api/rule-engine/log'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type TranslateFn = (key: string, params?: Record<string, any>) => string

type DeviceClientToolContext = {
  device: Record<string, any>
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

interface DeviceAlarmToolDependencies {
  t: TranslateFn
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  resolveTimeRange: (args: Record<string, any>) => ResolvedTimeRange
  describeResolvedTimeRange: (range: ResolvedTimeRange) => Record<string, any> | undefined
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  withWriteToPathInput: (inputs: any[]) => any[]
  writeLimitInput: () => Record<string, any>
  collectPagedToolData: <T = any>(options: {
    args: Record<string, any>
    call?: AiClientToolCall
    inlineLimit: number
    pageSize?: number
    defaultWriteLimit?: number
    maxWriteLimit?: number
    fetchPage: (pageIndex: number, pageSize: number) => Promise<any>
    normalizeRecord: (record: Record<string, any>) => T
  }) => Promise<{
    total: number
    returned: number
    truncated: boolean
    writeMode: boolean
    writeLimit?: number
    writeLimitUnlimited?: boolean
    file?: Record<string, any>
    data: T[]
  }>
  writeToolResultToSessionFile: (
    args: Record<string, any>,
    call: AiClientToolCall,
    result: Record<string, any>,
    options?: {
      content?: string
      summary?: Record<string, any>
    }
  ) => Promise<any> | any
  timeRangeInput: () => Record<string, any>
  startTimeDescription: string
  endTimeDescription: string
  getDeviceId: (context: DeviceClientToolContext) => string
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const normalizePagedList = (deps: DeviceAlarmToolDependencies, response: any) => {
  const result = deps.responseResult(response) || {}
  const list = result.data || result.records || result.result || (Array.isArray(result) ? result : [])
  const hasTotal = result.total !== undefined || result.count !== undefined
  return {
    data: Array.isArray(list) ? list : [],
    total: Number(result.total ?? result.count ?? (Array.isArray(list) ? list.length : 0)),
    hasTotal
  }
}

const enumValue = (value: any) => {
  if (value && typeof value === 'object') {
    return value.value ?? value.id ?? value.key ?? value.text ?? value.name
  }
  return value
}

const enumText = (value: any) => {
  if (value && typeof value === 'object') {
    return value.text ?? value.name ?? value.label ?? value.value ?? value.id
  }
  return value
}

const normalizeAlarmState = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return undefined
  return ({
    alarm: 'warning',
    active: 'warning',
    warning: 'warning',
    processing: 'warning',
    abnormal: 'warning',
    '告警': 'warning',
    '报警': 'warning',
    '告警中': 'warning',
    '报警中': 'warning',
    '异常': 'warning',
    normal: 'normal',
    recovered: 'normal',
    resolved: 'normal',
    closed: 'normal',
    '正常': 'normal',
    '已恢复': 'normal',
    '恢复': 'normal',
    '已处理': 'normal'
  } as Record<string, string>)[raw] || raw
}

const toBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  const raw = String(value ?? '').trim().toLowerCase()
  return ['true', '1', 'yes', 'y', '只看告警中', '告警中'].includes(raw)
}

const buildSimpleTerm = (column: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  if (Array.isArray(value)) {
    const values = value.filter((item) => item !== undefined && item !== null && item !== '')
    return values.length ? { column, termType: 'in', value: values } : undefined
  }
  return { column, termType: 'eq', value }
}

const buildTimeTerms = (
  range: ResolvedTimeRange,
  column = 'alarmTime'
) => {
  if (range.start === undefined && range.end === undefined) return []
  return [{
    column,
    termType: 'btw',
    value: [range.start ?? 0, range.end ?? Date.now()]
  }]
}

const buildDeviceAlarmRecordTerms = (
  deviceId: string,
  args: Record<string, any>,
  timeRange: ResolvedTimeRange,
  timeColumn = 'alarmTime'
) => {
  const state = normalizeAlarmState(args.state || (toBoolean(args.onlyActive) ? 'warning' : undefined))
  const keyword = String(args.keyword || '').trim()
  const terms: any[] = [
    {
      terms: [
        { column: 'sourceId', value: deviceId, termType: 'eq' },
        { column: 'targetType', value: 'device', termType: 'eq' }
      ],
      type: 'and'
    },
    ...buildTimeTerms(timeRange, timeColumn)
  ]

  const stateTerm = buildSimpleTerm('state', state)
  if (stateTerm) terms.push(stateTerm)

  const levelTerm = buildSimpleTerm('level', args.level)
  if (levelTerm) terms.push(levelTerm)

  const alarmConfigIdTerm = buildSimpleTerm('alarmConfigId', args.alarmConfigId)
  if (alarmConfigIdTerm) terms.push(alarmConfigIdTerm)

  if (keyword) {
    terms.push({
      type: 'or',
      terms: [
        { column: 'alarmName', termType: 'like', value: keyword },
        { column: 'triggerDesc', termType: 'like', value: keyword },
        { column: 'actualDesc', termType: 'like', value: keyword },
        { column: 'sourceName', termType: 'like', value: keyword }
      ]
    })
  }

  return terms
}

const normalizeAlarmRecord = (item: Record<string, any>) => ({
  id: item.id,
  alarmName: item.alarmName || item.name,
  alarmConfigId: item.alarmConfigId,
  level: item.level,
  state: {
    value: enumValue(item.state),
    text: enumText(item.state)
  },
  alarmTime: item.alarmTime,
  lastAlarmTime: item.lastAlarmTime,
  duration: item.duration,
  triggerDesc: item.triggerDesc,
  actualDesc: item.actualDesc,
  sourceId: item.sourceId,
  sourceName: item.sourceName,
  targetId: item.targetId,
  targetType: item.targetType,
  handleTime: item.handleTime,
  handleType: item.handleType
    ? {
        value: enumValue(item.handleType),
        text: enumText(item.handleType)
      }
    : undefined
})

const normalizeAlarmHistoryRecord = (
  deps: DeviceAlarmToolDependencies,
  item: Record<string, any>
) => ({
  id: item.id,
  alarmRecordId: item.alarmRecordId,
  alarmConfigId: item.alarmConfigId,
  alarmConfigName: item.alarmConfigName,
  level: item.level,
  alarmTime: item.alarmTime,
  targetId: item.targetId,
  targetType: item.targetType,
  targetName: item.targetName,
  sourceId: item.sourceId,
  sourceType: item.sourceType,
  sourceName: item.sourceName,
  triggerDesc: item.triggerDesc,
  actualDesc: item.actualDesc,
  description: item.description,
  alarmConfigSource: item.alarmConfigSource,
  alarmInfo: deps.compactInlineValue(item.alarmInfo, 1600),
  bizId: item.bizId,
  bizType: item.bizType
})

const alarmRecordIdsFromArgs = (
  deps: DeviceAlarmToolDependencies,
  args: Record<string, any>
) => {
  const raw = args.alarmRecordId ?? args.recordId ?? args.alarmRecordIds
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? '').split(/[,\s，、/|]+/)
  return deps.asArray<string>(values)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

const buildAlarmHistoryTerms = (
  deps: DeviceAlarmToolDependencies,
  args: Record<string, any>,
  timeRange: ResolvedTimeRange,
  options: { includeRecordId?: boolean } = {}
) => {
  const keyword = String(args.keyword || '').trim()
  const terms: any[] = [
    ...buildTimeTerms(timeRange, 'alarmTime')
  ]

  if (options.includeRecordId) {
    const recordIds = alarmRecordIdsFromArgs(deps, args)
    const recordTerm = buildSimpleTerm('alarmRecordId', recordIds.length > 1 ? recordIds : recordIds[0])
    if (recordTerm) terms.push(recordTerm)
  }

  const levelTerm = buildSimpleTerm('level', args.level)
  if (levelTerm) terms.push(levelTerm)

  const alarmConfigIdTerm = buildSimpleTerm('alarmConfigId', args.alarmConfigId)
  if (alarmConfigIdTerm) terms.push(alarmConfigIdTerm)

  if (keyword) {
    terms.push({
      type: 'or',
      terms: [
        { column: 'alarmConfigName', termType: 'like', value: keyword },
        { column: 'description', termType: 'like', value: keyword },
        { column: 'triggerDesc', termType: 'like', value: keyword },
        { column: 'actualDesc', termType: 'like', value: keyword },
        { column: 'sourceName', termType: 'like', value: keyword },
        { column: 'alarmInfo', termType: 'like', value: keyword }
      ]
    })
  }

  return terms
}

const queryDeviceAlarmHistoryCount = async (
  deps: DeviceAlarmToolDependencies,
  deviceId: string,
  args: Record<string, any>,
  timeRange: ResolvedTimeRange
) => {
  const response = await queryHistoryCount('device', deviceId, {
    terms: buildAlarmHistoryTerms(deps, args, timeRange, { includeRecordId: true })
  })
  return Number(deps.responseResult(response) ?? 0)
}

const queryAlarmRecordsForHistory = async (
  deps: DeviceAlarmToolDependencies,
  deviceId: string,
  args: Record<string, any>,
  timeRange: ResolvedTimeRange,
  limit: number
) => {
  const response = await queryDeviceAlarmRecord({
    paging: true,
    pageIndex: 0,
    pageSize: limit,
    sorts: [{ name: 'lastAlarmTime', order: 'desc' }],
    terms: buildDeviceAlarmRecordTerms(deviceId, args, timeRange, 'lastAlarmTime')
  })
  return normalizePagedList(deps, response).data.map(normalizeAlarmRecord)
}

const queryHistoryByRecord = async (
  deps: DeviceAlarmToolDependencies,
  alarmRecordId: string,
  args: Record<string, any>,
  timeRange: ResolvedTimeRange,
  pageSize: number
) => {
  const response = await queryLogList(alarmRecordId, {
    paging: true,
    pageIndex: 0,
    pageSize,
    sorts: [{ name: 'alarmTime', order: 'desc' }],
    terms: buildAlarmHistoryTerms(deps, args, timeRange)
  })
  const result = normalizePagedList(deps, response)
  return {
    alarmRecordId,
    total: result.total,
    data: result.data.map((item) => normalizeAlarmHistoryRecord(deps, item))
  }
}

const compareAlarmHistoryDesc = (left: Record<string, any>, right: Record<string, any>) => (
  Number(right.alarmTime || 0) - Number(left.alarmTime || 0)
)

export const createDeviceAlarmClientTools = (
  deps: DeviceAlarmToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => ([
  {
    id: 'device_alarm_records_query',
    name: 'device_alarm_records_query',
    description: deps.t('DeviceDetail.agentTools.alarmRecords.description'),
    inputs: deps.withWriteToPathInput([
      {
        id: 'state',
        name: 'state',
        description: deps.t('DeviceDetail.agentTools.alarm.inputs.state'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'onlyActive',
        name: 'onlyActive',
        description: deps.t('DeviceDetail.agentTools.alarmRecords.inputs.onlyActive'),
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'level',
        name: 'level',
        description: deps.t('DeviceDetail.agentTools.alarm.inputs.level'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.alarmRecords.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'startTime',
        name: 'startTime',
        description: deps.startTimeDescription,
        required: false,
        valueType: 'string'
      },
      {
        id: 'endTime',
        name: 'endTime',
        description: deps.endTimeDescription,
        required: false,
        valueType: 'string'
      },
      deps.timeRangeInput(),
      {
        id: 'limit',
        name: 'limit',
        description: deps.t('DeviceDetail.agentTools.alarmRecords.inputs.limit'),
        required: false,
        valueType: 'int'
      },
      deps.writeLimitInput()
    ]),
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.alarmRecords.help'),
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
      const inlineLimit = deps.clampNumber(args.limit, 1, 50, 20)
      const timeRange = deps.resolveTimeRange(args)
      const collected = await deps.collectPagedToolData({
        args,
        call,
        inlineLimit,
        fetchPage: (pageIndex, pageSize) => queryDeviceAlarmRecord({
          paging: true,
          pageIndex,
          pageSize,
          sorts: [{ name: 'alarmTime', order: 'desc' }],
          terms: buildDeviceAlarmRecordTerms(deviceId, args, timeRange)
        }),
        normalizeRecord: normalizeAlarmRecord
      })
      const previewData = collected.data.slice(0, inlineLimit)
      const base = {
        deviceId,
        source: 'platform-alarm-record',
        state: normalizeAlarmState(args.state || (toBoolean(args.onlyActive) ? 'warning' : undefined)),
        keyword: String(args.keyword || '').trim() || undefined,
        timeRange: deps.describeResolvedTimeRange(timeRange),
        total: collected.total,
        countMeaning: deps.t('DeviceDetail.agentTools.alarmRecords.countMeaning')
      }
      const output = {
        ...base,
        returned: previewData.length,
        truncated: collected.total > previewData.length,
        nextAction: collected.total > previewData.length ? deps.t('DeviceDetail.agentTools.alarmRecords.nextAction.truncated') : undefined,
        data: previewData
      }
      if (collected.file) {
        return {
          ...base,
          ...collected.file,
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.returned > previewData.length,
          dataPreview: previewData
        }
      }
      const fullOutput = {
        ...base,
        returned: collected.returned,
        truncated: collected.truncated,
        writeLimit: collected.writeLimit,
        writeLimitUnlimited: collected.writeLimitUnlimited,
        data: collected.data
      }
      return deps.writeToolResultToSessionFile(args, call, output, {
        content: safeStringify(fullOutput),
        summary: {
          ...base,
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.data.length > previewData.length,
          dataPreview: previewData
        }
      })
    }
  },
  {
    id: 'device_alarm_history_summary',
    name: 'device_alarm_history_summary',
    description: deps.t('DeviceDetail.agentTools.alarmHistorySummary.description'),
    inputs: [
      {
        id: 'alarmRecordId',
        name: 'alarmRecordId',
        description: deps.t('DeviceDetail.agentTools.alarmHistory.inputs.alarmRecordIdOptional'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'alarmConfigId',
        name: 'alarmConfigId',
        description: deps.t('DeviceDetail.agentTools.alarmHistory.inputs.alarmConfigId'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'level',
        name: 'level',
        description: deps.t('DeviceDetail.agentTools.alarm.inputs.level'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.alarmHistory.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'startTime',
        name: 'startTime',
        description: deps.startTimeDescription,
        required: false,
        valueType: 'string'
      },
      {
        id: 'endTime',
        name: 'endTime',
        description: deps.endTimeDescription,
        required: false,
        valueType: 'string'
      },
      deps.timeRangeInput(),
      {
        id: 'sampleLimit',
        name: 'sampleLimit',
        description: deps.t('DeviceDetail.agentTools.alarmHistorySummary.inputs.sampleLimit'),
        required: false,
        valueType: 'int'
      },
      {
        id: 'recordLimit',
        name: 'recordLimit',
        description: deps.t('DeviceDetail.agentTools.alarmHistorySummary.inputs.recordLimit'),
        required: false,
        valueType: 'int'
      }
    ],
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.alarmHistorySummary.help'),
    execute: async (args, context) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
      const sampleLimit = deps.clampNumber(args.sampleLimit, 1, 20, 5)
      const recordLimit = deps.clampNumber(args.recordLimit, 1, 50, 10)
      const timeRange = deps.resolveTimeRange(args)
      const recordIds = alarmRecordIdsFromArgs(deps, args)

      if (recordIds.length) {
        const histories = await Promise.all(
          recordIds.map((recordId) => queryHistoryByRecord(deps, recordId, args, timeRange, sampleLimit))
        )
        const samples = histories
          .flatMap((item) => item.data)
          .sort(compareAlarmHistoryDesc)
          .slice(0, sampleLimit)
        return {
          deviceId,
          source: 'platform-alarm-history',
          countMeaning: deps.t('DeviceDetail.agentTools.alarmHistorySummary.countMeaning.recordIds'),
          alarmRecordIds: recordIds,
          timeRange: deps.describeResolvedTimeRange(timeRange),
          total: histories.reduce((sum, item) => sum + item.total, 0),
          returned: samples.length,
          recordTotals: histories.map((item) => ({
            alarmRecordId: item.alarmRecordId,
            total: item.total
          })),
          samples
        }
      }

      const [total, records] = await Promise.all([
        queryDeviceAlarmHistoryCount(deps, deviceId, args, timeRange),
        queryAlarmRecordsForHistory(deps, deviceId, args, timeRange, recordLimit)
      ])
      const perRecordSampleLimit = Math.max(1, Math.min(sampleLimit, Math.ceil(sampleLimit / Math.max(1, records.length)) + 1))
      const histories = await Promise.all(
        records.map((record) => queryHistoryByRecord(deps, String(record.id), args, timeRange, perRecordSampleLimit))
      )
      const samples = histories
        .flatMap((item) => item.data)
        .sort(compareAlarmHistoryDesc)
        .slice(0, sampleLimit)
      return {
        deviceId,
        source: 'platform-alarm-history',
        countMeaning: deps.t('DeviceDetail.agentTools.alarmHistorySummary.countMeaning.device'),
        timeRange: deps.describeResolvedTimeRange(timeRange),
        keyword: String(args.keyword || '').trim() || undefined,
        total,
        returned: samples.length,
        sampleRecordScope: {
          recordLimit,
          recordTotal: records.length,
          note: deps.t('DeviceDetail.agentTools.alarmHistorySummary.sampleRecordScope.note')
        },
        records: records.map((record) => ({
          ...record,
          historyTotal: histories.find((item) => item.alarmRecordId === record.id)?.total
        })),
        samples
      }
    }
  },
  {
    id: 'device_alarm_history_query',
    name: 'device_alarm_history_query',
    description: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.description'),
    inputs: deps.withWriteToPathInput([
      {
        id: 'alarmRecordId',
        name: 'alarmRecordId',
        description: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.inputs.alarmRecordId'),
        required: true,
        valueType: 'string'
      },
      {
        id: 'level',
        name: 'level',
        description: deps.t('DeviceDetail.agentTools.alarm.inputs.level'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: deps.t('DeviceDetail.agentTools.alarmHistory.inputs.keyword'),
        required: false,
        valueType: 'string'
      },
      {
        id: 'startTime',
        name: 'startTime',
        description: deps.startTimeDescription,
        required: false,
        valueType: 'string'
      },
      {
        id: 'endTime',
        name: 'endTime',
        description: deps.endTimeDescription,
        required: false,
        valueType: 'string'
      },
      deps.timeRangeInput(),
      {
        id: 'limit',
        name: 'limit',
        description: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.inputs.limit'),
        required: false,
        valueType: 'int'
      },
      deps.writeLimitInput()
    ]),
    output: { type: 'object' },
    help: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.help'),
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
      const alarmRecordId = alarmRecordIdsFromArgs(deps, args)[0]
      if (!alarmRecordId) {
        const timeRange = deps.resolveTimeRange(args)
        const candidates = await queryAlarmRecordsForHistory(deps, deviceId, args, timeRange, 10)
        return {
          deviceId,
          needsAlarmRecordId: true,
          candidates,
          nextAction: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.nextAction.selectAlarmRecord')
        }
      }

      const inlineLimit = deps.clampNumber(args.limit, 1, 50, 20)
      const timeRange = deps.resolveTimeRange(args)
      const collected = await deps.collectPagedToolData({
        args,
        call,
        inlineLimit,
        fetchPage: (pageIndex, pageSize) => queryLogList(alarmRecordId, {
          paging: true,
          pageIndex,
          pageSize,
          sorts: [{ name: 'alarmTime', order: 'desc' }],
          terms: buildAlarmHistoryTerms(deps, args, timeRange)
        }),
        normalizeRecord: (item) => normalizeAlarmHistoryRecord(deps, item)
      })
      const previewData = collected.data.slice(0, inlineLimit)
      const base = {
        deviceId,
        alarmRecordId,
        source: 'platform-alarm-history',
        countMeaning: deps.t('DeviceDetail.agentTools.alarmHistoryQuery.countMeaning'),
        timeRange: deps.describeResolvedTimeRange(timeRange),
        total: collected.total
      }
      const output = {
        ...base,
        returned: previewData.length,
        truncated: collected.total > previewData.length,
        nextAction: collected.total > previewData.length ? deps.t('DeviceDetail.agentTools.alarmHistoryQuery.nextAction.truncated') : undefined,
        data: previewData
      }
      if (collected.file) {
        return {
          ...base,
          ...collected.file,
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.returned > previewData.length,
          dataPreview: previewData
        }
      }
      const fullOutput = {
        ...base,
        returned: collected.returned,
        truncated: collected.truncated,
        writeLimit: collected.writeLimit,
        writeLimitUnlimited: collected.writeLimitUnlimited,
        data: collected.data
      }
      return deps.writeToolResultToSessionFile(args, call, output, {
        content: safeStringify(fullOutput),
        summary: {
          ...base,
          returned: collected.returned,
          truncated: collected.truncated,
          fullResultWritten: !collected.truncated,
          writeLimit: collected.writeLimit,
          writeLimitUnlimited: collected.writeLimitUnlimited,
          writeLimitExceeded: collected.truncated,
          inlinePreviewLimit: inlineLimit,
          inlinePreviewReturned: previewData.length,
          inlinePreviewTruncated: collected.data.length > previewData.length,
          dataPreview: previewData
        }
      })
    }
  }
])
