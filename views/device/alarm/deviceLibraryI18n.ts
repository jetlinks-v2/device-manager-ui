import i18n from '@jetlinks-web-core/locales'
import type { ThingPropertyPreprocess } from './types'

type RecordValue = Record<string, any>

const asRecord = (value: unknown): RecordValue => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as RecordValue
  if (typeof value !== 'string') return {}
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return {}
  }
}

const text = (value: unknown) => value == null ? '' : String(value).trim()

/**
 * 将设备库包中的原始预处理器转换为当前界面语言的展示数据；安装请求仍保留原始多语言配置。
 */
export function localizeDeviceLibraryPreprocessors(
  preprocessors: ThingPropertyPreprocess[],
  template: RecordValue,
): ThingPropertyPreprocess[] {
  const propertyNames = new Map(
    propertiesOf(template).map((property) => [
      text(property.id ?? property.identifier ?? property.key),
      resolveI18nText(property.i18nMessages, 'name', text(property.name)),
    ]),
  )

  return preprocessors.map((preprocessor) => {
    const raw = asRecord(preprocessor)
    const property = text(raw.property)
    const name = resolveI18nText(raw.i18nMessages, 'name', text(raw.name))
    return {
      ...preprocessor,
      name,
      propertyName: propertyNames.get(property) || text(raw.propertyName) || property,
      configuration: localizeAlarmConfiguration(raw.configuration, name),
    }
  })
}

export function resolveI18nText(messages: unknown, field: string, fallback: string): string {
  const values = asRecord(asRecord(messages)[field])
  const locale = String(i18n.global.locale.value || '').replace('_', '-')
  const language = locale.split('-')[0]
  const localeKeys = [locale, locale.replace('-', '_'), language]
  if (language === 'zh') localeKeys.push('zh_CN')
  if (language === 'en') localeKeys.push('en_US')
  return localeKeys.map((key) => text(values[key])).find(Boolean) || fallback
}

function propertiesOf(template: RecordValue): RecordValue[] {
  const thingModel = asRecord(template.thingModel)
  const metadata = asRecord(template.metadata)
  const properties = Array.isArray(thingModel.properties)
    ? thingModel.properties
    : Array.isArray(metadata.properties)
      ? metadata.properties
      : []
  return properties.map(asRecord)
}

function localizeAlarmConfiguration(configuration: unknown, alarmName: string): RecordValue {
  const localized = { ...asRecord(configuration) }
  if (!alarmName || !Array.isArray(localized.processors)) return localized
  localized.processors = localized.processors.map((processor) => {
    const item = asRecord(processor)
    if (item.provider !== 'device-alarm') return item
    return {
      ...item,
      configuration: {
        ...asRecord(item.configuration),
        alarmName,
      },
    }
  })
  return localized
}
