export type TraceInputResult = { valid: true; traceId: string } | { valid: false }

/** 只接受完整 ID 或同一链路的 version 00 traceparent；合并响应头不能混入其他链路或任意文本。 */
export function parseTraceInput(value: string): TraceInputResult {
  const text = value.trim()
  const validId = (id: string) => /^[0-9a-f]{32}$/i.test(id) && !/^0+$/.test(id)
  if (validId(text)) return { valid: true, traceId: text.toLowerCase() }
  const parent = text.replace(/^traceparent[\t ]*:[\t ]*/i, '')
  if (/[\r\n]/.test(parent)) return { valid: false }
  let traceId = ''
  for (const item of parent.split(',')) {
    const match = /^[\t ]*00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})[\t ]*$/i.exec(item)
    if (!match || !validId(match[1]) || /^0+$/.test(match[2])) return { valid: false }
    const currentId = match[1].toLowerCase()
    if (traceId && traceId !== currentId) return { valid: false }
    traceId = currentId
  }
  return { valid: true, traceId }
}
