/**
 * 与后端插件安装方式（jar / marketplace）对齐。
 * GET /plugin/driver/providers 返回当前环境支持的 provider，用于前端过滤来源选项。
 */

export const PLUGIN_PROVIDER_ORDER = ['jar', 'marketplace'] as const

export type PluginProviderId = (typeof PLUGIN_PROVIDER_ORDER)[number]

/** 默认展示顺序（接口失败或未配置时的回退） */
export const DEFAULT_PLUGIN_PROVIDERS: PluginProviderId[] = [...PLUGIN_PROVIDER_ORDER]

/**
 * 解析 GET /plugin/driver/providers 响应为归一化的小写 id 列表。
 * 支持：字符串数组（如 ["jar","marketplace"]）、{ id } 对象数组、{ jar: true } 映射。
 */
export function parsePluginProvidersResponse(res: any): string[] {
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

/** 仅保留当前页面已支持的 provider id，并按固定顺序排列 */
export function normalizeSupportedPluginProviders(ids: string[]): PluginProviderId[] {
  const set = new Set(ids.map((s) => s.trim().toLowerCase()))
  return PLUGIN_PROVIDER_ORDER.filter((t) => set.has(t))
}
