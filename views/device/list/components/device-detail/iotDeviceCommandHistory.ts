import i18n from '@jetlinks-web-core/locales'

import type { IotDeviceCommandDefinition, IotDeviceCommandExecution, IotDeviceLog } from '../../types'
import type { RealtimePropertyRow } from './iotDeviceDetail.types'

type Dict = Record<string, unknown>
const $t = i18n.global.t

export interface CommandHistoryRow {
  id: string
  action: 'read' | 'write' | 'invoke'
  actionText: string
  name: string
  identifier: string
  time: string
  status: IotDeviceCommandExecution['status']
  statusText: string
  operator: string
  duration: string
  payload: string
  replyPayload?: string
}

interface ParsedLog {
  item: Dict
  index: number
  typeValue: string
  typeText: string
  content: unknown
  parsed: Dict
  action?: CommandHistoryRow['action']
  messageId?: string
  isFunctionReply: boolean
}

export function createPropertyMap(properties: RealtimePropertyRow[]) {
  return new Map(properties.flatMap((item) => [[item.identifier, item], [item.id, item]]))
}

export function createCommandMap(commands: IotDeviceCommandDefinition[]) {
  return new Map(commands.flatMap((item) => [[item.identifier, item], [item.id, item]]))
}

export function buildCommandHistoryRows(
  logs: Dict[],
  properties: RealtimePropertyRow[],
  commands: IotDeviceCommandDefinition[],
): CommandHistoryRow[] {
  const propertyMap = createPropertyMap(properties)
  const commandMap = createCommandMap(commands)
  const parsedLogs = logs.map((item, index) => normalizeApiLog(item, index))
  const functionReplies = new Map<string, ParsedLog>()

  parsedLogs.forEach((log) => {
    if (log.isFunctionReply && log.messageId && !functionReplies.has(log.messageId)) functionReplies.set(log.messageId, log)
  })

  return parsedLogs
    .map((log) => mapApiLog(log, propertyMap, commandMap, functionReplies.get(log.messageId || '')))
    .filter((item): item is CommandHistoryRow => Boolean(item))
}

export function buildFallbackCommandHistoryRows(
  logs: IotDeviceLog[],
  properties: RealtimePropertyRow[],
  commands: IotDeviceCommandDefinition[],
): CommandHistoryRow[] {
  const propertyMap = createPropertyMap(properties)
  const commandMap = createCommandMap(commands)
  return logs
    .map((log) => mapFallbackLog(log, propertyMap, commandMap))
    .filter((item): item is CommandHistoryRow => Boolean(item))
}

function normalizeApiLog(item: Dict, index: number): ParsedLog {
  const type = toDict(item.type)
  const typeValue = toText(type?.value ?? item.type ?? item.messageType)
  const typeText = toText(type?.text ?? type?.label ?? type?.value ?? item.type ?? item.messageType)
  const content = item.content ?? item.message ?? item.payload ?? ''
  const parsed = parsePayload(content || item)
  const action = inferAction(typeValue, typeText, content)
  const messageId = inferMessageId(item, parsed)
  const isFunctionReply = isFunctionReplyLog(typeValue, typeText, content)

  return {
    item,
    index,
    typeValue,
    typeText,
    content,
    parsed,
    action,
    messageId,
    isFunctionReply,
  }
}

function mapApiLog(
  log: ParsedLog,
  propertyMap: Map<string, RealtimePropertyRow>,
  commandMap: Map<string, IotDeviceCommandDefinition>,
  reply?: ParsedLog,
): CommandHistoryRow | undefined {
  if (!log.action) return undefined
  const { item, parsed, action, typeValue, typeText, index } = log
  const identifier = inferIdentifier(item, parsed, action)

  return {
    id: toText(item.id) || `${toText(item.timestamp || item.createTime)}-${typeValue || typeText || index}`,
    action,
    actionText: actionLabel(action),
    name: inferName(item, action, identifier, propertyMap, commandMap),
    identifier,
    time: formatHistoryTime(item.timestamp || item.createTime),
    status: inferStatus(reply?.item || item, reply?.parsed),
    statusText: inferStatusText(reply?.item || item, reply?.parsed),
    operator: inferOperator(item),
    duration: inferDuration(reply?.item || item),
    payload: formatPayloadSummary(parsed, action, identifier, 'request'),
    ...(action === 'invoke' && reply ? { replyPayload: formatPayloadSummary(reply.parsed, action, identifier, 'reply') } : {}),
  }
}

function mapFallbackLog(
  log: IotDeviceLog,
  propertyMap: Map<string, RealtimePropertyRow>,
  commandMap: Map<string, IotDeviceCommandDefinition>,
): CommandHistoryRow | undefined {
  const action = inferAction(log.title, log.title, log.message)
  if (!action) return undefined
  const parsed = parsePayload(log.message)
  const identifier = inferIdentifier(log as unknown as Dict, parsed, action)
  return {
    id: `fallback-${log.id}`,
    action,
    actionText: actionLabel(action),
    name: inferName({ type: { text: log.title } }, action, identifier, propertyMap, commandMap),
    identifier,
    time: log.happenedAt,
    status: log.level === 'error' ? 'failed' : 'success',
    statusText: log.level === 'error' ? $t('IotDeviceDetail.common.status.failed') : $t('IotDeviceDetail.common.status.success'),
    operator: $t('IotDeviceDetail.commandHistory.deviceLog'),
    duration: '--',
    payload: formatPayloadSummary(parsed, action, identifier, 'request'),
  }
}

function inferAction(...values: unknown[]): CommandHistoryRow['action'] | undefined {
  const text = values.map((item) => toText(item)).join(' ')
  if (isNonAggregatedReply(text)) return undefined
  if (/readProperty|READ_PROPERTY|读取属性/.test(text)) return 'read'
  if (/writeProperty|WRITE_PROPERTY|修改属性|写入属性/.test(text)) return 'write'
  if (/functionInvoke|INVOKE_FUNCTION|调用功能/.test(text) && !isFunctionReplyLog(text, '', '')) return 'invoke'
  return undefined
}

function isNonAggregatedReply(text: string) {
  return /readPropertyReply|writePropertyReply|READ_PROPERTY_REPLY|WRITE_PROPERTY_REPLY|读取属性回复|修改属性回复/.test(text)
}

function isFunctionReplyLog(...values: unknown[]) {
  const text = values.map((item) => toText(item)).join(' ')
  return /functionReply|INVOKE_FUNCTION_REPLY|调用功能回复/.test(text)
}

function actionLabel(action: CommandHistoryRow['action']) {
  if (action === 'read') return $t('IotDeviceDetail.commandCenter.read')
  if (action === 'write') return $t('IotDeviceDetail.commandCenter.write')
  return $t('IotDeviceDetail.commandCenter.invoke')
}

function inferName(
  item: Dict,
  action: CommandHistoryRow['action'],
  identifier: string,
  propertyMap: Map<string, RealtimePropertyRow>,
  commandMap: Map<string, IotDeviceCommandDefinition>,
) {
  const type = toDict(item.type)
  const fromMeta = action === 'invoke' ? commandMap.get(identifier)?.name : propertyMap.get(identifier)?.name
  return toText(fromMeta || item.name || item.propertyName || item.functionName || type?.text || actionLabel(action))
}

function inferIdentifier(item: Dict, parsed: Dict, action: CommandHistoryRow['action']) {
  if (action === 'invoke') {
    return toText(item.identifier || item.functionId || parsed.functionId || parsed.function_id || '--')
  }
  const propertyValue = item.identifier || item.property || parsed.property || parsed.propertyId || parsed.property_id
  if (propertyValue) return toText(propertyValue)
  if (Array.isArray(parsed.properties)) return toText(parsed.properties[0] || '--')
  if (parsed.properties && typeof parsed.properties === 'object') return Object.keys(parsed.properties as Dict)[0] || '--'
  return '--'
}

function inferMessageId(item: Dict, parsed: Dict) {
  const headers = toDict(parsed.headers)
  return toText(item.messageId || item.message_id || item.msgId || parsed.messageId || parsed.message_id || parsed.msgId || headers?.messageId)
}

function inferStatus(item: Dict, parsed: Dict = {}): IotDeviceCommandExecution['status'] {
  const state = toDict(item.state)
  const status = toDict(item.status)
  const text = toText(state?.value || item.state || status?.value || item.status || parsed.success || parsed.code)
  if (/false|fail|error|失败|异常/i.test(text)) return 'failed'
  if (/running|progress|pending|等待|下发中/i.test(text)) return 'running'
  return 'success'
}

function inferStatusText(item: Dict, parsed: Dict = {}) {
  const status = inferStatus(item, parsed)
  if (status === 'failed') return $t('IotDeviceDetail.common.status.failed')
  if (status === 'running') return $t('IotDeviceDetail.common.status.sending')
  return $t('IotDeviceDetail.common.status.success')
}

function inferOperator(item: Dict) {
  return toText(item.operatorName || item.operator || item.createBy || $t('IotDeviceDetail.commandHistory.deviceLog'))
}

function inferDuration(item: Dict) {
  if (item.duration) return toText(item.duration)
  if (item.costTime) return `${toText(item.costTime)}ms`
  return '--'
}

function parsePayload(value: unknown): Dict {
  if (!value || typeof value === 'object') return (value || {}) as Dict
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Dict : {}
  } catch {
    return { raw: value }
  }
}

function formatPayloadSummary(
  parsed: Dict,
  action: CommandHistoryRow['action'],
  identifier: string,
  scene: 'request' | 'reply',
) {
  if (action === 'invoke') {
    if (scene === 'reply') return compactObject(parsed.output ?? parsed.outputs ?? parsed.result ?? parsed.data ?? parsed)
    return compactObject(parsed.inputs ?? parsed.params ?? parsed.parameters ?? parsed)
  }
  if (action === 'read') {
    const value = Array.isArray(parsed.properties) ? parsed.properties : [identifier].filter((item) => item && item !== '--')
    return compactObject({ properties: value })
  }
  const properties = toDict(parsed.properties)
  const propertyPayload = properties?.[identifier] ?? parsed.properties ?? parsed
  return compactObject(propertyPayload)
}

function compactObject(value: unknown) {
  let text: string
  if (typeof value !== 'string') {
    text = JSON.stringify(value, null, 2) ?? '--'
  } else {
    try {
      text = JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      text = value || '--'
    }
  }
  const compacted = text
    .replace(/^\{\n?\s*|\n?\s*\}$/g, '')
    .replace(/\n\s*/g, ' ')
    .trim()
  return compacted || '--'
}

function formatHistoryTime(value: unknown, fallback = '--'): string {
  if (!value) return fallback
  const date = new Date(typeof value === 'number' ? value : String(value))
  if (Number.isNaN(date.getTime())) return toText(value)
  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toDict(value: unknown): Dict | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Dict : undefined
}

function toText(value: unknown) {
  return value === undefined || value === null ? '' : String(value)
}
