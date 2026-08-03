import { DEVICE_ACCESS_META } from '@device-manager-ui/views/device/shared/device-library/services/deviceLibraryAccessMeta'
import i18n from '@jetlinks-web-core/locales'
import type {
  IotDeviceLibraryConnectionHealthRule,
  IotDeviceLibraryThingModelConfigItem,
  IotDeviceLibraryThingModelDefinition,
  IotDeviceLibraryThingModelExpandedConfig,
  IotDeviceLibraryThingModelProperty,
} from '@device-manager-ui/views/device/shared/device-library/services/deviceLibrary.types'
import type {
  DeviceDataPoint,
  DeviceNormalRange,
  DeviceTemplate,
} from '@device-manager-ui/views/device/list/services/device-library/types'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})

type TemplateHealthContext = {
  accessMode?: string
  risk?: 'normal' | 'watch' | 'urgent'
}

function pointIdentifier(point: DeviceDataPoint, index: number) {
  return point.key || `${point.kind}-${index + 1}`
}

function emptyExpandedConfig(displayName: string): IotDeviceLibraryThingModelExpandedConfig {
  return {
    displayName,
    valueType: 'string',
    reportStrategy: t('IotStandardModel.mapper.templateDefinition'),
    items: [],
    thresholds: [],
    deviationConfig: {
      normalRange: '-',
      warningRange: '-',
      alarmRange: '-',
      description: '-',
      suggestion: '-',
    },
  }
}

function metadataIdentifier(item: any, index: number) {
  return String(item?.id || item?.identifier || item?.key || item?.property || item?.name || `metadata-${index + 1}`)
}

function metadataDataType(item: any) {
  const type = item?.valueType?.type || item?.dataType?.type || item?.type || item?.dataType || 'string'
  if (['int', 'long', 'float', 'double', 'number'].includes(type)) return 'number'
  if (type === 'boolean') return 'bool'
  if (type === 'object') return 'struct'
  return String(type)
}

function metadataAccessMode(item: any) {
  const accessMode = item?.accessMode || item?.expands?.accessMode
  if (accessMode) return String(accessMode)
  const types = Array.isArray(item?.expands?.type) ? item.expands.type : []
  const readable = types.includes('read') || !types.length
  const writable = types.includes('write')
  if (readable && writable) return 'readwrite'
  if (writable) return 'write'
  return 'read'
}

function metadataConfigItems(items: any): IotDeviceLibraryThingModelConfigItem[] {
  if (!items) return []
  const source = Array.isArray(items) ? items : [items]
  return source.map((item: any, index) => ({
    identifier: metadataIdentifier(item, index),
    name: String(item?.name || item?.id || item?.identifier || t('IotStandardModel.mapper.parameter', { index: index + 1 })),
    dataType: metadataDataType(item),
    required: Boolean(item?.required || item?.expands?.required),
  })).filter((item) => item.identifier || item.name)
}

function metadataExpandedConfig(item: any, fallbackName: string): IotDeviceLibraryThingModelExpandedConfig {
  const config = emptyExpandedConfig(fallbackName)
  return {
    ...config,
    valueType: metadataDataType(item),
    reportStrategy: item?.expands?.reportStrategy || item?.reportStrategy || t('IotStandardModel.mapper.thingModelDefinition'),
    items: metadataConfigItems(item?.expands?.items || item?.properties),
  }
}

function formatNormalRange(range: DeviceNormalRange) {
  const unit = range.unit ? ` ${range.unit}` : ''
  const min = range.min !== undefined ? `${range.min}` : ''
  const max = range.max !== undefined ? `${range.max}` : ''
  if (min && max) return `${min} ~ ${max}${unit}`
  if (min) return `>= ${min}${unit}`
  if (max) return `<= ${max}${unit}`
  return '-'
}

function resolveMatchedModel(template?: DeviceTemplate | null, accessMode?: string) {
  const models = template?.supportedModels ?? []
  if (!accessMode) return models[0]
  return models.find((model) =>
    accessMode.includes(model.accessName) || model.accessName.includes(accessMode),
  ) ?? models[0]
}

function buildRangeSuggestion(template?: DeviceTemplate | null) {
  return template?.requirements?.[0] || t('IotStandardModel.mapper.rangeSuggestion')
}

export function buildThingModelDefinitionFromTemplate(template?: DeviceTemplate | null): IotDeviceLibraryThingModelDefinition {
  const dataPoints = template?.dataPoints ?? []
  const properties = dataPoints
    .filter((item) => item.kind === 'status' || item.kind === 'telemetry')
    .map((item, index) => ({
      id: pointIdentifier(item, index),
      name: item.name,
      identifier: pointIdentifier(item, index),
      dataType: item.kind === 'status' ? 'enum' : item.kind === 'telemetry' ? 'number' : 'string',
      accessMode: item.kind === 'status' ? 'read' : 'readwrite',
      source: t('IotStandardModel.common.deviceReport'),
      tags: item.isKeyMetric ? [t('IotStandardModel.mapper.keyMetric')] : [],
      description: item.desc || t('IotStandardModel.mapper.templateProperty'),
      expandedConfig: emptyExpandedConfig(item.name),
    }))

  const events = dataPoints
    .filter((item) => item.kind === 'event' || item.kind === 'alarm')
    .map((item, index) => ({
      id: pointIdentifier(item, index),
      name: item.name,
      identifier: pointIdentifier(item, index),
      dataType: item.kind === 'alarm' ? 'event' : 'string',
      level: item.kind === 'alarm' ? 'alarm' : 'info',
      description: item.desc || t('IotStandardModel.mapper.templateEvent'),
      outputs: [],
      expandedConfig: emptyExpandedConfig(item.name),
    }))

  const functions = dataPoints
    .filter((item) => item.kind === 'command')
    .map((item, index) => ({
      id: pointIdentifier(item, index),
      name: item.name,
      identifier: pointIdentifier(item, index),
      dataType: 'string',
      callMode: 'sync',
      description: item.desc || t('IotStandardModel.mapper.templateFunction'),
      inputs: [],
      outputs: [],
      expandedConfig: emptyExpandedConfig(item.name),
    }))

  return {
    description: t('IotStandardModel.mapper.templateDescription'),
    properties,
    events,
    functions,
    tags: [],
  }
}

export function buildThingModelDefinitionFromMetadata(metadata?: {
  properties?: any[]
  events?: any[]
  functions?: any[]
  tags?: any[]
} | null): IotDeviceLibraryThingModelDefinition {
  const properties = (metadata?.properties ?? []).map((item, index) => {
    const identifier = metadataIdentifier(item, index)
    const name = String(item?.name || identifier)
    return {
      id: identifier,
      name,
      identifier,
      dataType: metadataDataType(item),
      accessMode: metadataAccessMode(item),
      source: item?.expands?.source || item?.source || t('IotStandardModel.common.deviceReport'),
      tags: Array.isArray(item?.tags) ? item.tags : [],
      description: item?.description || '',
      expandedConfig: metadataExpandedConfig(item, name),
    }
  })

  const events = (metadata?.events ?? []).map((item, index) => {
    const identifier = metadataIdentifier(item, index)
    const name = String(item?.name || identifier)
    const outputItems = metadataConfigItems(item?.outputs || item?.output || item?.valueType?.properties)
    return {
      id: identifier,
      name,
      identifier,
      dataType: metadataDataType(item),
      level: item?.expands?.level || item?.level || 'info',
      description: item?.description || '',
      outputs: outputItems,
      expandedConfig: {
        ...metadataExpandedConfig(item, name),
        items: outputItems,
      },
    }
  })

  const functions = (metadata?.functions ?? []).map((item, index) => {
    const identifier = metadataIdentifier(item, index)
    const name = String(item?.name || identifier)
    const inputItems = metadataConfigItems(item?.inputs)
    const outputItems = metadataConfigItems(item?.outputs || item?.output)
    return {
      id: identifier,
      name,
      identifier,
      dataType: metadataDataType(item),
      callMode: item?.async ? 'async' : 'sync',
      description: item?.description || '',
      inputs: inputItems,
      outputs: outputItems,
      expandedConfig: {
        ...metadataExpandedConfig(item, name),
        items: [...inputItems, ...outputItems],
      },
    }
  })

  const tags = (metadata?.tags ?? []).map((item, index) => {
    const identifier = metadataIdentifier(item, index)
    return {
      id: identifier,
      name: String(item?.name || identifier),
      identifier,
      dataType: metadataDataType(item),
      description: item?.description || '',
    }
  })

  return {
    description: t('IotStandardModel.mapper.metadataDescription'),
    properties,
    events,
    functions,
    tags,
  }
}

export function buildTemplateHealthConfigFromTemplate(
  template?: DeviceTemplate | null,
  context: TemplateHealthContext = {},
): {
  connectionRules: IotDeviceLibraryConnectionHealthRule[]
  deviationProperties: IotDeviceLibraryThingModelProperty[]
} {
  const matchedModel = resolveMatchedModel(template, context.accessMode)
  const accessMode = matchedModel?.accessMode || template?.accessModes?.[0] || 'direct'
  const accessMeta = DEVICE_ACCESS_META[accessMode]
  const connectionHint = matchedModel?.connectionHint || template?.connectionHint || t('IotStandardModel.mapper.connectionHint')
  const firstRequirement = matchedModel?.requirements?.[0] || template?.requirements?.[0] || t('IotStandardModel.mapper.connectionRequirement')

  const connectionRules: IotDeviceLibraryConnectionHealthRule[] = [
    {
      enabled: true,
      title: t('IotDeviceMeta.business.noData'),
      condition: t('IotStandardModel.mapper.noDataCondition', { access: accessMeta?.business || t('IotStandardModel.mapper.standardAccess') }),
      severity: 'watch',
      description: connectionHint,
      suggestion: firstRequirement,
    },
    {
      enabled: true,
      title: t('IotStandardModel.mapper.deviceOffline'),
      condition: t('IotStandardModel.mapper.offlineCondition', { target: accessMeta?.label || t('IotStandardModel.mapper.platform') }),
      severity: 'urgent',
      description: t('IotStandardModel.mapper.offlineDescription', { access: accessMeta?.tech || t('IotStandardModel.mapper.platformAccess') }),
      suggestion: firstRequirement,
    },
    {
      enabled: true,
      title: t('IotDeviceDetail.connectionHealth.anomaly.fluctuation'),
      condition: t('IotStandardModel.mapper.fluctuationCondition'),
      severity: context.risk === 'urgent' ? 'urgent' : 'watch',
      description: t('IotStandardModel.mapper.fluctuationDescription', { access: accessMeta?.short || t('IotStandardModel.mapper.current') }),
      suggestion: template?.testSteps?.[0] || t('IotStandardModel.mapper.fluctuationSuggestion'),
    },
  ]

  const pointMap = new Map<string, DeviceDataPoint>()
  for (const point of template?.dataPoints ?? []) {
    if (point.key) pointMap.set(point.key, point)
  }

  const deviationProperties = (template?.telemetryNormalRanges ?? []).map((range, index) => {
    const point = pointMap.get(range.pointKey)
    return {
      id: range.pointKey || `range-${index + 1}`,
      name: point?.name || range.name,
      identifier: range.pointKey || `range-${index + 1}`,
      dataType: 'number',
      accessMode: 'read',
      source: t('IotStandardModel.common.deviceReport'),
      tags: point?.isKeyMetric ? [t('IotStandardModel.mapper.keyMetric')] : [],
      description: range.hint || point?.desc || t('IotStandardModel.mapper.templateHealthRange'),
      expandedConfig: {
        displayName: point?.name || range.name,
        valueType: 'number',
        reportStrategy: t('IotStandardModel.mapper.templateDefinition'),
        items: [
          { identifier: 'pointKey', name: t('IotStandardModel.mapper.pointIdentifier'), dataType: range.pointKey },
          { identifier: 'unit', name: t('IotSceneLinkage.editor.unit'), dataType: range.unit || '-' },
        ],
        thresholds: [],
        deviationConfig: {
          normalRange: formatNormalRange(range),
          warningRange: t('IotStandardModel.mapper.outsideNormalRange'),
          alarmRange: t('IotStandardModel.mapper.continuouslyOutsideNormalRange'),
          description: range.hint || point?.desc || '-',
          suggestion: buildRangeSuggestion(template),
        },
      },
    }
  })

  return {
    connectionRules,
    deviationProperties,
  }
}
