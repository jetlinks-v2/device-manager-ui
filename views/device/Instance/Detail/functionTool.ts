import { execute } from '../../../../api/instance'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceClientToolContext = {
  device: Record<string, any>
}

interface DeviceFunctionToolDependencies {
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  getDeviceId: (context: DeviceClientToolContext) => string
  getMetadata: (context: DeviceClientToolContext) => Record<string, any>
}

const normalizeSearchText = (value: unknown) => String(value ?? '').trim().toLowerCase()

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const parseArgumentsObject = (value: unknown) => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeFunctionCandidate = (
  deps: DeviceFunctionToolDependencies,
  func: Record<string, any>
) => ({
  id: func.id || func.key,
  name: func.name,
  description: func.description,
  inputs: deps.asArray<Record<string, any>>(func.inputs || func.properties).map((input) => ({
    id: input.id || input.key,
    name: input.name,
    required: !!input.expands?.required,
    valueType: input.valueType?.type || input.valueType
  })),
  output: func.output?.type || func.output
})

const resolveFunctionMetadata = (
  deps: DeviceFunctionToolDependencies,
  context: DeviceClientToolContext,
  args: Record<string, any>
) => {
  const functions = deps.asArray<Record<string, any>>(deps.getMetadata(context).functions)
  const functionId = normalizeSearchText(args.functionId ?? args.function ?? args.id)
  const keyword = normalizeSearchText(args.keyword ?? args.functionName ?? args.name)
  const exact = functions.find((func) => {
    const ids = [
      func.id,
      func.key,
      func.name
    ].map(normalizeSearchText)
    return functionId ? ids.includes(functionId) : false
  })
  if (exact) return exact

  if (!keyword) return undefined
  const matches = functions.filter((func) => {
    const text = [
      func.id,
      func.key,
      func.name,
      func.description
    ].map(normalizeSearchText).join(' ')
    return text.includes(keyword)
  })
  return matches.length === 1 ? matches[0] : undefined
}

const listFunctionCandidates = (
  deps: DeviceFunctionToolDependencies,
  context: DeviceClientToolContext,
  keyword?: unknown
) => {
  const normalizedKeyword = normalizeSearchText(keyword)
  return deps.asArray<Record<string, any>>(deps.getMetadata(context).functions)
    .filter((func) => {
      if (!normalizedKeyword) return true
      const text = [
        func.id,
        func.key,
        func.name,
        func.description
      ].map(normalizeSearchText).join(' ')
      return text.includes(normalizedKeyword)
    })
    .slice(0, 20)
    .map((func) => normalizeFunctionCandidate(deps, func))
}

const resolveFunctionArguments = (args: Record<string, any>) => (
  parseArgumentsObject(args.arguments ?? args.params ?? args.inputs ?? args.properties)
)

const getMissingRequiredInputs = (
  deps: DeviceFunctionToolDependencies,
  func: Record<string, any>,
  params: Record<string, any>
) => deps.asArray<Record<string, any>>(func.inputs || func.properties)
  .filter((input) => !!input.expands?.required)
  .filter((input) => {
    const id = input.id || input.key
    return id && (params[id] === undefined || params[id] === null || params[id] === '')
  })
  .map((input) => ({
    id: input.id || input.key,
    name: input.name,
    valueType: input.valueType?.type || input.valueType
  }))

const canInvokeFunction = (
  deps: DeviceFunctionToolDependencies,
  context: DeviceClientToolContext,
  args: Record<string, any>
) => {
  const func = resolveFunctionMetadata(deps, context, args)
  if (!func) return false
  return getMissingRequiredInputs(deps, func, resolveFunctionArguments(args)).length === 0
}

const buildConfirmContent = (
  deps: DeviceFunctionToolDependencies,
  args: Record<string, any>,
  context: DeviceClientToolContext
) => {
  const func = resolveFunctionMetadata(deps, context, args)
  const device = context.device || {}
  const params = resolveFunctionArguments(args)
  return [
    `即将向设备「${device.name || device.id || deps.getDeviceId(context)}」调用功能「${func?.name || func?.id || args.functionId}」。`,
    '该操作会真实下发设备指令，请确认后继续。',
    `参数：${safeStringify(params).slice(0, 800)}`
  ].join('\n')
}

export const createDeviceFunctionClientTools = (
  deps: DeviceFunctionToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => ([
  {
    id: 'device_function_invoke',
    name: 'device_function_invoke',
    description: '调用当前设备物模型中定义的功能。该工具会在真正下发前要求用户确认。',
    confirm: {
      title: '确认调用设备功能',
      content: (args, context) => buildConfirmContent(deps, args, context),
      okText: '确认调用',
      cancelText: '取消',
      when: (args, context) => canInvokeFunction(deps, context, args)
    },
    inputs: [
      {
        id: 'functionId',
        name: 'functionId',
        description: '功能ID；如果不确定可传 keyword，工具会在功能物模型中匹配唯一功能，或返回候选功能。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'keyword',
        name: 'keyword',
        description: '功能名称、标识或说明关键词；functionId 为空时用于匹配功能定义。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'arguments',
        name: 'arguments',
        description: '功能输入参数对象，字段名应来自功能物模型 inputs/properties。',
        required: false,
        valueType: { type: 'object' }
      }
    ],
    output: { type: 'object' },
    help: '调用设备功能。先用 device_metadata_search 搜索 functions 或传 keyword 让工具匹配；工具会校验必填参数，真正调用前会弹出用户确认。不要把查询类问题误用为功能调用，只有用户明确要求下发/调用/执行设备功能时才使用。',
    execute: async (args, context) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')
      const func = resolveFunctionMetadata(deps, context, args)
      if (!func) {
        return {
          deviceId,
          needsFunctionId: true,
          keyword: args.keyword ?? args.functionName ?? args.name,
          candidates: listFunctionCandidates(deps, context, args.keyword ?? args.functionName ?? args.name),
          nextAction: '请从 candidates 中选择功能ID和参数后再次调用。'
        }
      }

      const functionId = func.id || func.key
      const params = resolveFunctionArguments(args)
      const missingInputs = getMissingRequiredInputs(deps, func, params)
      if (missingInputs.length) {
        return {
          deviceId,
          function: normalizeFunctionCandidate(deps, func),
          needsArguments: true,
          missingInputs,
          nextAction: '请补充 missingInputs 对应的功能参数后再次调用。'
        }
      }

      const response = await execute(deviceId, functionId, params)
      return {
        deviceId,
        function: normalizeFunctionCandidate(deps, func),
        arguments: params,
        success: response?.success !== false,
        message: response?.message,
        result: deps.compactInlineValue(deps.responseResult(response), 3000)
      }
    }
  }
])
