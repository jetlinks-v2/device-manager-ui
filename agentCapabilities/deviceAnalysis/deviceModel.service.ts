import {
  createDomainAgentRecordSetCardinality,
  createDomainAgentToolResult,
  resolveDomainAgentEnum,
  resolveDomainAgentInteger,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import type { ThingModelMetadata } from '@device-manager-ui/views/device/list/services/iotDeviceDetailReal.service'
import { IOT_DEVICE_MODEL_SECTIONS } from './constants'
import {
  asRecord,
  getMetadata,
  inputError,
  normalizeText,
  runDeviceTool,
} from './deviceAnalysis.shared'

type ThingModelSection = keyof Pick<ThingModelMetadata, 'properties' | 'events' | 'functions' | 'tags'>

const compactRecord = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
)

const scalarValue = (value: unknown) => (
  ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined
)

const mapValueType = (input: unknown) => {
  const valueType = asRecord(input)
  const type = normalizeText(valueType.type || valueType.id || valueType.name) || 'string'
  const elements = Array.isArray(valueType.elements)
    ? valueType.elements.slice(0, 50).map((value) => {
      const item = asRecord(value)
      return compactRecord({
        value: scalarValue(item.value),
        text: normalizeText(item.text ?? item.label ?? item.value) || undefined,
      })
    })
    : undefined
  return compactRecord({
    type,
    unit: normalizeText(valueType.unitName ?? valueType.unitText ?? valueType.unit) || undefined,
    min: scalarValue(valueType.min ?? valueType.minimum),
    max: scalarValue(valueType.max ?? valueType.maximum),
    scale: scalarValue(valueType.scale),
    elements: elements?.length ? elements : undefined,
  })
}

const mapModelParameter = (input: unknown) => {
  const item = asRecord(input)
  const expands = asRecord(item.expands)
  return compactRecord({
    id: normalizeText(item.id || item.name || item.key),
    name: normalizeText(item.name || item.id || item.key),
    description: normalizeText(item.description) || undefined,
    required: expands.required === true || item.required === true,
    valueType: mapValueType(item.valueType || item.dataType),
  })
}

const mapModelProperty = (input: unknown) => {
  const item = asRecord(input)
  const expands = asRecord(item.expands)
  const readOnly = expands.readOnly === true || item.readOnly === true
  const writeDisabled = item.writable === false || item.writeable === false
  const writable = !writeDisabled && (item.writable === true || item.writeable === true || !readOnly)
  return compactRecord({
    id: normalizeText(item.id || item.property || item.key),
    name: normalizeText(item.name || item.id || item.property || item.key),
    description: normalizeText(item.description) || undefined,
    valueType: mapValueType(item.valueType || item.dataType),
    access: { readable: item.readable !== false, writable },
  })
}

const mapModelEvent = (input: unknown) => {
  const item = asRecord(input)
  const output = asRecord(item.output)
  return compactRecord({
    id: normalizeText(item.id || item.event || item.key),
    name: normalizeText(item.name || item.id || item.event || item.key),
    description: normalizeText(item.description) || undefined,
    output: mapValueType(output.valueType || item.output || item.valueType),
  })
}

const mapModelFunction = (input: unknown) => {
  const item = asRecord(input)
  const output = asRecord(item.output)
  const inputs = Array.isArray(item.inputs) ? item.inputs.map(mapModelParameter).slice(0, 50) : []
  return compactRecord({
    id: normalizeText(item.id || item.function || item.key),
    name: normalizeText(item.name || item.id || item.function || item.key),
    description: normalizeText(item.description) || undefined,
    input: inputs,
    output: mapValueType(output.valueType || item.output || item.valueType),
  })
}

const mapModelTag = (input: unknown) => {
  const item = asRecord(input)
  return compactRecord({
    id: normalizeText(item.id || item.key || item.name),
    name: normalizeText(item.name || item.id || item.key),
    description: normalizeText(item.description) || undefined,
    valueType: mapValueType(item.valueType || item.dataType),
  })
}

const MODEL_SECTION_MAPPERS: Record<ThingModelSection, (input: unknown) => Record<string, unknown>> = {
  properties: mapModelProperty,
  events: mapModelEvent,
  functions: mapModelFunction,
  tags: mapModelTag,
}

export const deviceModelService = {
  getModel: (args: Record<string, unknown>) => runDeviceTool<Record<string, unknown>>({}, async () => {
    const deviceId = normalizeText(args.deviceId)
    if (!deviceId) throw inputError('DEVICE_ID_REQUIRED', 'deviceIdRequired')
    const limit = resolveDomainAgentInteger(args.limit, { name: 'limit', defaultValue: 20, min: 1, max: 50 })
    const section = resolveDomainAgentEnum(args.section, IOT_DEVICE_MODEL_SECTIONS, { name: 'section', defaultValue: 'all' })
    const { device, metadata } = await getMetadata(deviceId)
    const sections: ThingModelSection[] = section === 'all'
      ? ['properties', 'events', 'functions', 'tags']
      : [section]
    // Protocol extensions and backend-only fields stay inside this bounded semantic adapter.
    const data = Object.fromEntries(sections.map(key => [
      key,
      metadata[key].slice(0, limit).map(MODEL_SECTION_MAPPERS[key]),
    ]))
    const total = sections.reduce((count, key) => count + metadata[key].length, 0)
    const returned = sections.reduce((count, key) => count + Math.min(metadata[key].length, limit), 0)
    return createDomainAgentToolResult({
      domain: 'device',
      summary: { deviceId, deviceName: device.name, section, total },
      data,
      total,
      cardinality: createDomainAgentRecordSetCardinality({
        returnedCount: returned,
        totalCount: total,
      }),
      truncated: sections.some(key => metadata[key].length > limit),
      supportsAbsenceClaim: total === 0,
    })
  }),
}
