/**
 * 设备诊断链路中的日志级别（后端 TraceData.logLevel，如 INFO、WARN）
 */

/** 规范化展示：大写、去空白 */
export function normalizeLogLevel(logLevel?: string | null): string {
  if (logLevel == null || logLevel === '') return ''
  const t = String(logLevel).trim()
  return t ? t.toUpperCase() : ''
}

/**
 * 从 WebSocket 下发的单条追踪对象上解析级别（兼容 logLevel / log_level / level）
 */
export function resolveLogLevelFromTracePayload(payload: unknown): string {
  if (payload == null || typeof payload !== 'object') return ''
  const p = payload as Record<string, unknown>
  const raw = p.logLevel ?? p.log_level ?? p.level
  if (typeof raw === 'string' && raw.trim()) return normalizeLogLevel(raw)
  return ''
}

/** Ant Design Vue Tag 的 color 属性值 */
export function antTagColorForLogLevel(level: string): string {
  const lv = level.toUpperCase()
  if (lv === 'ERROR' || lv === 'FATAL') return 'error'
  if (lv === 'WARN' || lv === 'WARNING') return 'warning'
  if (lv === 'INFO') return 'processing'
  if (lv === 'DEBUG') return 'cyan'
  if (lv === 'TRACE') return 'default'
  return 'default'
}
