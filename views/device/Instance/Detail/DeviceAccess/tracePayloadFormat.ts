/** 与后端 EncodedMessage / ByteBufUtil.prettyHexDump、JSON、HTTP 等展示形态对齐的粗分类 */
export type TracePayloadFormat =
  | 'hex_dump'
  | 'hex_plain'
  | 'json'
  | 'json_device'
  | 'http'
  | 'mqtt_like'
  | 'text'

export const MAX_TRACE_PAYLOAD_CHARS = 32000

export type DeviceMessageInfo = {
  messageType: string
  deviceId?: string
  properties?: Record<string, unknown> | string[]
  propertyIds?: string[]
  functionId?: string
  inputs?: unknown
  output?: unknown
  event?: string
  data?: unknown
}

export function truncatePayload(
  raw: string,
  max: number = MAX_TRACE_PAYLOAD_CHARS,
): { text: string; truncated: boolean } {
  if (raw == null || raw === '') return { text: '', truncated: false }
  if (raw.length <= max) return { text: raw, truncated: false }
  return { text: `${raw.slice(0, max)}\n…`, truncated: true }
}

/** 后端 DeviceDebugSubscriptionProvider 可能用 \n\n 拼接 message + response；分段为空时退回整段，避免详情空白 */
export function splitTracePayloadSections(raw: string): string[] {
  if (!raw) return []
  const parts = raw.split(/\n{3,}/)
  if (parts.length > 1) {
    const m = parts.map((p) => p.trim()).filter(Boolean)
    if (m.length) return m
  }
  const double = raw.split(/\n\n/)
  if (double.length > 1) {
    const m = double.map((p) => p.trim()).filter(Boolean)
    if (m.length) return m
  }
  return [raw]
}

/** Netty ByteBufUtil.prettyHexDump：含框线 + ASCII 列 */
export function isNettyHexDump(text: string): boolean {
  return (
    text.includes('+---') &&
    text.includes('+') &&
    text.includes('|') &&
    /[0-9a-fA-F]{8}\|/.test(text)
  )
}

/** 从 prettyHexDump 行中提取十六进制字节（Netty ByteBufUtil.prettyHexDump） */
export function parseNettyHexDumpBytes(text: string): Uint8Array | null {
  const bytes: number[] = []
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*\|[0-9a-fA-F]+\|\s*([0-9a-fA-F\s]+?)\s*\|/)
    if (!m) continue
    const pairs = m[1].match(/[0-9a-fA-F]{2}/g)
    if (!pairs) continue
    for (const p of pairs) bytes.push(parseInt(p, 16))
  }
  return bytes.length ? new Uint8Array(bytes) : null
}

/** 每行 16 字节，空格分隔，左侧 offset */
export function formatHexByteLines(bytes: Uint8Array, perRow = 16): string {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += perRow) {
    const chunk = bytes.slice(i, i + perRow)
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, '0')).join(' ')
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}`)
  }
  return lines.join('\n')
}

/** 单行纯 hex（无空格或仅空格） */
export function isHexPlainLine(text: string): boolean {
  const t = text.trim().replace(/\s+/g, '')
  return t.length >= 8 && t.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(t)
}

export function parseHexPlain(text: string): Uint8Array | null {
  const t = text.trim().replace(/\s+/g, '')
  if (t.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(t)) return null
  const out = new Uint8Array(t.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

const HTTP_FIRST_LINE = /^(?:HTTP\/\d|[A-Z]+ \S+ HTTP\/\d)/m

export function isHttpLike(text: string): boolean {
  const s = text.trimStart()
  return HTTP_FIRST_LINE.test(s) || /^[A-Z]+ \S+ HTTP\/\d/i.test(s)
}

/** MQTT 文本日志常见：topic / QoS / retain 等关键字 */
export function isMqttLike(text: string): boolean {
  const s = text.slice(0, 800).toLowerCase()
  return (
    (s.includes('topic') && (s.includes('qos') || s.includes('mqtt'))) ||
    (s.includes('publish') && s.includes('topic') && s.includes('payload'))
  )
}

export function tryParseJson(text: string): unknown | null {
  const t = text.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return null
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

/**
 * 判断是否为 JetLinks 设备消息 JSON（含 messageType）
 */
export function extractDeviceMessageInfo(
  parsed: unknown,
): DeviceMessageInfo | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  const mt = o.messageType ?? o.message_type
  if (typeof mt !== 'string' || !mt) return null
  const propertyIdsFromArray = Array.isArray(o.properties)
    ? (o.properties as unknown[]).filter((x): x is string => typeof x === 'string')
    : undefined
  return {
    messageType: mt,
    deviceId: typeof o.deviceId === 'string' ? o.deviceId : undefined,
    properties:
      o.properties && typeof o.properties === 'object' && !Array.isArray(o.properties)
        ? (o.properties as Record<string, unknown>)
        : undefined,
    // READ_PROPERTY 常见结构：properties: ['temp1', ...]
    propertyIds:
      (Array.isArray(o.propertyIds)
        ? (o.propertyIds as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined) || propertyIdsFromArray,
    functionId: typeof o.functionId === 'string' ? o.functionId : undefined,
    inputs: o.inputs,
    output: o.output,
    event: typeof o.event === 'string' ? o.event : undefined,
    data: o.data,
  }
}

export function isPropertyRelatedMessage(msg: DeviceMessageInfo): boolean {
  return (
    [
      'REPORT_PROPERTY',
      'WRITE_PROPERTY',
      'READ_PROPERTY',
      'READ_PROPERTY_REPLY',
      'WRITE_PROPERTY_REPLY',
    ].includes(msg.messageType) || !!msg.properties || !!msg.propertyIds
  )
}

export function isFunctionRelatedMessage(msg: DeviceMessageInfo): boolean {
  return (
    ['INVOKE_FUNCTION', 'INVOKE_FUNCTION_REPLY'].includes(msg.messageType) ||
    !!msg.functionId
  )
}

export function isEventRelatedMessage(msg: DeviceMessageInfo): boolean {
  return msg.messageType === 'EVENT_REPORT' || !!msg.event
}

export function detectPayloadFormat(text: string): TracePayloadFormat {
  const t = text || ''
  if (!t.trim()) return 'text'
  if (isNettyHexDump(t)) return 'hex_dump'
  const trimmed = t.trim()
  if (trimmed.length < 4000 && isHexPlainLine(trimmed)) return 'hex_plain'
  if (isHttpLike(t)) return 'http'
  if (isMqttLike(t)) return 'mqtt_like'
  const j = tryParseJson(trimmed)
  if (j !== null) {
    if (extractDeviceMessageInfo(j)) return 'json_device'
    return 'json'
  }
  return 'text'
}

export function prettyJsonString(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

/** 详情卡片标题行：与 TracePayloadViewer 首段相同的格式识别（用于标签展示） */
export function getFirstSectionPayloadMeta(content: string): {
  format: TracePayloadFormat
  truncated: boolean
  messageType?: string
  deviceId?: string
} {
  const rawContent = content ?? ''
  const split = splitTracePayloadSections(rawContent)
  const parts = split.length > 0 ? split : [rawContent]
  const first = parts[0] ?? ''
  const { text, truncated } = truncatePayload(first, MAX_TRACE_PAYLOAD_CHARS)
  const fmt0 = detectPayloadFormat(text)
  const trimmed = text.trim()
  const parsed = fmt0 === 'json' || fmt0 === 'json_device' ? tryParseJson(trimmed) : null
  const deviceInfo =
    parsed != null && fmt0 === 'json_device' ? extractDeviceMessageInfo(parsed) : null
  const format = deviceInfo ? 'json_device' : fmt0
  return {
    format,
    truncated,
    messageType: deviceInfo?.messageType,
    deviceId: deviceInfo?.deviceId,
  }
}

/** 属性条数：properties 键数量优先，否则 propertyIds 长度 */
export function countPropertyEntriesFromDeviceInfo(info: DeviceMessageInfo): number {
  if (info.properties && typeof info.properties === 'object' && !Array.isArray(info.properties)) {
    return Object.keys(info.properties).length
  }
  if (Array.isArray(info.properties)) return info.properties.length
  if (info.propertyIds?.length) return info.propertyIds.length
  return 0
}

function normalizeTimestampToMs(v: number): number | null {
  if (!Number.isFinite(v)) return null
  if (v > 1e15) return Math.floor(v / 1_000_000)
  if (v > 1e11) return v
  if (v > 0 && v < 1e11) return v * 1000
  return null
}

/** 从设备消息 JSON 根或 headers / message 子对象读取毫秒时间戳 */
export function extractTimestampMsFromDevicePayload(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const tryVal = (raw: unknown): number | null => {
    if (typeof raw === 'number') return normalizeTimestampToMs(raw)
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return normalizeTimestampToMs(Number(raw))
    return null
  }
  const o = parsed as Record<string, unknown>
  const direct = tryVal(o.timestamp)
  if (direct != null) return direct
  const headers = o.headers
  if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
    const h = tryVal((headers as Record<string, unknown>).timestamp)
    if (h != null) return h
  }
  const msg = o.message
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    const m = tryVal((msg as Record<string, unknown>).timestamp)
    if (m != null) return m
  }
  return null
}

/**
 * 与详情标题描述一致：`YYYY-MM-DD HH:mm:ss:fff`（毫秒前为 `:`，与产品习惯对齐）
 */
export function formatDevicePayloadTimestamp(ms: number): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number, w: number) => String(n).padStart(w, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)} ${pad(
    d.getHours(),
    2,
  )}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}:${pad(d.getMilliseconds(), 3)}`
}

/** 首段设备消息 JSON（与 TracePayloadViewer 首段分段规则一致） */
export function parseFirstSectionDevicePayload(detail: string): {
  parsed: Record<string, unknown>
  info: DeviceMessageInfo
} | null {
  const rawContent = detail ?? ''
  const split = splitTracePayloadSections(rawContent)
  const parts = split.length > 0 ? split : [rawContent]
  const first = parts[0] ?? ''
  const { text } = truncatePayload(first, MAX_TRACE_PAYLOAD_CHARS)
  const trimmed = text.trim()
  const parsedJson = tryParseJson(trimmed)
  if (parsedJson == null || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) return null
  const info = extractDeviceMessageInfo(parsedJson)
  if (!info) return null
  return { parsed: parsedJson as Record<string, unknown>, info }
}
