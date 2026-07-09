import dayjs from 'dayjs'
import { nextTick, onUnmounted, ref } from 'vue'
import { wsClient } from '@jetlinks-web/core'
import { onlyMessage, randomString } from '@jetlinks-web/utils'
import type {
  CommandType,
  ExecutionLogItem,
  MetadataFunctionItem,
  MetadataModel,
  SimulationItem,
  SimulatorType,
} from '../codecSimulatorTypes'

const DEBUG_TIMEOUT = 15000

export function safeParseMetadata(metadata: unknown): MetadataModel {
  if (!metadata) return {}
  if (typeof metadata === 'object') return metadata as MetadataModel
  if (typeof metadata !== 'string') return {}
  try {
    return JSON.parse(metadata)
  } catch {
    return {}
  }
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function parseLooseValue(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
  if (/^(\{.*\}|\[.*\]|".*")$/.test(text)) {
    const parsed = tryParseJson(text)
    if (parsed !== undefined) return parsed
  }
  return text
}

function normalizePayload(item: SimulationItem) {
  const source = String(item.payload || '').trim()
  if (!source) return ''
  if (item.encoding === 'Hex') return source.replace(/\s+/g, '')
  if (item.encoding === 'JSON') return tryParseJson(source) ?? source
  return source
}

function formatResult(value: unknown) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string') {
    const text = value.trim()
    const parsed = tryParseJson(text)
    return parsed !== undefined ? JSON.stringify(parsed, null, 2) : text
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function parseDetailText(detail: unknown) {
  if (detail === undefined || detail === null) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object') {
    const level = String((detail as any).level || 'INFO').toUpperCase()
    const message = (detail as any).message
    return `[${level}] ${message !== undefined ? String(message) : JSON.stringify(detail)}`
  }
  return String(detail)
}

export function useCodecSimulator(
  instanceStore: any,
  $t: (key: string) => string,
) {
  const list = ref<SimulationItem[]>([])
  const logs = ref<ExecutionLogItem[]>([])
  const simulatorContainerRef = ref<HTMLElement>()
  const activeSubscriptions = new Set<any>()

  const getMetadataModel = (): MetadataModel => {
    const deviceMetadata = safeParseMetadata(instanceStore.current?.metadata)
    const hasDeviceModel = !!(
      (deviceMetadata.properties?.length || 0) + (deviceMetadata.functions?.length || 0)
    )
    return hasDeviceModel
      ? deviceMetadata
      : safeParseMetadata(instanceStore.current?.productMetadata || '{}')
  }

  const normalizeInvokeInputs = (item: SimulationItem) => {
    const functionId = String(item.commandId || '').trim()
    const functionItem = (getMetadataModel().functions || []).find(
      (func: MetadataFunctionItem) => func.id === functionId,
    )
    const fallbackName = functionItem?.inputs?.[0]?.id || functionItem?.inputs?.[0]?.name || 'value'
    const text = String(item.payload || '').trim()
    if (!text) return []
    const parsed = tryParseJson(text)

    if (Array.isArray(parsed)) {
      return parsed.map((input: any, index: number) => {
        if (input && typeof input === 'object' && ('name' in input || 'id' in input)) {
          return {
            name: String(input.name || input.id || functionItem?.inputs?.[index]?.id || fallbackName),
            value: input.value !== undefined ? input.value : '',
          }
        }
        return { name: String(functionItem?.inputs?.[index]?.id || fallbackName), value: input }
      })
    }

    if (parsed && typeof parsed === 'object') {
      if ((parsed as any).value !== undefined && ((parsed as any).name || (parsed as any).id)) {
        return [{ name: String((parsed as any).name || (parsed as any).id), value: (parsed as any).value }]
      }
      return Object.entries(parsed as Record<string, any>).map(([name, value]) => ({ name, value }))
    }

    return [{ name: fallbackName, value: parseLooseValue(text) }]
  }

  const buildRequestParameter = (item: SimulationItem) => {
    if (item.type === 'uplink') {
      return {
        encode: false,
        payload: {
          topic: item.topic || '',
          qosLevel: Number(item.qos ?? 0),
          payload: normalizePayload(item),
        },
      }
    }
    const commandId = String(item.commandId || '').trim()
    const commandType: CommandType = item.commandType || 'write'
    if (commandType === 'read') {
      return { encode: true, payload: { properties: commandId ? [commandId] : [], messageType: 'READ_PROPERTY' } }
    }
    if (commandType === 'write') {
      return {
        encode: true,
        payload: { properties: commandId ? { [commandId]: parseLooseValue(item.payload) } : {}, messageType: 'WRITE_PROPERTY' },
      }
    }
    return {
      encode: true,
      payload: { messageType: 'INVOKE_FUNCTION', functionId: commandId, inputs: normalizeInvokeInputs(item) },
    }
  }

  const resolveResult = (payload: any, type: SimulatorType) => {
    const candidates =
      type === 'uplink'
        ? [payload?.output, payload?.result, payload?.data, payload?.payload, payload]
        : [payload?.output, payload?.payload, payload?.result, payload?.data, payload]
    return formatResult(candidates.find((item) => item !== undefined && item !== null && item !== ''))
  }

  const addLog = (text: string, type: ExecutionLogItem['type'], timestamp?: number) => {
    logs.value.unshift({
      time: dayjs(timestamp || Date.now()).format('HH:mm:ss'),
      text,
      type,
    })
  }

  const appendExecutionLog = (payload: any) => {
    const text = parseDetailText(payload?.detail || payload?.output || payload?.message || $t('InstanceDeviceAccess.codecDebug.logDefault'))
    addLog(text, 'operation', payload?.endTime || payload?.startTime)
  }

  const sendDebugRequest = (topic: string, parameter: Record<string, any>) =>
    new Promise<any>((resolve, reject) => {
      const requestId = `protocol-debug-${Date.now()}-${randomString()}`
      const stream = wsClient.getWebSocket(requestId, topic, parameter)
      if (!stream?.subscribe) {
        reject(new Error($t('InstanceDeviceAccess.codecDebug.channelUnavailable')))
        return
      }

      let done = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let subscription: any

      const finish = (handler: () => void) => {
        if (done) return
        done = true
        if (timer) clearTimeout(timer)
        activeSubscriptions.delete(subscription)
        subscription?.unsubscribe?.()
        handler()
      }

      timer = setTimeout(() => {
        finish(() => reject(new Error($t('InstanceDeviceAccess.codecDebug.timeout'))))
      }, DEBUG_TIMEOUT)

      subscription = stream.subscribe({
        next: (message: any) => {
          const payload = message?.payload ?? message
          if (message?.type === 'error' || payload?.error) {
            finish(() => reject(new Error(payload?.message || JSON.stringify(payload?.detail) || message?.message || $t('InstanceDeviceAccess.codecDebug.failed'))))
            return
          }
          if (payload?.type === 'log') {
            appendExecutionLog(payload)
            return
          }
          if (message?.type === 'complete') {
            finish(() => reject(new Error($t('InstanceDeviceAccess.codecDebug.noResult'))))
            return
          }
          finish(() => resolve(payload))
        },
        error: (error: any) => {
          finish(() => reject(new Error(error?.message || $t('InstanceDeviceAccess.codecDebug.subscribeFailed'))))
        },
      })

      activeSubscriptions.add(subscription)
    })

  const handleAdd = (type: SimulatorType, data: Partial<SimulationItem> = {}, toTop?: boolean) => {
    const newItem: SimulationItem = {
      id: randomString(),
      type,
      encoding: data.encoding ?? (type === 'uplink' ? 'JSON' : 'Hex'),
      qos: data.qos ?? 0,
      commandType: data.commandType ?? 'read',
      ...data,
    }
    toTop ? list.value.unshift(newItem) : list.value.push(newItem)
    nextTick(() => {
      const container = simulatorContainerRef.value
      if (container) container.scrollTop = toTop ? 0 : container.scrollHeight
    })
    addLog($t(`InstanceDeviceAccess.codecDebug.add${type === 'uplink' ? 'Uplink' : 'Downlink'}Log`), 'operation')
  }

  const handleDelete = (index: number) => {
    const item = list.value[index]
    list.value.splice(index, 1)
    addLog(
      $t(`InstanceDeviceAccess.codecDebug.remove${item.type === 'uplink' ? 'Uplink' : 'Downlink'}Log`),
      'warn',
    )
  }

  const handleMove = (index: number, direction: number) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= list.value.length) return
    const current = list.value[index]
    list.value[index] = list.value[targetIndex]
    list.value[targetIndex] = current
  }

  const handleSend = (item: SimulationItem) => {
    const deviceId = String(instanceStore.current?.id || '').trim()
    if (!deviceId) {
      addLog($t('InstanceDeviceAccess.codecDebug.noDeviceId'), 'warn')
      onlyMessage($t('InstanceDeviceAccess.codecDebug.noDeviceId'), 'warning')
      return
    }
    if (item.type === 'downlink' && !String(item.commandId || '').trim()) {
      addLog($t('InstanceDeviceAccess.codecDebug.commandRequired'), 'warn')
      onlyMessage($t('InstanceDeviceAccess.codecDebug.commandRequired'), 'warning')
      return
    }
    item.isExecuted = true
    item.result = ''
    addLog($t(`InstanceDeviceAccess.codecDebug.send${item.type === 'uplink' ? 'Uplink' : 'Downlink'}Log`), 'process')
    sendDebugRequest(`/debug/device/${deviceId}/codec/simulate`, buildRequestParameter(item))
      .then((resp) => {
        item.result = resolveResult(resp, item.type) || $t('InstanceDeviceAccess.codecDebug.emptyResult')
        addLog($t(`InstanceDeviceAccess.codecDebug.${item.type === 'uplink' ? 'uplink' : 'downlink'}SendSuccess`), 'success')
      })
      .catch((error: any) => {
        item.result = error?.message || $t('InstanceDeviceAccess.codecDebug.failed')
        addLog($t('InstanceDeviceAccess.codecDebug.failed') + `: ${item.result}`, 'warn')
        onlyMessage($t('InstanceDeviceAccess.codecDebug.failed'), 'error')
      })
  }

  const reset = () => {
    list.value = []
    logs.value = []
  }

  const fillData = (data: Partial<SimulationItem> & { type: SimulatorType }, toTop?: boolean) => {
    handleAdd(data.type, data, toTop)
  }

  onUnmounted(() => {
    activeSubscriptions.forEach((subscription) => subscription?.unsubscribe?.())
    activeSubscriptions.clear()
  })

  return {
    list,
    logs,
    simulatorContainerRef,
    handleAdd,
    handleDelete,
    handleMove,
    handleSend,
    reset,
    fillData,
  }
}
