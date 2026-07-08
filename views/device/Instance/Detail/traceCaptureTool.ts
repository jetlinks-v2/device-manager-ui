import { map } from 'rxjs/operators'
import { wsClient } from '@jetlinks-web/core'
import type {
  AiClientToolCall,
  AiClientToolDefinition
} from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceClientToolContext = {
  device: Record<string, any>
}

interface DeviceTraceCaptureToolDependencies {
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  compactInlineValue: (value: unknown, maxLength?: number) => unknown
  withWriteToPathInput: (inputs: any[]) => any[]
  writeRecordsToSessionFile: <T = any>(
    args: Record<string, any>,
    call: AiClientToolCall,
    records: T[]
  ) => Promise<any> | any
  getDeviceId: (context: DeviceClientToolContext) => string
}

type TraceTaskStatus = 'running' | 'completed' | 'failed'

interface DeviceTraceCaptureTask {
  taskId: string
  deviceId: string
  status: TraceTaskStatus
  startedAt: number
  expiresAt: number
  durationMs: number
  sampleLimit: number
  eventLimit: number
  records: Record<string, any>[]
  accumulator: ReturnType<typeof createTraceAccumulator>
  reason?: string
  error?: {
    message: string
  }
  sub?: {
    unsubscribe: () => void
  }
  timer?: ReturnType<typeof setTimeout>
  cleanupTimer?: ReturnType<typeof setTimeout>
  resolveDone: (result: Record<string, any>) => void
  rejectDone: (error: Error) => void
  done: Promise<Record<string, any>>
}

const TRACE_TASK_TTL_MS = 10 * 60 * 1000
const traceTasks = new Map<string, DeviceTraceCaptureTask>()

const normalizeTraceDirection = (payload: Record<string, any>) => {
  if (payload?.upstream === true) return 'upstream'
  if (payload?.downstream === true) return 'downstream'
  const operation = String(payload?.operation || '').trim().toLowerCase()
  if (['upstream', 'decode', 'request'].includes(operation)) return 'upstream'
  if (['downstream', 'encode', 'response'].includes(operation)) return 'downstream'
  return undefined
}

const normalizeTraceSignatureText = (
  compactInlineValue: DeviceTraceCaptureToolDependencies['compactInlineValue'],
  value: unknown,
  maxLength = 320
) => (
  String(compactInlineValue(value, maxLength) ?? '')
    .replace(/\s+/g, ' ')
    .trim()
)

const buildTraceSignature = (
  compactInlineValue: DeviceTraceCaptureToolDependencies['compactInlineValue'],
  item: Record<string, any>
) => ([
  item.direction || '',
  item.type || '',
  item.operation || '',
  item.logLevel || '',
  normalizeTraceSignatureText(compactInlineValue, item.message),
  normalizeTraceSignatureText(compactInlineValue, item.error),
  normalizeTraceSignatureText(compactInlineValue, item.detail),
  normalizeTraceSignatureText(compactInlineValue, item.upstream),
  normalizeTraceSignatureText(compactInlineValue, item.downstream)
].join('|').toLowerCase())

const incrementCounter = (target: Record<string, number>, key?: unknown) => {
  const normalized = String(key || 'unknown').trim() || 'unknown'
  target[normalized] = (target[normalized] || 0) + 1
}

const counterToSortedList = (counter: Record<string, number>, limit = 12) => (
  Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
)

const createTraceAccumulator = (
  compactInlineValue: DeviceTraceCaptureToolDependencies['compactInlineValue'],
  sampleLimit: number
) => {
  const MAX_TRACE_SIGNATURES = 500
  const samples: Record<string, any>[] = []
  const signatures = new Map<string, { count: number; sample: Record<string, any> }>()
  const byDirection: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const byOperation: Record<string, number> = {}
  const byLogLevel: Record<string, number> = {}
  let receivedCount = 0
  let overflowEventCount = 0

  const ingest = (item: Record<string, any>) => {
    receivedCount += 1
    incrementCounter(byDirection, item.direction)
    incrementCounter(byType, item.type)
    incrementCounter(byOperation, item.operation)
    incrementCounter(byLogLevel, item.logLevel)

    const signature = buildTraceSignature(compactInlineValue, item)
    const existing = signatures.get(signature)
    if (existing) {
      existing.count += 1
    } else if (signatures.size < MAX_TRACE_SIGNATURES) {
      signatures.set(signature, { count: 1, sample: item })
      if (samples.length < sampleLimit) {
        samples.push(item)
      }
    } else {
      overflowEventCount += 1
    }
  }

  const toResult = () => {
    const topSignatures = Array.from(signatures.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((item) => ({
        count: item.count,
        direction: item.sample.direction,
        type: item.sample.type,
        operation: item.sample.operation,
        logLevel: item.sample.logLevel,
        message: compactInlineValue(item.sample.message || item.sample.error || item.sample.detail, 360)
      }))

    const trackedEventCount = Array.from(signatures.values()).reduce((total, item) => total + item.count, 0)
    return {
      receivedCount,
      sampleCount: samples.length,
      trackedSignatureCount: signatures.size,
      duplicateCount: Math.max(0, trackedEventCount - signatures.size),
      overflowEventCount,
      dedupeRule: '按 direction/type/operation/logLevel 与 message/detail/error/upstream/downstream 摘要去重；timestamp、traceId、spanId 只用于定位，不参与语义去重。',
      byDirection: counterToSortedList(byDirection),
      byType: counterToSortedList(byType),
      byOperation: counterToSortedList(byOperation),
      byLogLevel: counterToSortedList(byLogLevel),
      topSignatures,
      samples
    }
  }

  return { ingest, toResult }
}

const normalizeTracePayload = (
  compactInlineValue: DeviceTraceCaptureToolDependencies['compactInlineValue'],
  payload: Record<string, any>
) => ({
  type: payload?.type,
  operation: payload?.operation,
  logLevel: payload?.logLevel,
  traceId: payload?.traceId,
  spanId: payload?.spanId,
  parentSpanId: payload?.parentSpanId,
  messageId: payload?.messageId,
  direction: normalizeTraceDirection(payload),
  timestamp: payload?.timestamp,
  startTime: payload?.startTime,
  endTime: payload?.endTime,
  detail: compactInlineValue(payload?.detail, 1200),
  message: compactInlineValue(payload?.message, 1200),
  error: compactInlineValue(payload?.error, 1200),
  upstream: compactInlineValue(payload?.upstream, 1600),
  downstream: compactInlineValue(payload?.downstream, 1600)
})

const normalizeTraceAction = (args: Record<string, any>) => {
  if (args.async === true) return 'start'
  const raw = String(args.action || args.mode || '').trim().toLowerCase()
  const normalized = raw.replace(/[\s_\-]+/g, '')
  const aliases: Record<string, 'capture' | 'start' | 'status' | 'stop' | 'cancel'> = {
    '': 'capture',
    capture: 'capture',
    sync: 'capture',
    wait: 'capture',
    start: 'start',
    begin: 'start',
    async: 'start',
    status: 'status',
    query: 'status',
    stop: 'stop',
    finish: 'stop',
    end: 'stop',
    complete: 'stop',
    cancel: 'cancel'
  }
  return aliases[normalized] || 'capture'
}

const createTraceTaskId = (deviceId: string) => (
  `trace-${deviceId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    .replace(/[^a-zA-Z0-9_.:-]/g, '-')
)

const scheduleTaskCleanup = (task: DeviceTraceCaptureTask) => {
  if (task.cleanupTimer) {
    clearTimeout(task.cleanupTimer)
  }
  task.cleanupTimer = setTimeout(() => {
    traceTasks.delete(task.taskId)
  }, TRACE_TASK_TTL_MS)
}

const cleanupTaskRuntime = (task: DeviceTraceCaptureTask) => {
  if (task.timer) {
    clearTimeout(task.timer)
    task.timer = undefined
  }
  task.sub?.unsubscribe()
  task.sub = undefined
}

const toTraceCaptureResult = (
  task: DeviceTraceCaptureTask,
  options: {
    includeRecords?: boolean
  } = {}
) => {
  const now = Date.now()
  const analysis = task.accumulator.toResult()
  const result = {
    deviceId: task.deviceId,
    taskId: task.taskId,
    status: task.status,
    running: task.status === 'running',
    reason: task.reason || (task.status === 'running' ? 'running' : undefined),
    startedAt: task.startedAt,
    expiresAt: task.expiresAt,
    elapsedSeconds: Math.max(0, Math.round((now - task.startedAt) / 100) / 10),
    durationSeconds: task.durationMs / 1000,
    maxEvents: task.eventLimit,
    count: analysis.receivedCount,
    inlineDataPolicy: {
      normalized: true,
      rawPayloadOmitted: true,
      sampleLimit: task.sampleLimit,
      eventLimit: task.eventLimit,
      detail: '内联结果只返回归一后的统计、去重签名和代表样本；完整事件不直接返回给模型。'
    },
    analysis,
    samples: analysis.samples,
    ...(task.error ? { error: task.error } : {}),
    ...(options.includeRecords ? { records: task.records } : {})
  }
  return result
}

const finishTraceTask = (
  task: DeviceTraceCaptureTask,
  reason: string
) => {
  if (task.status !== 'running') {
    return toTraceCaptureResult(task, { includeRecords: true })
  }
  task.status = 'completed'
  task.reason = reason
  cleanupTaskRuntime(task)
  const result = toTraceCaptureResult(task, { includeRecords: true })
  task.resolveDone(result)
  scheduleTaskCleanup(task)
  return result
}

const failTraceTask = (task: DeviceTraceCaptureTask, error: unknown) => {
  if (task.status !== 'running') return
  const normalized = error instanceof Error ? error : new Error(String(error))
  task.status = 'failed'
  task.reason = 'error'
  task.error = { message: normalized.message }
  cleanupTaskRuntime(task)
  task.rejectDone(normalized)
  scheduleTaskCleanup(task)
}

const createTraceTask = (
  deps: DeviceTraceCaptureToolDependencies,
  args: Record<string, any>,
  deviceId: string
) => {
  const durationMs = deps.clampNumber(args.seconds, 1, 60, 5) * 1000
  const sampleLimit = deps.clampNumber(args.limit, 1, 30, 10)
  const eventLimit = deps.clampNumber(args.maxEvents, sampleLimit, 5000, Math.max(sampleLimit, 300))
  const taskId = String(args.taskId || createTraceTaskId(deviceId)).trim()
  if (!taskId) throw new Error('taskId missing')
  if (traceTasks.has(taskId)) {
    throw new Error(`trace task already exists: ${taskId}`)
  }

  const topic = `/debug/device/${deviceId}/trace`
  const wsId = `ai-device-debug-${deviceId}-${taskId}`
  const socket = wsClient.getWebSocket(wsId, topic, {})
  if (!socket) {
    throw new Error('device trace websocket unavailable')
  }

  let resolveDone: DeviceTraceCaptureTask['resolveDone'] = () => undefined
  let rejectDone: DeviceTraceCaptureTask['rejectDone'] = () => undefined
  const task: DeviceTraceCaptureTask = {
    taskId,
    deviceId,
    status: 'running',
    startedAt: Date.now(),
    expiresAt: Date.now() + durationMs,
    durationMs,
    sampleLimit,
    eventLimit,
    records: [],
    accumulator: createTraceAccumulator(deps.compactInlineValue, sampleLimit),
    resolveDone,
    rejectDone,
    done: new Promise((resolve, reject) => {
      resolveDone = resolve
      rejectDone = reject
    })
  }
  task.resolveDone = resolveDone
  task.rejectDone = rejectDone

  traceTasks.set(taskId, task)
  task.done.catch(() => undefined)

  // 异步模式必须由任务状态机持有订阅；stop/status 后才能把采样窗口和下发动作串起来。
  task.timer = setTimeout(() => finishTraceTask(task, 'timeout'), durationMs)
  task.sub = socket
    .pipe(map((res: any) => (res != null && res.payload !== undefined ? res.payload : res)))
    .subscribe({
      next: (payload: any) => {
        const item = normalizeTracePayload(deps.compactInlineValue, payload)
        task.records.push(item)
        task.accumulator.ingest(item)
        if (task.records.length >= task.eventLimit) {
          finishTraceTask(task, 'maxEvents')
        }
      },
      error: (error: unknown) => failTraceTask(task, error),
      complete: () => finishTraceTask(task, 'complete')
    })

  return task
}

const getTraceTask = (taskId: unknown, deviceId: string) => {
  const id = String(taskId || '').trim()
  if (!id) throw new Error('taskId missing')
  const task = traceTasks.get(id)
  if (!task) {
    return undefined
  }
  if (task.deviceId !== deviceId) {
    throw new Error(`trace task ${id} does not belong to current device`)
  }
  return task
}

const createTaskNotFoundResult = (taskId: unknown, deviceId: string) => ({
  deviceId,
  taskId: String(taskId || '').trim(),
  status: 'not_found',
  running: false,
  nextAction: '未找到该抓包任务。可能已超过保留时间、页面已刷新，或 taskId 不属于当前设备；请重新 action=start 后再复现。'
})

const appendTraceFileSummary = async (
  deps: DeviceTraceCaptureToolDependencies,
  args: Record<string, any>,
  call: AiClientToolCall,
  result: Record<string, any>
) => {
  const records = Array.isArray(result.records) ? result.records : []
  const fileSummary = await deps.writeRecordsToSessionFile(args, call, records)
  const visibleResult = {
    ...result
  }
  delete visibleResult.records
  if (!args.writeToPath) return visibleResult
  return {
    ...visibleResult,
    ...(fileSummary ? {
      traceFile: fileSummary,
      nextAction: `已返回抓包统计和归一后的去重代表样本，完整归一事件已写入 ${fileSummary.uri}。若需要继续按字段过滤、聚合或制图，使用 dataset_materialize(inputPath="${fileSummary.inputPath}", format="jsonl") 后再处理。`
    } : {})
  }
}

const createStartResult = (task: DeviceTraceCaptureTask) => ({
  ...toTraceCaptureResult(task),
  nextAction: `抓包任务已启动。若需要用户复现或等待超过 8 秒，先回复用户“已开启 ${task.durationMs / 1000} 秒抓包，请现在触发操作”，不要静默长时间等待；完成后调用 device_trace_capture(action="stop", taskId="${task.taskId}") 汇总结果。`
})

export const createDeviceTraceCaptureClientTools = (
  deps: DeviceTraceCaptureToolDependencies
): AiClientToolDefinition<DeviceClientToolContext>[] => ([
  {
    id: 'device_trace_capture',
    name: 'device_trace_capture',
    displayName: '设备链路抓包',
    progressText: '正在抓取设备链路',
    progressDescription: '正在订阅当前设备实时链路、协议日志和诊断数据。',
    description: '订阅并抓取当前设备实时链路、协议日志和诊断数据；短采样可同步 capture，超过 8 秒或需要用户复现/下发时必须使用 start/status/stop 异步窗口。',
    inputs: deps.withWriteToPathInput([
      {
        id: 'action',
        name: 'action',
        description: '动作：capture(默认同步采样，仅适合 1-8 秒短采样)、start(启动后立即返回 taskId)、status(查看进度)、stop(停止并汇总)、cancel(取消并汇总)。超过 8 秒、需要下发功能或等待用户复现时必须用 start；也可传 async=true 等价于 start。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'taskId',
        name: 'taskId',
        description: 'action=status/stop/cancel 时传入 start 返回的 taskId；action=start 时可选自定义 taskId。',
        required: false,
        valueType: 'string'
      },
      {
        id: 'async',
        name: 'async',
        description: '为 true 时等价于 action=start，适合先启动抓包再下发指令、等待设备上报或等待用户复现。',
        required: false,
        valueType: 'boolean'
      },
      {
        id: 'seconds',
        name: 'seconds',
        description: '抓取秒数，默认5，最大60。异步 start 会在超时后自动停止；同步 capture 会等待到结束再返回，所以超过 8 秒不要用同步 capture。',
        required: false,
        valueType: 'int'
      },
      {
        id: 'limit',
        name: 'limit',
        description: '内联返回的代表样本条数，默认10，最大30；不代表抓包总量。',
        required: false,
        valueType: 'int'
      },
      {
        id: 'maxEvents',
        name: 'maxEvents',
        description: '本次抓包最多接收的事件数，默认300，最大5000；高频设备可适当调大，达到上限会停止并返回 maxEvents。',
        required: false,
        valueType: 'int'
      }
    ]),
    output: { type: 'object' },
    help: '实时抓取设备接入链路样本。1-8 秒的一次性短采样可直接调用默认 capture；超过 8 秒、需要用户复现、需要先抓包再下发/重连/认证复现/等待上报的任务，必须先调用 device_trace_capture(action=start) 获得 taskId，并先给用户可见反馈，说明已开启抓包和需要用户做什么，再在窗口内调用 device_function_invoke、time_await 或等待设备通信，最后调用 device_trace_capture(action=stop, taskId=...) 汇总。工具会先把 WebSocket payload 归一为 direction/type/operation/logLevel/message/detail/error/upstream/downstream 预览，再按语义签名聚合去重；内联只返回统计、重复数量、topSignatures 和 samples，不把原始 JSON 直接返回给模型。完整事件默认不返回到对话，只有在 stop 或同步 capture 时传 writeToPath 才写 JSONL 文件，且文件内容也是归一后的记录。',
    execute: async (args, context, call) => {
      const deviceId = deps.getDeviceId(context)
      if (!deviceId) throw new Error('deviceId missing')
      const action = normalizeTraceAction(args)

      if (action === 'start') {
        return createStartResult(createTraceTask(deps, args, deviceId))
      }

      if (action === 'status') {
        const task = getTraceTask(args.taskId, deviceId)
        return task
          ? {
              ...toTraceCaptureResult(task),
              nextAction: task.status === 'running'
                ? `抓包仍在进行；完成复现或下发后调用 device_trace_capture(action="stop", taskId="${task.taskId}")。`
                : undefined
            }
          : createTaskNotFoundResult(args.taskId, deviceId)
      }

      if (action === 'stop' || action === 'cancel') {
        const task = getTraceTask(args.taskId, deviceId)
        if (!task) return createTaskNotFoundResult(args.taskId, deviceId)
        const result = finishTraceTask(task, action === 'cancel' ? 'cancelled' : 'manualStop')
        return appendTraceFileSummary(deps, args, call, result)
      }

      const task = createTraceTask(deps, args, deviceId)
      const result = await task.done
      return appendTraceFileSummary(deps, args, call, result)
    }
  }
])
