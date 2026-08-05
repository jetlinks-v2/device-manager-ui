type I18nDisplayRecord = Record<string, unknown>

const toI18nField = (field: string) => `i18n${field.charAt(0).toUpperCase()}${field.slice(1)}`

/**
 * 优先使用服务端根据请求语言解析的展示字段，兼容未迁移的历史数据。
 */
export const getI18nText = (source: I18nDisplayRecord | null | undefined, field: string): string => {
  if (!source) {
    return ''
  }

  const localized = source[toI18nField(field)]
  if (typeof localized === 'string' && localized.trim()) {
    return localized
  }

  const value = source[field]
  return typeof value === 'string' ? value : ''
}
