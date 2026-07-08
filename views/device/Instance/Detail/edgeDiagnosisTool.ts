import {
  dumpRemoteSystemThreadText,
  getRemoteSystemWorkingDirectory,
  headRemoteSystemFile,
  listRemoteSystemArchiveEntries,
  listRemoteSystemFiles,
  queryRemoteSystemMonitorMBean,
  queryRemoteSystemMonitorMembersDetail,
  readRemoteSystemTextFile,
  searchRemoteSystemFile,
  statRemoteSystemFile,
  tailRemoteSystemFile
} from '../../../../api/instance'
import type { AiClientToolDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientTools'

type DeviceDetailRecord = Record<string, any>
type TranslateFn = (key: string, params?: Record<string, any>) => string

interface EdgeDiagnosisToolContext {
  device: DeviceDetailRecord
}

interface EdgeDiagnosisToolDependencies {
  t: TranslateFn
  clampNumber: (value: unknown, min: number, max: number, defaultValue: number) => number
  asArray: <T = any>(value: unknown) => T[]
  responseResult: (response: any) => any
  compactInlineValue: (value: unknown, maxLength?: number) => any
  getDeviceId: (context: EdgeDiagnosisToolContext) => string
}

export const EDGE_DIAGNOSIS_ACCESS_PROVIDERS = new Set([
  'agent-device-gateway',
  'agent-media-device-gateway'
])

export const isEdgeDiagnosisAccessProvider = (accessProvider?: unknown) => (
  EDGE_DIAGNOSIS_ACCESS_PROVIDERS.has(String(accessProvider || ''))
)

const DEFAULT_ERROR_PATTERN = 'error|exception|failed|timeout|refused|disconnect|denied|认证|失败|超时|断开'
const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|access.?key|private.?key|credential|authorization|证书|密钥|口令)/i
const TEXT_FILE_GLOB = '**/*.{log,txt,out,err,json,yml,yaml,properties,conf,xml}'

const MBEAN_QUERIES = {
  master: {
    scope: 'master',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.master',
    name: 'org.jetlinks:type=EdgeMasterManager,name=DefaultEdgeMasterManager'
  },
  buffer: {
    scope: 'buffer',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.buffer',
    name: 'org.jetlinks:type=PersistenceBuffer,name=*'
  },
  trace: {
    scope: 'trace',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.trace',
    name: 'org.jetlinks:type=Tracing,name=LocalTracing'
  },
  network: {
    scope: 'network',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.network',
    name: 'org.jetlinks:type=NetworkManager,name=NetworkMonitor'
  },
  session: {
    scope: 'session',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.session',
    name: 'org.jetlinks:type=DeviceSessionManager,name=PersistenceDeviceSessionManager'
  },
  eventbus: {
    scope: 'eventbus',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.eventbus',
    name: 'org.jetlinks:type=EventBus,name=ClusterEventBus'
  },
  memory: {
    scope: 'jvm.memory',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.memory',
    name: 'java.lang:type=Memory'
  },
  threading: {
    scope: 'jvm.threading',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.threading',
    name: 'java.lang:type=Threading'
  },
  runtime: {
    scope: 'jvm.runtime',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.runtime',
    name: 'java.lang:type=Runtime'
  },
  os: {
    scope: 'jvm.os',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.os',
    name: 'java.lang:type=OperatingSystem'
  },
  gc: {
    scope: 'jvm.gc',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.gc',
    name: 'java.lang:type=GarbageCollector,name=*'
  }
} as const

const MBEAN_SCOPE_MAPPING: Record<string, Array<keyof typeof MBEAN_QUERIES>> = {
  all: ['master', 'buffer', 'trace', 'network', 'session', 'eventbus', 'memory', 'threading', 'runtime', 'os', 'gc'],
  master: ['master'],
  buffer: ['buffer'],
  persistence: ['buffer'],
  trace: ['trace'],
  network: ['network'],
  session: ['session'],
  eventbus: ['eventbus'],
  jvm: ['memory', 'threading', 'runtime', 'os', 'gc'],
  memory: ['memory'],
  threading: ['threading'],
  runtime: ['runtime'],
  os: ['os'],
  gc: ['gc']
}

const ensureSuccessResult = (response: any, deps: EdgeDiagnosisToolDependencies) => {
  if (response?.success === false) {
    throw new Error(response?.message || response?.result || deps.t('DeviceDetail.agentTools.common.errors.requestFailed'))
  }
  if (response?.status && response.status !== 200) {
    throw new Error(response?.message || `${response.status}`)
  }
  return deps.responseResult(response)
}

const ensureEdgeSupported = (
  context: EdgeDiagnosisToolContext,
  deps: EdgeDiagnosisToolDependencies
) => {
  const deviceId = deps.getDeviceId(context)
  if (!deviceId) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
  const accessProvider = context.device?.accessProvider
  if (!isEdgeDiagnosisAccessProvider(accessProvider)) {
    throw new Error(deps.t('DeviceDetail.edgeTools.common.errors.unsupportedAccessProvider', { accessProvider: accessProvider || 'unknown' }))
  }
  return deviceId
}

const safePart = async <T>(runner: () => Promise<T> | T) => {
  try {
    return { ok: true as const, data: await runner() }
  } catch (error: any) {
    return {
      ok: false as const,
      error: {
        message: error?.message || String(error),
        status: error?.status || error?.response?.status,
        code: error?.code || error?.response?.data?.code
      }
    }
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildSearchPattern = (value?: unknown, regex?: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) {
    return DEFAULT_ERROR_PATTERN
  }
  if (regex === true) {
    return raw
  }
  const parts = raw.split(/[|,\s]+/).map((item) => item.trim()).filter(Boolean)
  return parts.length ? parts.map(escapeRegex).join('|') : escapeRegex(raw)
}

const redactSensitiveText = (value: unknown, maxLength = 1600) => {
  if (value === undefined || value === null) return value
  let text = String(value)
  text = text.replace(
    /((?:password|passwd|secret|token|access[-_]?key|private[-_]?key|authorization|credential)\s*[:=]\s*)([^\s,;"']+)/ig,
    '$1***'
  )
  text = text.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/ig, '$1***')
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

const sanitizeValue = (value: any, depth = 0): any => {
  if (value === undefined || value === null) return value
  if (typeof value === 'string') return redactSensitiveText(value, depth > 2 ? 600 : 1600)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (depth > 4) return '[truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  }
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 60).reduce<Record<string, any>>((result, [key, item]) => {
      if (key.startsWith('@')) return result
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '***' : sanitizeValue(item, depth + 1)
      return result
    }, {})
  }
  return value
}

const normalizeLine = (line: any) => ({
  number: line?.number,
  text: redactSensitiveText(line?.text ?? line, 1200)
})

const normalizeTextSlice = (slice: any, lineLimit = 120) => {
  const lines = Array.isArray(slice?.lines) ? slice.lines : []
  const data = lines.slice(0, lineLimit).map(normalizeLine)
  return {
    path: slice?.path,
    entry: slice?.entry,
    charset: slice?.charset,
    fromLine: slice?.fromLine,
    toLine: slice?.toLine,
    tail: !!slice?.tail,
    tailLines: slice?.tailLines,
    returned: data.length,
    lines: data,
    text: data.map((line) => line.text).join('\n'),
    truncated: !!slice?.truncated || lines.length > data.length,
    reason: slice?.reason || (lines.length > data.length ? 'clientLineLimit' : undefined),
    nextFromLine: slice?.nextFromLine,
    readBytes: slice?.readBytes,
    archive: !!slice?.archive,
    compressed: !!slice?.compressed,
    seekable: !!slice?.seekable
  }
}

const normalizeSearchMatches = (matches: any[], limit = 20) => (
  matches.slice(0, limit).map((match) => ({
    path: match?.path,
    entry: match?.entry,
    lineNumber: match?.lineNumber,
    line: redactSensitiveText(match?.line, 1200),
    matchStart: match?.matchStart,
    matchEnd: match?.matchEnd,
    before: Array.isArray(match?.before) ? match.before.slice(0, 3).map(normalizeLine) : [],
    after: Array.isArray(match?.after) ? match.after.slice(0, 3).map(normalizeLine) : [],
    truncated: !!match?.truncated,
    reason: match?.reason
  }))
)

const listMBeanBeans = (data: any) => {
  const beans: Array<{ domain: string; type: string; name: string; attributes: Record<string, any> }> = []
  Object.entries(data || {}).forEach(([domain, domainValue]: [string, any]) => {
    Object.entries(domainValue || {}).forEach(([type, typeValue]: [string, any]) => {
      Object.entries(typeValue || {}).forEach(([name, attributes]: [string, any]) => {
        beans.push({
          domain,
          type,
          name,
          attributes: sanitizeValue(attributes || {})
        })
      })
    })
  })
  return beans
}

const getMBeanSections = async (
  deviceId: string,
  queryKeys: Array<keyof typeof MBEAN_QUERIES>,
  deps: EdgeDiagnosisToolDependencies
) => Promise.all(queryKeys.map(async (key) => {
  const query = MBEAN_QUERIES[key]
  const label = deps.t(query.i18nKey)
  const result = await safePart(async () => {
    const data = ensureSuccessResult(await queryRemoteSystemMonitorMBean(deviceId, query.name), deps)
    return listMBeanBeans(data).map((bean) => ({
      label,
      type: bean.type,
      name: bean.name,
      attributes: bean.attributes
    }))
  })
  return result.ok
    ? { scope: query.scope, scopeLabel: label, ok: true, beans: result.data }
    : { scope: query.scope, scopeLabel: label, ok: false, error: result.error }
}))

const resolveMBeanScopes = (scope: unknown) => {
  const raw = String(scope || 'all').trim().toLowerCase()
  const keys = raw.split(/[,\s]+/).filter(Boolean)
  const selected = (keys.length ? keys : ['all']).flatMap((key) => MBEAN_SCOPE_MAPPING[key] || [])
  const unique = [...new Set(selected)]
  return unique.length ? unique : MBEAN_SCOPE_MAPPING.all
}

const firstAttribute = (sections: any[], scope: string, attr: string) => (
  sections
    .find((section) => section.scope === scope && section.ok)
    ?.beans
    ?.find((bean: any) => bean?.attributes?.[attr] !== undefined)
    ?.attributes?.[attr]
)

const summarizeMonitor = (monitor: any = {}) => ({
  executions: Number(monitor.numberOfExecutions || 0),
  success: Number(monitor.numberOfSuccess || 0),
  errors: Number(monitor.numberOfErrors || 0),
  consecutiveErrors: Number(monitor.numberOfConsecutiveErrors || 0),
  lastExecutionTime: monitor.lastExecutionTime,
  lastError: sanitizeValue(monitor.lastError)
})

const normalizeRemoteFile = (file: Record<string, any>) => ({
  path: file.path,
  name: file.name,
  directory: !!file.directory,
  size: Number(file.size || 0),
  mediaType: typeof file.mediaType === 'string'
    ? file.mediaType
    : [file.mediaType?.type, file.mediaType?.subtype].filter(Boolean).join('/'),
  canRead: file.canRead,
  canWrite: !!file.canWrite,
  permission: Array.isArray(file.permission) ? file.permission : [],
  createTime: file.createTime,
  modifyTime: file.modifyTime
})

export const createEdgeDiagnosisClientTools = (
  deps: EdgeDiagnosisToolDependencies
): AiClientToolDefinition<EdgeDiagnosisToolContext>[] => {
  const executeFileCommand = async (context: EdgeDiagnosisToolContext, runner: (deviceId: string) => Promise<any>) => {
    const deviceId = ensureEdgeSupported(context, deps)
    return ensureSuccessResult(await runner(deviceId), deps)
  }

  return [
    {
      id: 'edge_runtime_summary',
      name: 'edge_runtime_summary',
      description: deps.t('DeviceDetail.edgeTools.runtimeSummary.description'),
      inputs: [],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.runtimeSummary.help'),
      execute: async (_args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const [nodeDetail, jvmSections] = await Promise.all([
          safePart(async () => ensureSuccessResult(await queryRemoteSystemMonitorMembersDetail(deviceId), deps)),
          safePart(async () => getMBeanSections(deviceId, MBEAN_SCOPE_MAPPING.jvm, deps))
        ])
        const nodes = nodeDetail.ok ? deps.asArray<Record<string, any>>(nodeDetail.data) : []
        const node = nodes[0] || (nodeDetail.ok && nodeDetail.data && !Array.isArray(nodeDetail.data) ? nodeDetail.data : {})
        const configs = sanitizeValue(node?.configurations || {})
        return {
          deviceId,
          ok: nodeDetail.ok || jvmSections.ok,
          node: sanitizeValue({
            id: node?.id,
            name: node?.name,
            host: node?.host,
            tags: node?.tags
          }),
          runtime: {
            jvm: sanitizeValue(configs?.JVM),
            os: sanitizeValue(configs?.OS),
            memory: sanitizeValue(configs?.memory),
            thread: sanitizeValue(configs?.thread)
          },
          mbean: jvmSections.ok ? jvmSections.data : undefined,
          error: !nodeDetail.ok ? nodeDetail.error : undefined
        }
      }
    },
    {
      id: 'edge_mbean_summary',
      name: 'edge_mbean_summary',
      description: deps.t('DeviceDetail.edgeTools.mbeanSummary.description'),
      inputs: [
        {
          id: 'scope',
          name: 'scope',
          description: deps.t('DeviceDetail.edgeTools.mbeanSummary.inputs.scope'),
          required: false,
          valueType: 'string'
        }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.mbeanSummary.help'),
      execute: async (args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const queryKeys = resolveMBeanScopes(args.scope)
        return {
          deviceId,
          scope: String(args.scope || 'all'),
          sections: await getMBeanSections(deviceId, queryKeys, deps)
        }
      }
    },
    {
      id: 'edge_master_summary',
      name: 'edge_master_summary',
      description: deps.t('DeviceDetail.edgeTools.masterSummary.description'),
      inputs: [],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.masterSummary.help'),
      execute: async (_args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const sections = await getMBeanSections(deviceId, ['master'], deps)
        const masters = deps.asArray<Record<string, any>>(firstAttribute(sections, 'master', 'Masters'))
        const connections = masters.flatMap((master) => deps.asArray<Record<string, any>>(master.connections))
        return {
          deviceId,
          total: masters.length,
          connectedCount: connections.filter((item) => item.connected).length,
          errorCount: connections.reduce((sum, item) => (
            sum
            + Number(item?.upstream?.numberOfErrors || 0)
            + Number(item?.downstream?.numberOfErrors || 0)
          ), 0),
          masters: masters.slice(0, 10).map((master) => ({
            id: master.id,
            provider: master.provider,
            connections: deps.asArray<Record<string, any>>(master.connections).slice(0, 5).map((connection) => ({
              connected: !!connection.connected,
              upstream: summarizeMonitor(connection.upstream),
              downstream: summarizeMonitor(connection.downstream)
            }))
          })),
          sections
        }
      }
    },
    {
      id: 'edge_persistence_buffer_summary',
      name: 'edge_persistence_buffer_summary',
      description: deps.t('DeviceDetail.edgeTools.bufferSummary.description'),
      inputs: [],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.bufferSummary.help'),
      execute: async (_args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const sections = await getMBeanSections(deviceId, ['buffer'], deps)
        const beans = sections.flatMap((section: any) => section.ok ? section.beans : [])
        return {
          deviceId,
          total: beans.length,
          buffers: beans.slice(0, 20).map((bean: any) => ({
            name: bean.name,
            remainder: Number(bean.attributes?.Remainder || 0),
            deadSize: Number(bean.attributes?.DeadSize || 0),
            wip: Number(bean.attributes?.Wip || 0),
            monitor: bean.attributes?.Monitor,
            settings: bean.attributes?.Settings,
            dataBytes: bean.attributes?.DataBytes,
            lastError: bean.attributes?.LastError
          })),
          sections
        }
      }
    },
    {
      id: 'edge_trace_summary',
      name: 'edge_trace_summary',
      description: deps.t('DeviceDetail.edgeTools.traceSummary.description'),
      inputs: [],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.traceSummary.help'),
      execute: async (_args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const sections = await getMBeanSections(deviceId, ['trace'], deps)
        const bean = sections.flatMap((section: any) => section.ok ? section.beans : [])[0]
        return {
          deviceId,
          enabled: bean?.attributes?.Enabled,
          size: bean?.attributes?.Size,
          sizeInMemory: bean?.attributes?.SizeInMemory,
          sizeInMemoryBytes: bean?.attributes?.SizeInMemoryBytes,
          maxStoreSize: bean?.attributes?.MaxStoreSize,
          maxStoreTimeSeconds: bean?.attributes?.MaxStoreTimeSeconds,
          storeBytes: bean?.attributes?.StoreBytes,
          sections
        }
      }
    },
    {
      id: 'edge_system_file_workdir',
      name: 'edge_system_file_workdir',
      description: deps.t('DeviceDetail.edgeTools.fileWorkdir.description'),
      inputs: [],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileWorkdir.help'),
      execute: async (_args, context) => {
        const workingDirectory = await executeFileCommand(context, getRemoteSystemWorkingDirectory)
        return {
          deviceId: deps.getDeviceId(context),
          workingDirectory
        }
      }
    },
    {
      id: 'edge_system_file_list',
      name: 'edge_system_file_list',
      description: deps.t('DeviceDetail.edgeTools.fileList.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.pathOptionalWorkdir'), required: false, valueType: 'string' },
        { id: 'filter', name: 'filter', description: deps.t('DeviceDetail.edgeTools.inputs.filter'), required: false, valueType: 'string' },
        { id: 'limit', name: 'limit', description: deps.t('DeviceDetail.edgeTools.inputs.limit50'), required: false, valueType: 'int' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileList.help'),
      execute: async (args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const limit = deps.clampNumber(args.limit, 1, 200, 50)
        const filter = String(args.filter || '').trim()
        const path = String(args.path || '').trim()
          || ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId), deps)
        const files = deps.asArray<Record<string, any>>(ensureSuccessResult(await listRemoteSystemFiles(deviceId, {
          path,
          filter: filter
            ? {
              id: 'fileName',
              configuration: { pattern: escapeRegex(filter) }
            }
            : undefined
        }), deps))
        return {
          deviceId,
          path,
          filter: filter || undefined,
          total: files.length,
          returned: Math.min(files.length, limit),
          data: files.slice(0, limit).map(normalizeRemoteFile)
        }
      }
    },
    {
      id: 'edge_system_file_stat',
      name: 'edge_system_file_stat',
      description: deps.t('DeviceDetail.edgeTools.fileStat.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.fileOrDirectoryPath'), required: true, valueType: 'string' },
        { id: 'entry', name: 'entry', description: deps.t('DeviceDetail.edgeTools.inputs.archiveEntry'), required: false, valueType: 'string' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileStat.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        return sanitizeValue(await executeFileCommand(context, (deviceId) => statRemoteSystemFile(deviceId, {
          path,
          entry: String(args.entry || '').trim() || undefined
        })))
      }
    },
    {
      id: 'edge_system_file_tail',
      name: 'edge_system_file_tail',
      description: deps.t('DeviceDetail.edgeTools.fileTail.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.filePath'), required: true, valueType: 'string' },
        { id: 'entry', name: 'entry', description: deps.t('DeviceDetail.edgeTools.inputs.archiveEntry'), required: false, valueType: 'string' },
        { id: 'lines', name: 'lines', description: deps.t('DeviceDetail.edgeTools.inputs.tailLines'), required: false, valueType: 'int' },
        { id: 'charset', name: 'charset', description: deps.t('DeviceDetail.edgeTools.inputs.charset'), required: false, valueType: 'string' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileTail.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        const lines = deps.clampNumber(args.lines, 1, 300, 120)
        const slice = await executeFileCommand(context, (deviceId) => tailRemoteSystemFile(deviceId, {
          path,
          entry: String(args.entry || '').trim() || undefined,
          lines,
          charset: String(args.charset || '').trim() || undefined
        }))
        return normalizeTextSlice(slice, lines)
      }
    },
    {
      id: 'edge_system_file_head',
      name: 'edge_system_file_head',
      description: deps.t('DeviceDetail.edgeTools.fileHead.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.filePath'), required: true, valueType: 'string' },
        { id: 'entry', name: 'entry', description: deps.t('DeviceDetail.edgeTools.inputs.archiveEntry'), required: false, valueType: 'string' },
        { id: 'lines', name: 'lines', description: deps.t('DeviceDetail.edgeTools.inputs.headLines'), required: false, valueType: 'int' },
        { id: 'charset', name: 'charset', description: deps.t('DeviceDetail.edgeTools.inputs.charset'), required: false, valueType: 'string' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileHead.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        const lines = deps.clampNumber(args.lines, 1, 300, 80)
        const slice = await executeFileCommand(context, (deviceId) => headRemoteSystemFile(deviceId, {
          path,
          entry: String(args.entry || '').trim() || undefined,
          lines,
          charset: String(args.charset || '').trim() || undefined
        }))
        return normalizeTextSlice(slice, lines)
      }
    },
    {
      id: 'edge_system_file_read_text',
      name: 'edge_system_file_read_text',
      description: deps.t('DeviceDetail.edgeTools.fileReadText.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.filePath'), required: true, valueType: 'string' },
        { id: 'entry', name: 'entry', description: deps.t('DeviceDetail.edgeTools.inputs.archiveEntry'), required: false, valueType: 'string' },
        { id: 'fromLine', name: 'fromLine', description: deps.t('DeviceDetail.edgeTools.inputs.fromLine'), required: false, valueType: 'long' },
        { id: 'toLine', name: 'toLine', description: deps.t('DeviceDetail.edgeTools.inputs.toLine'), required: false, valueType: 'long' },
        { id: 'tailLines', name: 'tailLines', description: deps.t('DeviceDetail.edgeTools.inputs.tailLinesOverride'), required: false, valueType: 'int' },
        { id: 'maxLines', name: 'maxLines', description: deps.t('DeviceDetail.edgeTools.inputs.maxLines'), required: false, valueType: 'int' },
        { id: 'charset', name: 'charset', description: deps.t('DeviceDetail.edgeTools.inputs.charset'), required: false, valueType: 'string' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileReadText.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        const maxLines = deps.clampNumber(args.maxLines ?? args.lines, 1, 300, 120)
        const slice = await executeFileCommand(context, (deviceId) => readRemoteSystemTextFile(deviceId, {
          path,
          entry: String(args.entry || '').trim() || undefined,
          charset: String(args.charset || '').trim() || undefined,
          fromLine: args.fromLine === undefined ? undefined : Number(args.fromLine),
          toLine: args.toLine === undefined ? undefined : Number(args.toLine),
          tailLines: args.tailLines === undefined ? undefined : deps.clampNumber(args.tailLines, 1, 300, 120),
          maxLines
        }))
        return normalizeTextSlice(slice, maxLines)
      }
    },
    {
      id: 'edge_system_file_search',
      name: 'edge_system_file_search',
      description: deps.t('DeviceDetail.edgeTools.fileSearch.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.fileOrDirectoryPath'), required: true, valueType: 'string' },
        { id: 'entry', name: 'entry', description: deps.t('DeviceDetail.edgeTools.inputs.archiveEntryForSearch'), required: false, valueType: 'string' },
        { id: 'pattern', name: 'pattern', description: deps.t('DeviceDetail.edgeTools.inputs.pattern'), required: false, valueType: 'string' },
        { id: 'regex', name: 'regex', description: deps.t('DeviceDetail.edgeTools.inputs.regex'), required: false, valueType: 'boolean' },
        { id: 'caseInsensitive', name: 'caseInsensitive', description: deps.t('DeviceDetail.edgeTools.inputs.caseInsensitive'), required: false, valueType: 'boolean' },
        { id: 'maxMatches', name: 'maxMatches', description: deps.t('DeviceDetail.edgeTools.inputs.maxMatches'), required: false, valueType: 'int' },
        { id: 'maxFiles', name: 'maxFiles', description: deps.t('DeviceDetail.edgeTools.inputs.maxFiles'), required: false, valueType: 'int' },
        { id: 'maxDepth', name: 'maxDepth', description: deps.t('DeviceDetail.edgeTools.inputs.maxDepth'), required: false, valueType: 'int' },
        { id: 'beforeLines', name: 'beforeLines', description: deps.t('DeviceDetail.edgeTools.inputs.beforeLines'), required: false, valueType: 'int' },
        { id: 'afterLines', name: 'afterLines', description: deps.t('DeviceDetail.edgeTools.inputs.afterLines'), required: false, valueType: 'int' },
        { id: 'includeGlob', name: 'includeGlob', description: deps.t('DeviceDetail.edgeTools.inputs.includeGlob', { glob: TEXT_FILE_GLOB }), required: false, valueType: 'string' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.fileSearch.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        const maxMatches = deps.clampNumber(args.maxMatches, 1, 50, 20)
        const matches = deps.asArray<Record<string, any>>(await executeFileCommand(context, (deviceId) => searchRemoteSystemFile(deviceId, {
          path,
          entry: String(args.entry || '').trim() || undefined,
          pattern: buildSearchPattern(args.pattern, args.regex),
          caseInsensitive: args.caseInsensitive !== false,
          includeGlob: String(args.includeGlob || TEXT_FILE_GLOB).trim(),
          maxMatches,
          maxFiles: deps.clampNumber(args.maxFiles, 1, 80, 20),
          maxDepth: deps.clampNumber(args.maxDepth, 1, 6, 3),
          beforeLines: deps.clampNumber(args.beforeLines, 0, 3, 1),
          afterLines: deps.clampNumber(args.afterLines, 0, 3, 1)
        })))
        return {
          deviceId: deps.getDeviceId(context),
          path,
          total: matches.length,
          returned: Math.min(matches.length, maxMatches),
          pattern: args.regex === true ? String(args.pattern || DEFAULT_ERROR_PATTERN) : undefined,
          keyword: args.regex === true ? undefined : String(args.pattern || DEFAULT_ERROR_PATTERN),
          data: normalizeSearchMatches(matches, maxMatches),
          truncated: matches.length > maxMatches || matches.some((item) => item?.truncated),
          reason: matches.find((item) => item?.reason)?.reason
        }
      }
    },
    {
      id: 'edge_system_file_archive_entries',
      name: 'edge_system_file_archive_entries',
      description: deps.t('DeviceDetail.edgeTools.archiveEntries.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.inputs.archivePath'), required: true, valueType: 'string' },
        { id: 'maxEntries', name: 'maxEntries', description: deps.t('DeviceDetail.edgeTools.inputs.maxEntries'), required: false, valueType: 'int' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.archiveEntries.help'),
      execute: async (args, context) => {
        const path = String(args.path || '').trim()
        if (!path) throw new Error(deps.t('DeviceDetail.agentTools.common.errors.pathMissing'))
        const maxEntries = deps.clampNumber(args.maxEntries, 1, 200, 50)
        const entries = deps.asArray<Record<string, any>>(await executeFileCommand(context, (deviceId) => listRemoteSystemArchiveEntries(deviceId, {
          path,
          maxEntries
        })))
        return {
          deviceId: deps.getDeviceId(context),
          path,
          total: entries.length,
          returned: Math.min(entries.length, maxEntries),
          data: entries.slice(0, maxEntries).map(sanitizeValue)
        }
      }
    },
    {
      id: 'edge_runtime_logs_summary',
      name: 'edge_runtime_logs_summary',
      description: deps.t('DeviceDetail.edgeTools.runtimeLogs.description'),
      inputs: [
        { id: 'path', name: 'path', description: deps.t('DeviceDetail.edgeTools.runtimeLogs.inputs.path'), required: false, valueType: 'string' },
        { id: 'filter', name: 'filter', description: deps.t('DeviceDetail.edgeTools.runtimeLogs.inputs.filter'), required: false, valueType: 'string' },
        { id: 'pattern', name: 'pattern', description: deps.t('DeviceDetail.edgeTools.runtimeLogs.inputs.pattern'), required: false, valueType: 'string' },
        { id: 'regex', name: 'regex', description: deps.t('DeviceDetail.edgeTools.inputs.regex'), required: false, valueType: 'boolean' },
        { id: 'lines', name: 'lines', description: deps.t('DeviceDetail.edgeTools.runtimeLogs.inputs.lines'), required: false, valueType: 'int' },
        { id: 'maxFiles', name: 'maxFiles', description: deps.t('DeviceDetail.edgeTools.runtimeLogs.inputs.maxFiles'), required: false, valueType: 'int' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.runtimeLogs.help'),
      execute: async (args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const lines = deps.clampNumber(args.lines, 1, 200, 80)
        const maxFiles = deps.clampNumber(args.maxFiles, 1, 5, 3)
        const requestedPath = String(args.path || '').trim()
        const workingDirectory = requestedPath
          ? ''
          : ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId), deps)
        const candidates = requestedPath
          ? [{ path: requestedPath, name: requestedPath.split('/').pop() || requestedPath, directory: false }]
          : deps.asArray<Record<string, any>>(ensureSuccessResult(await listRemoteSystemFiles(deviceId, {
            path: workingDirectory,
            filter: {
              id: 'fileName',
              configuration: { pattern: escapeRegex(String(args.filter || 'log').trim() || 'log') }
            }
          }), deps))
            .filter((file) => !file.directory)
            .sort((left, right) => Number(right.modifyTime || 0) - Number(left.modifyTime || 0))
            .slice(0, maxFiles)

        const summaries = await Promise.all(candidates.slice(0, maxFiles).map(async (file) => {
          const path = String(file.path || '')
          const [stat, tail, search] = await Promise.all([
            safePart(async () => ensureSuccessResult(await statRemoteSystemFile(deviceId, { path }), deps)),
            safePart(async () => ensureSuccessResult(await tailRemoteSystemFile(deviceId, { path, lines }), deps)),
            safePart(async () => deps.asArray<Record<string, any>>(ensureSuccessResult(await searchRemoteSystemFile(deviceId, {
              path,
              pattern: buildSearchPattern(args.pattern, args.regex),
              caseInsensitive: true,
              includeGlob: TEXT_FILE_GLOB,
              maxMatches: 10,
              maxFiles: 1,
              beforeLines: 1,
              afterLines: 1
            }), deps)))
          ])
          return {
            file: normalizeRemoteFile(file),
            stat: stat.ok ? sanitizeValue(stat.data) : undefined,
            tail: tail.ok ? normalizeTextSlice(tail.data, lines) : undefined,
            search: search.ok ? normalizeSearchMatches(search.data, 10) : undefined,
            errors: [stat, tail, search].filter((item) => !item.ok).map((item: any) => item.error)
          }
        }))

        return {
          deviceId,
          workingDirectory: workingDirectory || undefined,
          candidateTotal: candidates.length,
          returned: summaries.length,
          patternHint: String(args.pattern || DEFAULT_ERROR_PATTERN),
          summaries,
          limited: !requestedPath && candidates.length >= maxFiles
        }
      }
    },
    {
      id: 'edge_thread_dump_summary',
      name: 'edge_thread_dump_summary',
      description: deps.t('DeviceDetail.edgeTools.threadDump.description'),
      confirm: {
        title: deps.t('DeviceDetail.edgeTools.threadDump.confirmTitle'),
        content: deps.t('DeviceDetail.edgeTools.threadDump.confirmContent'),
        okText: deps.t('DeviceDetail.edgeTools.threadDump.confirmOk'),
        cancelText: deps.t('DeviceDetail.agentTools.common.cancel')
      },
      inputs: [
        { id: 'maxPreviewLength', name: 'maxPreviewLength', description: deps.t('DeviceDetail.edgeTools.threadDump.inputs.maxPreviewLength'), required: false, valueType: 'int' }
      ],
      output: { type: 'object' },
      help: deps.t('DeviceDetail.edgeTools.threadDump.help'),
      execute: async (args, context) => {
        const deviceId = ensureEdgeSupported(context, deps)
        const maxPreviewLength = deps.clampNumber(args.maxPreviewLength, 1000, 12000, 6000)
        const text = String(ensureSuccessResult(await dumpRemoteSystemThreadText(deviceId), deps) || '')
        const states = ['RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'].reduce<Record<string, number>>((result, state) => {
          result[state] = (text.match(new RegExp(`Thread\\.State:\\s*${state}`, 'g')) || []).length
          return result
        }, {})
        return {
          deviceId,
          states,
          threadLikeBlocks: (text.match(/^"/gm) || []).length,
          preview: redactSensitiveText(text, maxPreviewLength),
          truncated: text.length > maxPreviewLength
        }
      }
    }
  ]
}
