import {
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentInteger,
  resolveDomainAgentTimeRange,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { IotDevice } from '../types'
import { iotDeviceDetailRealApi } from '../services/iotDeviceDetailReal.service'
import {
  asRecord,
  enumValue,
  inputError,
  normalizeText,
  pageResult,
  runDetailTool,
  safePayload,
  safeText,
  withDeviceDetailModelSample,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'

const normalizeAlarmState = (value: unknown) => {
  const state = normalizeText(value).toLowerCase()
  if (!state) return undefined
  if (['open', 'active', 'warning', '告警', '告警中', '待处理'].includes(state)) return 'warning'
  if (['handled', 'normal', 'resolved', 'closed', '已处理', '已恢复'].includes(state)) return 'normal'
  return state
}

const buildTimeTerm = (range: { start: number; end: number }, column = 'alarmTime') => ({
  column,
  termType: 'btw',
  value: [range.start, range.end],
})

const buildAlarmRecordTerms = (
  deviceId: string,
  args: DeviceDetailAgentArgs,
  range: { start: number; end: number },
  timeColumn = 'alarmTime',
) => {
  const terms: Array<Record<string, unknown>> = [
    {
      type: 'and',
      terms: [
        { column: 'sourceId', termType: 'eq', value: deviceId },
        { column: 'targetType', termType: 'eq', value: 'device' },
      ],
    },
    buildTimeTerm(range, timeColumn),
  ]
  const state = normalizeAlarmState(args.state)
  if (state) terms.push({ column: 'state', termType: 'eq', value: state })
  if (args.level !== undefined && args.level !== '') {
    terms.push({ column: 'level', termType: 'eq', value: args.level })
  }
  const keyword = normalizeText(args.keyword)
  if (keyword) {
    terms.push({
      type: 'or',
      terms: ['alarmName', 'triggerDesc', 'actualDesc', 'sourceName']
        .map(column => ({ column, termType: 'like', value: keyword })),
    })
  }
  return terms
}

const mapAlarmRecord = (value: unknown) => {
  const row = asRecord(value)
  return {
    id: normalizeText(row.id),
    name: safeText(row.alarmName || row.alarmConfigName || row.ruleName, 300),
    alarmConfigId: normalizeText(row.alarmConfigId) || undefined,
    level: row.level,
    state: enumValue(row.state),
    alarmTime: row.alarmTime || row.createTime,
    lastAlarmTime: row.lastAlarmTime,
    trigger: safeText(row.triggerDesc, 600) || undefined,
    actual: safeText(row.actualDesc, 600) || undefined,
    summary: safeText(row.actualDesc || row.triggerDesc || row.description, 800),
    deviceId: normalizeText(row.sourceId || row.targetId),
    deviceName: safeText(row.sourceName || row.targetName, 300),
    handleTime: row.handleTime,
    handleType: row.handleType ? enumValue(row.handleType) : undefined,
  }
}

const mapAlarmHistory = (value: unknown) => {
  const row = asRecord(value)
  return {
    id: normalizeText(row.id),
    alarmRecordId: normalizeText(row.alarmRecordId),
    alarmConfigId: normalizeText(row.alarmConfigId),
    alarmName: safeText(row.alarmConfigName || row.alarmName, 300),
    level: row.level,
    alarmTime: row.alarmTime || row.createTime,
    trigger: safeText(row.triggerDesc, 600) || undefined,
    actual: safeText(row.actualDesc, 600) || undefined,
    description: safeText(row.description, 600) || undefined,
    alarmInfo: row.alarmInfo ? safePayload(row.alarmInfo, 1200) : undefined,
  }
}

export const createDeviceDetailAlarmService = (device: IotDevice) => {
  const queryRecordPage = async (
    args: DeviceDetailAgentArgs,
    range: ReturnType<typeof resolveDomainAgentTimeRange>,
    pageIndex: number,
    pageSize: number,
    extraTerms: Array<Record<string, unknown>> = [],
  ) => pageResult(await iotDeviceDetailRealApi.queryAlarmByDevice({
    paging: true,
    pageIndex,
    pageSize,
    sorts: [{ name: 'alarmTime', order: 'desc' }],
    terms: [...buildAlarmRecordTerms(device.id, args, range), ...extraTerms],
  }))

  const requireRecord = async (recordId: string) => {
    if (!recordId) throw inputError('DEVICE_ALARM_RECORD_REQUIRED', 'alarmRecordIdRequired')
    const range = { start: 0, end: Date.now() }
    const page = await queryRecordPage({}, range, 0, 1, [
      { column: 'id', termType: 'eq', value: recordId },
    ])
    const record = page.data.map(mapAlarmRecord).find(item => item.id === recordId)
    if (!record) throw inputError('DEVICE_ALARM_RECORD_NOT_FOUND', 'alarmRecordNotFound', { recordId })
    return record
  }

  const alarmRecords = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const range = resolveDomainAgentTimeRange(args)
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize ?? args.limit, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const page = await queryRecordPage(args, range, pageIndex, pageSize)
    const data = page.data.map(mapAlarmRecord)
    const hasNext = (pageIndex + 1) * pageSize < page.total
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      filters: { state: args.state, level: args.level, keyword: args.keyword },
      summary: { deviceId: device.id, returned: data.length, total: page.total },
      data,
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: data.length,
        totalCount: page.total,
      }),
      truncated: hasNext,
      nextPage: hasNext ? pageIndex + 1 : undefined,
      supportsAbsenceClaim: page.total === 0 && !hasNext,
    })
  })

  const alarmHistorySummary = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const range = resolveDomainAgentTimeRange(args)
    const sampleLimit = resolveDomainAgentInteger(args.sampleLimit, { name: 'sampleLimit', defaultValue: 5, min: 1, max: 20 })
    const recordLimit = resolveDomainAgentInteger(args.recordLimit, { name: 'recordLimit', defaultValue: 10, min: 1, max: 20 })
    const recordId = normalizeText(args.alarmRecordId)
    if (recordId) await requireRecord(recordId)
    const records = recordId
      ? [{ id: recordId }]
      : (await queryRecordPage(args, range, 0, recordLimit)).data.map(mapAlarmRecord)
    const histories = await Promise.all(records.map(async (record) => {
      const id = normalizeText(record.id)
      const page = pageResult(await iotDeviceDetailRealApi.queryAlarmRecordLogs(id, {
        paging: true,
        pageIndex: 0,
        pageSize: sampleLimit,
        sorts: [{ name: 'alarmTime', order: 'desc' }],
        terms: [buildTimeTerm(range)],
      }))
      return { alarmRecordId: id, total: page.total, data: page.data.map(mapAlarmHistory) }
    }))
    const totalResponse = recordId
      ? undefined
      : await iotDeviceDetailRealApi.countAlarmHistoryByDevice(device.id, { terms: [buildTimeTerm(range)] })
    const total = recordId
      ? histories.reduce((sum, item) => sum + item.total, 0)
      : Number((asRecord(totalResponse).result ?? totalResponse) || 0)
    const samples = histories.flatMap(item => item.data)
      .sort((left, right) => Number(right.alarmTime || 0) - Number(left.alarmTime || 0))
      .slice(0, sampleLimit)
    return withDeviceDetailModelSample(createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, alarmRecordId: recordId || undefined, total, sampleCount: samples.length },
      data: { total, records: histories.map(({ alarmRecordId, total: count }) => ({ alarmRecordId, total: count })), samples },
      total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: total,
        totalCount: total,
      }),
      supportsAbsenceClaim: total === 0,
    }), samples.length)
  })

  const alarmHistoryQuery = (args: DeviceDetailAgentArgs) => runDetailTool<Array<Record<string, unknown>>>([], async () => {
    const recordId = normalizeText(args.alarmRecordId)
    await requireRecord(recordId)
    const range = resolveDomainAgentTimeRange(args)
    const pageIndex = resolveDomainAgentInteger(args.pageIndex, { name: 'pageIndex', defaultValue: 0, min: 0, max: 10000 })
    const pageSize = resolveDomainAgentInteger(args.pageSize ?? args.limit, { name: 'pageSize', defaultValue: 20, min: 1, max: 50 })
    const page = pageResult(await iotDeviceDetailRealApi.queryAlarmRecordLogs(recordId, {
      paging: true,
      pageIndex,
      pageSize,
      sorts: [{ name: 'alarmTime', order: 'desc' }],
      terms: [buildTimeTerm(range)],
    }))
    const data = page.data.map(mapAlarmHistory)
    const hasNext = (pageIndex + 1) * pageSize < page.total
    return createDomainAgentToolResult({
      domain: 'device',
      timeRange: range,
      summary: { deviceId: device.id, alarmRecordId: recordId, returned: data.length, total: page.total },
      data,
      total: page.total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: data.length,
        totalCount: page.total,
      }),
      truncated: hasNext,
      nextPage: hasNext ? pageIndex + 1 : undefined,
      supportsAbsenceClaim: page.total === 0 && !hasNext,
    })
  })

  return { alarmRecords, alarmHistorySummary, alarmHistoryQuery }
}
