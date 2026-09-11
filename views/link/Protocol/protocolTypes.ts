/**
 * 与后端协议注册方式（jar / local / marketplace）对齐。
 * GET /protocol/providers 返回当前环境支持的类型（如 result: ["jar","local","marketplace"]），用于前端过滤展示。
 */

export const PROTOCOL_TYPE_ORDER = ['jar', 'local', 'marketplace'] as const

export type ProtocolTypeId = (typeof PROTOCOL_TYPE_ORDER)[number]

/**
 * 无法确认环境能力时，只保留本地已有的创建方式。
 * 能力市场必须由运行时明确声明，避免私有化未部署运营端时出现不可用入口。
 */
export const DEFAULT_PROTOCOL_TYPES: ProtocolTypeId[] = ['jar', 'local']

/**
 * 解析 GET /protocol/providers 响应为归一化的小写 id 列表。
 * 支持：字符串数组（如 ["jar","local"]）、{ id } 对象数组、{ jar: true, local: false } 映射。
 */
export function parseProtocolProvidersResponse(res: any): string[] {
  let raw = res?.result ?? res?.data
  if (raw == null && Array.isArray(res)) {
    raw = res
  }
  if (raw == null) return []

  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === 'string') return x.trim().toLowerCase()
        if (x && typeof x === 'object') {
          const id = (x as any).id ?? (x as any).provider ?? (x as any).type ?? (x as any).value
          return id != null ? String(id).trim().toLowerCase() : ''
        }
        return ''
      })
      .filter(Boolean)
  }

  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v === true || v === 'true' || v === 1 || v === 'enabled' || v === '1')
      .map(([k]) => k.trim().toLowerCase())
      .filter(Boolean)
  }

  return []
}

/** 仅保留已知的协议类型 id，并按固定顺序排列 */
export function normalizeSupportedProtocolTypes(ids: string[]): ProtocolTypeId[] {
  const set = new Set(ids.map((s) => s.trim().toLowerCase()))
  return PROTOCOL_TYPE_ORDER.filter((t) => set.has(t))
}
