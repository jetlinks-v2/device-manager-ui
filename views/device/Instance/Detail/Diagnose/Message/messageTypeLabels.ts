/**
 * 与 org.jetlinks.core.message.MessageType 枚举名对齐（大写 SNAKE_CASE）。
 * 兼容历史别名、连字符/空格写法，便于命中 InstanceDeviceAccess.msgType.* 文案。
 *
 * @see dev/jetlinks/jetlinks-core/src/main/java/org/jetlinks/core/message/MessageType.java
 */

/** 旧协议或前端历史 key → MessageType.name() */
const LEGACY_TO_CANONICAL: Record<string, string> = {
  EVENT_REPORT: 'EVENT',
  OFFLINE_REPORT: 'OFFLINE',
  ONLINE_REPORT: 'ONLINE',
  CHILD_DEVICE_MESSAGE: 'CHILD',
}

/**
 * @returns 规范化后的 messageType 键；无法识别时返回 undefined
 */
export function normalizeMessageTypeKey(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined
  let t = String(raw).trim()
  if (!t) return undefined
  t = t.replace(/[\s-]+/g, '_')
  const upper = t.toUpperCase()
  return LEGACY_TO_CANONICAL[upper] ?? upper
}
