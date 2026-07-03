import {
  queryByDevice as queryDeviceAlarmRecord,
  queryHistoryCount,
  queryLogList
} from '../../../../api/rule-engine/log'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceClientToolContext = {
  device: Record<string, any>
}

interface ResolvedTimeRange {
  start?: number
  end?: number
}

interface DeviceAlarmToolDependencies {
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
    description: '查询平台告警中心中与当前设备关联的告警记录，是回答当前告警状态、有哪些告警、告警是否恢复的首选事实来源。',
    inputs: deps.withWriteToPathInput([
      {
        id: 'state',
        name: 'state',
        description: '告警状态：warning 表示告警中，normal 表示已恢复/正常；为空查询全部。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'onlyActive',
        name: 'onlyActive',
        description: '是否只查询告警中的记录；为 true 时等同 state=warning。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'level',
        name: 'level',
        description: '告警级别，可传单个级别或级别数组。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: '按告警名称、触发描述、告警原因或告警源模糊搜索。',
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
        description: '内联预览条数，默认20，最大50；传 writeToPath 时更多告警记录写入文件。',
        required: false,
        valueType: 'int'
      },
      deps.writeLimitInput()
    ]),
    output: { type: 'object' },
    help: '查询平台告警记录。用户问“有没有告警”“报警中吗”“最近告警原因”“有哪些告警记录”时优先使用此工具；单个告警记录通常只代表当前告警快照，不能用记录条数当触发次数。用户问“触发了多少次/告警历史数量/历史日志”时必须使用 device_alarm_history_summary 或 device_alarm_history_query。需要保存大范围告警列表时传 writeToPath，建议优先使用 .jsonl 路径，也兼容 .ndjson，工具会逐页追加 JSONL/NDJSON；limit 只控制内联预览，writeLimit 控制文件写入条数，完整导出可传 writeLimit=0。',
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')
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
        countMeaning: '告警记录数表示当前设备关联的告警记录快照数量，不等于触发历史次数。触发次数请查询告警日志。'
      }
      const output = {
        ...base,
        returned: previewData.length,
        truncated: collected.total > previewData.length,
        nextAction: collected.total > previewData.length ? '结果已截断，可传 writeToPath 保存更多告警记录；需要统计触发次数请调用 device_alarm_history_summary。' : undefined,
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
    description: '统计当前设备告警日志触发历史数量，并返回少量最新告警日志样本；触发次数以告警日志为准，不以告警记录条数为准。',
    inputs: [
      {
        id: 'alarmRecordId',
        name: 'alarmRecordId',
        description: '可选。告警记录ID；传入后只统计该告警记录的触发日志。为空时统计当前设备全部告警日志。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'alarmConfigId',
        name: 'alarmConfigId',
        description: '可选。告警配置ID；用于限定某个告警配置的触发历史。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'level',
        name: 'level',
        description: '告警级别，可传单个级别或级别数组。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: '按告警配置名称、说明、触发描述、告警原因、告警源或告警详情模糊搜索。',
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
        description: '返回最新告警日志样本条数，默认5，最大20。',
        required: false,
        valueType: 'int'
      },
      {
        id: 'recordLimit',
        name: 'recordLimit',
        description: 'alarmRecordId 为空时，为了返回样本最多先查看多少条告警记录，默认10，最大50；总数统计不受此限制。',
        required: false,
        valueType: 'int'
      }
    ],
    output: { type: 'object' },
    help: '统计告警日志触发次数。用户问“告警触发了多少次”“今天告警历史数量”“历史报警次数”“某告警发生几次”时使用此工具；不要用 device_alarm_records_query 的 total 当触发次数。alarmRecordId 为空时 total 是当前设备告警日志总数；samples 只是从最近告警记录中抽取的少量日志样本。',
    execute: async (args, context) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')
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
          countMeaning: 'total 表示告警日志触发次数。',
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
        countMeaning: 'total 表示告警日志触发次数，不是告警记录条数。',
        timeRange: deps.describeResolvedTimeRange(timeRange),
        keyword: String(args.keyword || '').trim() || undefined,
        total,
        returned: samples.length,
        sampleRecordScope: {
          recordLimit,
          recordTotal: records.length,
          note: 'samples 从最近的告警记录中抽取；total 使用按设备告警日志计数接口统计。'
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
    description: '按告警记录ID分页查询告警日志触发明细；用于查看某一条告警记录背后的历史触发记录。',
    inputs: deps.withWriteToPathInput([
      {
        id: 'alarmRecordId',
        name: 'alarmRecordId',
        description: '告警记录ID。可先用 device_alarm_records_query 获取候选记录。',
        required: true,
        valueType: 'string'
      },
      {
        id: 'level',
        name: 'level',
        description: '告警级别，可传单个级别或级别数组。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: '按告警配置名称、说明、触发描述、告警原因、告警源或告警详情模糊搜索。',
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
        description: '内联预览告警日志条数，默认20，最大50；传 writeToPath 时更多日志写入文件。',
        required: false,
        valueType: 'int'
      },
      deps.writeLimitInput()
    ]),
    output: { type: 'object' },
    help: '查询某条告警记录的告警日志明细。用户问某个告警的历史触发详情、触发时间列表、触发原因变化时使用；如果没有 alarmRecordId，先调用 device_alarm_records_query 选择告警记录。需要保存大范围日志时传 writeToPath，建议优先使用 .jsonl 路径，也兼容 .ndjson；limit 只控制内联预览，writeLimit 控制文件写入条数，完整导出可传 writeLimit=0。',
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')
      const alarmRecordId = alarmRecordIdsFromArgs(deps, args)[0]
      if (!alarmRecordId) {
        const timeRange = deps.resolveTimeRange(args)
        const candidates = await queryAlarmRecordsForHistory(deps, deviceId, args, timeRange, 10)
        return {
          deviceId,
          needsAlarmRecordId: true,
          candidates,
          nextAction: '请从 candidates 中选择 alarmRecordId 后再次调用。'
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
        countMeaning: 'total 表示该告警记录的日志触发次数。',
        timeRange: deps.describeResolvedTimeRange(timeRange),
        total: collected.total
      }
      const output = {
        ...base,
        returned: previewData.length,
        truncated: collected.total > previewData.length,
        nextAction: collected.total > previewData.length ? '结果已截断，可传 writeToPath 保存更多告警日志。' : undefined,
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
