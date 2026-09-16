import {
  createDomainAgentToolResult,
  resolveDomainAgentMessage,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { mapModelPropertyAccess } from '../../../../agentCapabilities/deviceAnalysis/deviceModel.service'
import type { IotDevice } from '../types'
import {
  iotDeviceDetailRealApi,
  parseMetadata,
  type ThingModelMetadata,
} from '../services/iotDeviceDetailReal.service'
import {
  asRecord,
  commandRequestFailure,
  isCommandFailure,
  isRecord,
  normalizeText,
  runDetailTool,
  safePayload,
  safeText,
  unwrapResult,
  type DeviceDetailAgentArgs,
} from './deviceDetailAgent.shared'

const MAX_WRITE_PROPERTIES = 20
const MAX_FUNCTION_CANDIDATES = 20
const MAX_CONFIRM_CHARS = 400
const NUMBER_TYPES = new Set(['int', 'long', 'float', 'double', 'number', 'integer'])
const INTEGER_TYPES = new Set(['int', 'long', 'integer'])
const OBJECT_TYPES = new Set(['object', 'map'])
const ARRAY_TYPES = new Set(['array', 'list'])
const BOOLEAN_TRUE = new Set(['true', '1', 'yes'])
const BOOLEAN_FALSE = new Set(['false', '0', 'no'])

const compact = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
)

const searchText = (value: unknown) => normalizeText(value).toLowerCase()

const parseObject = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  try {
    return JSON.parse(text)
  } catch {
    return value
  }
}

const valueTypeOf = (item: Record<string, unknown>) => {
  const valueType = asRecord(item.valueType || item.dataType)
  return compact({
    type: searchText(valueType.type || valueType.id || valueType.name) || 'string',
    min: valueType.min ?? valueType.minimum,
    max: valueType.max ?? valueType.maximum,
    elements: Array.isArray(valueType.elements) ? valueType.elements.slice(0, 50) : undefined,
  })
}

const functionInputsOf = (func: Record<string, unknown>) => (
  (Array.isArray(func.inputs) ? func.inputs : Array.isArray(func.properties) ? func.properties : [])
    .map(asRecord)
    .map(input => compact({
      id: normalizeText(input.id || input.key || input.name),
      name: normalizeText(input.name || input.id || input.key),
      required: asRecord(input.expands).required === true || input.required === true,
      valueType: valueTypeOf(input).type,
    }))
    .filter(input => input.id)
)

const functionCandidate = (func: Record<string, unknown>) => compact({
  id: normalizeText(func.id || func.key || func.function),
  name: normalizeText(func.name || func.id || func.key),
  description: safeText(func.description, 300) || undefined,
  inputs: functionInputsOf(func).slice(0, 50),
})

const propertyCandidate = (item: Record<string, unknown>) => compact({
  id: normalizeText(item.id || item.property || item.key),
  name: normalizeText(item.name || item.id || item.property || item.key),
  description: safeText(item.description, 300) || undefined,
  valueType: valueTypeOf(item),
  access: mapModelPropertyAccess(item),
})

const confirmation = (titleKey: string, content: string) => ({
  title: resolveDomainAgentMessage(`IotDeviceDetailAgent.tools.${titleKey}`),
  content: content.slice(0, MAX_CONFIRM_CHARS),
})

const confirmMessage = (key: string, params: Array<string | number>) => (
  resolveDomainAgentMessage(`IotDeviceDetailAgent.tools.${key}`, params)
)

export const createDeviceDetailCommandService = (device: IotDevice) => {
  const loadMetadata = async (): Promise<ThingModelMetadata> => {
    if (device.thingModelMetadata) return device.thingModelMetadata
    const detail = asRecord(unwrapResult(await iotDeviceDetailRealApi.getDeviceDetail(device.id)))
    return parseMetadata(detail.metadata || detail.deriveMetadata || detail.productMetadata)
  }

  const loadFunctions = async () => (await loadMetadata()).functions.map(asRecord)
  const loadProperties = async () => (await loadMetadata()).properties.map(asRecord)

  const listFunctionCandidates = (functions: Record<string, unknown>[], keyword?: string) => {
    const query = searchText(keyword)
    return functions
      .filter((func) => {
        if (!query) return true
        return [func.id, func.key, func.function, func.name, func.description]
          .map(searchText)
          .join(' ')
          .includes(query)
      })
      .slice(0, MAX_FUNCTION_CANDIDATES)
      .map(functionCandidate)
  }

  const resolveFunction = async (args: DeviceDetailAgentArgs) => {
    const functions = await loadFunctions()
    const functionId = searchText(args.functionId ?? args.function ?? args.id)
    const keyword = searchText(args.keyword ?? args.functionName)
    const exact = functionId
      ? functions.find(func => [func.id, func.key, func.function].map(searchText).includes(functionId))
      : undefined
    if (exact) return exact
    const query = functionId || keyword
    const matches = query
      ? functions.filter(func => [func.id, func.key, func.function, func.name, func.description]
        .map(searchText)
        .join(' ')
        .includes(query))
      : []
    if (matches.length === 1) return matches[0]
    return commandRequestFailure(
      matches.length ? 'DEVICE_FUNCTION_NOT_UNIQUE' : 'DEVICE_FUNCTION_NOT_FOUND',
      matches.length ? 'functionNotUnique' : 'functionNotFound',
      { candidates: listFunctionCandidates(functions, query), matched: matches.length },
    )
  }

  const resolveFunctionParams = (args: DeviceDetailAgentArgs) => (
    parseObject(args.arguments ?? args.params ?? args.inputs ?? args.properties) || {}
  )

  const missingFunctionInputs = (func: Record<string, unknown>, params: Record<string, unknown>) => (
    functionInputsOf(func)
      .filter(input => input.required)
      .filter(input => params[String(input.id)] === undefined
        || params[String(input.id)] === null
        || params[String(input.id)] === '')
  )

  const resolveFunctionCall = async (args: DeviceDetailAgentArgs) => {
    const resolved = await resolveFunction(args)
    if (isCommandFailure(resolved)) return resolved
    const functionId = normalizeText(resolved.id || resolved.key || resolved.function)
    const params = resolveFunctionParams(args)
    const missingInputs = missingFunctionInputs(resolved, params)
    if (missingInputs.length) {
      return commandRequestFailure('DEVICE_FUNCTION_INPUTS_MISSING', 'functionInputsMissing', {
        function: functionCandidate(resolved),
        missingInputs,
      })
    }
    return {
      functionId,
      params,
      candidate: functionCandidate(resolved),
    }
  }

  const prepareFunctionInvoke = async (args: DeviceDetailAgentArgs) => {
    const resolved = await resolveFunctionCall(args)
    if (isCommandFailure(resolved)) return resolved
    return {
      arguments: {
        functionId: resolved.functionId,
        arguments: resolved.params,
      },
      confirmation: confirmation(
        'device_function_invoke.confirmTitle',
        confirmMessage('device_function_invoke.confirmContent', [
          device.name || device.id,
          String(resolved.candidate.name || resolved.functionId),
          safePayload(resolved.params, 200),
        ]),
      ),
    }
  }

  const functionInvoke = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const resolved = await resolveFunctionCall(args)
    if (isCommandFailure(resolved)) return resolved
    const response = unwrapResult(await iotDeviceDetailRealApi.executeFunction(
      device.id,
      resolved.functionId,
      resolved.params,
    ))
    return createDomainAgentToolResult({
      domain: 'device',
      summary: {
        invoked: true,
        deviceId: device.id,
        functionId: resolved.functionId,
        functionName: resolved.candidate.name,
      },
      data: {
        invoked: true,
        functionId: resolved.functionId,
        functionName: resolved.candidate.name,
        arguments: resolved.params,
        result: safePayload(response, 3000),
      },
    })
  })

  const findProperty = (properties: Record<string, unknown>[], propertyId: string) => (
    properties.find(item => [item.id, item.property, item.key].map(searchText).includes(searchText(propertyId)))
  )

  const validatePropertyValue = (property: Record<string, unknown>, value: unknown) => {
    const valueType = valueTypeOf(property)
    const type = String(valueType.type || 'string')
    const propertyId = String(propertyCandidate(property).id)
    if (value === undefined || value === null || value === '') {
      return commandRequestFailure('DEVICE_PROPERTY_VALUE_REQUIRED', 'propertyValueRequired', undefined, { propertyId })
    }
    if (type === 'boolean' || type === 'bool') {
      if (typeof value === 'boolean') return value
      const text = searchText(value)
      if (BOOLEAN_TRUE.has(text)) return true
      if (BOOLEAN_FALSE.has(text)) return false
      return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
    }
    if (NUMBER_TYPES.has(type)) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      if (INTEGER_TYPES.has(type) && !Number.isInteger(number)) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      const min = Number(valueType.min)
      const max = Number(valueType.max)
      if (Number.isFinite(min) && number < min) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      if (Number.isFinite(max) && number > max) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      return number
    }
    if (Array.isArray(valueType.elements) && valueType.elements.length) {
      const allowed = valueType.elements.map(item => asRecord(item).value ?? item)
      if (!allowed.some(item => String(item) === String(value) || item === value)) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      return value
    }
    if (OBJECT_TYPES.has(type) || ARRAY_TYPES.has(type)) {
      const parsed = parseJsonValue(value)
      const valid = OBJECT_TYPES.has(type) ? isRecord(parsed) : Array.isArray(parsed)
      if (!valid) {
        return commandRequestFailure('DEVICE_PROPERTY_VALUE_INVALID', 'propertyValueInvalid', undefined, { propertyId })
      }
      return parsed
    }
    return value
  }

  const resolveWriteEntries = (args: DeviceDetailAgentArgs) => {
    const mapped = parseObject(args.properties)
    if (mapped) {
      const ids = Object.keys(mapped)
      if (!ids.length || ids.length > MAX_WRITE_PROPERTIES) {
        return commandRequestFailure('DEVICE_PROPERTY_WRITE_LIMIT', 'propertyWriteLimit', {
          max: MAX_WRITE_PROPERTIES,
          count: ids.length,
        })
      }
      return Object.entries(mapped).map(([propertyId, value]) => ({ propertyId, value }))
    }
    const propertyId = normalizeText(args.propertyId)
    if (!propertyId) {
      return commandRequestFailure('DEVICE_PROPERTY_REQUIRED', 'propertyIdRequired')
    }
    return [{ propertyId, value: args.value }]
  }

  const resolveWritableProperties = async (args: DeviceDetailAgentArgs) => {
    const entries = resolveWriteEntries(args)
    if (isCommandFailure(entries)) return entries
    const properties = await loadProperties()
    const payload: Record<string, unknown> = {}
    const resolved = []
    for (const entry of entries) {
      const property = findProperty(properties, entry.propertyId)
      if (!property) {
        return commandRequestFailure('DEVICE_PROPERTY_NOT_FOUND', 'propertyNotFound', undefined, {
          propertyId: entry.propertyId,
        })
      }
      const access = mapModelPropertyAccess(property)
      if (!access.deviceWritable) {
        return commandRequestFailure('DEVICE_PROPERTY_NOT_WRITABLE', 'propertyNotDeviceWritable', {
          property: propertyCandidate(property),
          snapshotTool: 'device_latest_properties',
        }, { propertyId: entry.propertyId })
      }
      const value = validatePropertyValue(property, entry.value)
      if (isCommandFailure(value)) return value
      payload[String(propertyCandidate(property).id)] = value
      resolved.push({ ...propertyCandidate(property), value })
    }
    return { payload, properties: resolved }
  }

  const preparePropertyWrite = async (args: DeviceDetailAgentArgs) => {
    const resolved = await resolveWritableProperties(args)
    if (isCommandFailure(resolved)) return resolved
    return {
      arguments: {
        properties: resolved.payload,
      },
      confirmation: confirmation(
        'device_property_write.confirmTitle',
        confirmMessage('device_property_write.confirmContent', [
          device.name || device.id,
          resolved.properties.map(item => `${item.name || item.id}=${safePayload(item.value, 80)}`).join(', '),
        ]),
      ),
    }
  }

  const propertyWrite = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const resolved = await resolveWritableProperties(args)
    if (isCommandFailure(resolved)) return resolved
    await iotDeviceDetailRealApi.setProperty(device.id, resolved.payload)
    return createDomainAgentToolResult({
      domain: 'device',
      summary: {
        written: true,
        deviceId: device.id,
        propertyIds: Object.keys(resolved.payload),
      },
      data: {
        written: true,
        properties: resolved.payload,
      },
    })
  })

  const resolveReadableProperty = async (args: DeviceDetailAgentArgs) => {
    const propertyId = normalizeText(args.propertyId)
    if (!propertyId) return commandRequestFailure('DEVICE_PROPERTY_REQUIRED', 'propertyIdRequired')
    const property = findProperty(await loadProperties(), propertyId)
    if (!property) {
      return commandRequestFailure('DEVICE_PROPERTY_NOT_FOUND', 'propertyNotFound', undefined, { propertyId })
    }
    const access = mapModelPropertyAccess(property)
    if (!access.deviceReadable) {
      return commandRequestFailure('DEVICE_PROPERTY_NOT_LIVE_READABLE', 'propertyNotDeviceReadable', {
        property: propertyCandidate(property),
        snapshotTool: 'device_latest_properties',
      }, { propertyId })
    }
    return { property: propertyCandidate(property), access }
  }

  const propertyRead = (args: DeviceDetailAgentArgs) => runDetailTool<Record<string, unknown>>({}, async () => {
    const resolved = await resolveReadableProperty(args)
    if (isCommandFailure(resolved)) return resolved
    const response = unwrapResult(await iotDeviceDetailRealApi.readProperty(device.id, String(resolved.property.id)))
    const row = asRecord(asRecord(response).value ?? response)
    return createDomainAgentToolResult({
      domain: 'device',
      summary: {
        deviceId: device.id,
        propertyId: resolved.property.id,
        propertyName: resolved.property.name,
      },
      data: compact({
        id: resolved.property.id,
        name: resolved.property.name,
        value: row.value ?? row.formatValue ?? response,
        formatValue: row.formatValue,
        timestamp: row.timestamp || row.createTime,
        access: resolved.access,
      }),
    })
  })

  return {
    prepareFunctionInvoke,
    functionInvoke,
    preparePropertyWrite,
    propertyWrite,
    propertyRead,
  }
}
