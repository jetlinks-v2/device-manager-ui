import i18n from '@jetlinks-web-core/locales'
import {
  createDomainAgentPreviewCardinality,
  createDomainAgentToolResult,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
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
  tailRemoteSystemFile,
} from '../../../../api/instance'
import type { DeviceDetailAgentArgs } from './deviceDetailAgent.shared'
import {
  AI_CV_MBEAN_NAME,
  AI_REVIEW_MBEAN_NAME,
  compactMBeanAttributes,
  compactCvMetrics,
  compactReviewMetrics,
  isMonitorMetricBean,
  readAiMetricsFromMBeanData,
  toCompactAiSide,
} from './deviceDetailEdgeAi.summary'
import { isEdgeDiagnosisAccessProvider } from './deviceDetailEdge.shared'

export {
  EDGE_DIAGNOSIS_ACCESS_PROVIDERS,
  EDGE_DIAGNOSIS_TOOL_IDS,
  isEdgeDiagnosisAccessProvider,
} from './deviceDetailEdge.shared'

export type EdgeDiagnosisDevice = {
  id?: unknown
  accessProvider?: unknown
}

const DEFAULT_ERROR_PATTERN = 'error|exception|failed|timeout|refused|disconnect|denied|认证|失败|超时|断开'
const SENSITIVE_KEY_PATTERN = /(password|passwd|secret|token|access.?key|private.?key|credential|authorization|证书|密钥|口令)/i
const TEXT_FILE_GLOB = '**/*.{log,txt,out,err,json,yml,yaml,properties,conf,xml}'

const MBEAN_QUERIES = {
  master: {
    scope: 'master',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.master',
    name: 'org.jetlinks:type=EdgeMasterManager,name=DefaultEdgeMasterManager',
  },
  buffer: {
    scope: 'buffer',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.buffer',
    name: 'org.jetlinks:type=PersistenceBuffer,name=*',
  },
  trace: {
    scope: 'trace',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.trace',
    name: 'org.jetlinks:type=Tracing,name=LocalTracing',
  },
  network: {
    scope: 'network',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.network',
    name: 'org.jetlinks:type=NetworkManager,name=NetworkMonitor',
  },
  session: {
    scope: 'session',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.session',
    name: 'org.jetlinks:type=DeviceSessionManager,name=PersistenceDeviceSessionManager',
  },
  eventbus: {
    scope: 'eventbus',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.eventbus',
    name: 'org.jetlinks:type=EventBus,name=ClusterEventBus',
  },
  review: {
    scope: 'ai.review',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.review',
    name: AI_REVIEW_MBEAN_NAME,
  },
  cv: {
    scope: 'ai.cv',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.cv',
    name: AI_CV_MBEAN_NAME,
  },
  memory: {
    scope: 'jvm.memory',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.memory',
    name: 'java.lang:type=Memory',
  },
  threading: {
    scope: 'jvm.threading',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.threading',
    name: 'java.lang:type=Threading',
  },
  runtime: {
    scope: 'jvm.runtime',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.runtime',
    name: 'java.lang:type=Runtime',
  },
  os: {
    scope: 'jvm.os',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.os',
    name: 'java.lang:type=OperatingSystem',
  },
  gc: {
    scope: 'jvm.gc',
    i18nKey: 'DeviceDetail.edgeTools.mbean.scopes.gc',
    name: 'java.lang:type=GarbageCollector,name=*',
  },
} as const

const MBEAN_SCOPE_MAPPING: Record<string, Array<keyof typeof MBEAN_QUERIES>> = {
  all: ['master', 'buffer', 'trace', 'network', 'session', 'eventbus', 'review', 'cv', 'memory', 'threading', 'runtime', 'os', 'gc'],
  master: ['master'],
  buffer: ['buffer'],
  persistence: ['buffer'],
  trace: ['trace'],
  network: ['network'],
  session: ['session'],
  eventbus: ['eventbus'],
  ai: ['review', 'cv'],
  'ai.review': ['review'],
  'ai.cv': ['cv'],
  review: ['review'],
  cv: ['cv'],
  jvm: ['memory', 'threading', 'runtime', 'os', 'gc'],
  memory: ['memory'],
  threading: ['threading'],
  runtime: ['runtime'],
  os: ['os'],
  gc: ['gc'],
}

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})

const clampNumber = (value: unknown, min: number, max: number, defaultValue: number) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultValue
  return Math.min(max, Math.max(min, n))
}

const asArray = <T = any>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : [])

const responseResult = (response: any) => response?.result ?? response?.data ?? response

const ensureSuccessResult = (response: any) => {
  if (response?.success === false) {
    throw new Error(response?.message || response?.result || t('DeviceDetail.agentTools.common.errors.requestFailed'))
  }
  if (response?.status && response.status !== 200) {
    throw new Error(response?.message || `${response.status}`)
  }
  return responseResult(response)
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
        code: error?.code || error?.response?.data?.code,
      },
    }
  }
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildSearchPattern = (value?: unknown, regex?: unknown) => {
  const raw = String(value || '').trim()
  if (!raw) return DEFAULT_ERROR_PATTERN
  if (regex === true) return raw
  const parts = raw.split(/[|,\s]+/).map(item => item.trim()).filter(Boolean)
  return parts.length ? parts.map(escapeRegex).join('|') : escapeRegex(raw)
}

const redactSensitiveText = (value: unknown, maxLength = 1600) => {
  if (value === undefined || value === null) return value
  let text = String(value)
  text = text.replace(
    /((?:password|passwd|secret|token|access[-_]?key|private[-_]?key|authorization|credential)\s*[:=]\s*)([^\s,;"']+)/ig,
    '$1***',
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
    return value.slice(0, 20).map(item => sanitizeValue(item, depth + 1))
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
  text: redactSensitiveText(line?.text ?? line, 1200),
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
    returnedCount: data.length,
    requestedLimit: lineLimit,
    lines: data,
    text: data.map(line => line.text).join('\n'),
    truncated: !!slice?.truncated || lines.length > data.length,
    reason: slice?.reason || (lines.length > data.length ? 'clientLineLimit' : undefined),
    nextFromLine: slice?.nextFromLine,
    readBytes: slice?.readBytes,
    archive: !!slice?.archive,
    compressed: !!slice?.compressed,
    seekable: !!slice?.seekable,
  }
}

const normalizeSearchMatches = (matches: any[], limit = 20) => (
  matches.slice(0, limit).map(match => ({
    path: match?.path,
    entry: match?.entry,
    lineNumber: match?.lineNumber,
    line: redactSensitiveText(match?.line, 1200),
    matchStart: match?.matchStart,
    matchEnd: match?.matchEnd,
    before: Array.isArray(match?.before) ? match.before.slice(0, 3).map(normalizeLine) : [],
    after: Array.isArray(match?.after) ? match.after.slice(0, 3).map(normalizeLine) : [],
    truncated: !!match?.truncated,
    reason: match?.reason,
  }))
)

const listMBeanBeans = (data: any) => {
  const beans: Array<{ domain: string; type: string; name: string; attributes: Record<string, any> }> = []
  Object.entries(data || {}).forEach(([domain, domainValue]: [string, any]) => {
    Object.entries(domainValue || {}).forEach(([type, typeValue]: [string, any]) => {
      Object.entries(typeValue || {}).forEach(([name, attributes]: [string, any]) => {
        const prepared = compactMBeanAttributes(type, name, attributes || {})
        beans.push({
          domain,
          type,
          name,
          attributes: isMonitorMetricBean(type, name) ? prepared : sanitizeValue(prepared),
        })
      })
    })
  })
  return beans
}

const getMBeanSections = async (
  deviceId: string,
  queryKeys: Array<keyof typeof MBEAN_QUERIES>,
) => Promise.all(queryKeys.map(async (key) => {
  const query = MBEAN_QUERIES[key]
  const label = t(query.i18nKey)
  const result = await safePart(async () => {
    const data = ensureSuccessResult(await queryRemoteSystemMonitorMBean(deviceId, query.name))
    return listMBeanBeans(data).map(bean => ({
      label,
      type: bean.type,
      name: bean.name,
      attributes: bean.attributes,
    }))
  })
  return result.ok
    ? { scope: query.scope, scopeLabel: label, ok: true, beans: result.data }
    : { scope: query.scope, scopeLabel: label, ok: false, error: result.error }
}))

const resolveMBeanScopes = (scope: unknown) => {
  const raw = String(scope || 'all').trim().toLowerCase()
  const keys = raw.split(/[,\s]+/).filter(Boolean)
  const selected = (keys.length ? keys : ['all']).flatMap(key => MBEAN_SCOPE_MAPPING[key] || [])
  const unique = [...new Set(selected)]
  return unique.length ? unique : MBEAN_SCOPE_MAPPING.all
}

const firstAttribute = (sections: any[], scope: string, attr: string) => (
  sections
    .find(section => section.scope === scope && section.ok)
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
  lastError: sanitizeValue(monitor.lastError),
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
  modifyTime: file.modifyTime,
})

const boundedWindow = (returnedCount: number, requestedLimit: number, truncated: boolean) => ({
  returnedCount,
  requestedLimit,
  exhaustive: false as const,
  populationCountSupported: false as const,
  truncated,
})

const detailResult = <T>(data: T, extra: Record<string, unknown> = {}) => createDomainAgentToolResult({
  domain: 'device',
  data,
  ...extra,
})

const boundedResult = <T>(data: T, window: ReturnType<typeof boundedWindow>) => createDomainAgentToolResult({
  domain: 'device',
  data,
  // Bounded file/search/dump windows are never an exhaustive population, even when
  // the returned count is below the requested limit.
  truncated: true,
  exhaustive: false,
  requestSatisfied: false,
  supportsAbsenceClaim: false,
  evidenceCoverage: 'bounded-query',
  facts: { evidenceWindow: window },
  cardinality: createDomainAgentPreviewCardinality({ displayedCount: window.returnedCount }),
})

const requirePath = (args: DeviceDetailAgentArgs) => {
  const path = String(args.path || '').trim()
  if (!path) throw new Error(t('DeviceDetail.agentTools.common.errors.pathMissing'))
  return path
}

/** Page-subject diagnostics; execute always re-checks the current access provider before any remote call. */
export const createDeviceDetailEdgeService = (
  getDevice: () => EdgeDiagnosisDevice,
) => {
  const ensureSupported = () => {
    const device = getDevice()
    const deviceId = String(device?.id || '').trim()
    if (!deviceId) throw new Error(t('DeviceDetail.agentTools.common.errors.deviceIdMissing'))
    const accessProvider = device?.accessProvider
    if (!isEdgeDiagnosisAccessProvider(accessProvider)) {
      throw new Error(t('DeviceDetail.edgeTools.common.errors.unsupportedAccessProvider', {
        accessProvider: accessProvider || 'unknown',
      }))
    }
    return deviceId
  }

  const executeFileCommand = async (runner: (deviceId: string) => Promise<any>) => {
    const deviceId = ensureSupported()
    return ensureSuccessResult(await runner(deviceId))
  }

  const runtimeSummary = async () => {
    const deviceId = ensureSupported()
    const [nodeDetail, jvmSections] = await Promise.all([
      safePart(async () => ensureSuccessResult(await queryRemoteSystemMonitorMembersDetail(deviceId))),
      safePart(async () => getMBeanSections(deviceId, MBEAN_SCOPE_MAPPING.jvm)),
    ])
    const nodes = nodeDetail.ok ? asArray<Record<string, any>>(nodeDetail.data) : []
    const node = nodes[0] || (nodeDetail.ok && nodeDetail.data && !Array.isArray(nodeDetail.data) ? nodeDetail.data : {})
    const configs = sanitizeValue(node?.configurations || {})
    return detailResult({
      deviceId,
      ok: nodeDetail.ok || jvmSections.ok,
      node: sanitizeValue({
        id: node?.id,
        name: node?.name,
        host: node?.host,
        tags: node?.tags,
      }),
      runtime: {
        jvm: sanitizeValue(configs?.JVM),
        os: sanitizeValue(configs?.OS),
        memory: sanitizeValue(configs?.memory),
        thread: sanitizeValue(configs?.thread),
      },
      mbean: jvmSections.ok ? jvmSections.data : undefined,
      error: !nodeDetail.ok ? nodeDetail.error : undefined,
    })
  }

  const mbeanSummary = async (args: DeviceDetailAgentArgs) => {
    const deviceId = ensureSupported()
    const queryKeys = resolveMBeanScopes(args.scope)
    const sections = await getMBeanSections(deviceId, queryKeys)
    return detailResult({
      deviceId,
      scope: String(args.scope || 'all'),
      sections,
    })
  }

  const queryAiMBeanSide = async (
    deviceId: string,
    key: 'review' | 'cv',
  ) => {
    const query = MBEAN_QUERIES[key]
    const result = await safePart(async () => {
      const data = ensureSuccessResult(await queryRemoteSystemMonitorMBean(deviceId, query.name))
      const metrics = readAiMetricsFromMBeanData(data)
      const compact = key === 'review' ? compactReviewMetrics(metrics) : compactCvMetrics(metrics)
      if (!compact) {
        throw new Error(t('DeviceDetail.edgeTools.aiRuntime.errors.mbeanMissing', {
          name: query.name,
        }))
      }
      return compact
    })
    return result.ok
      ? toCompactAiSide(result.data)
      : toCompactAiSide(undefined, result.error)
  }

  const aiRuntimeSummary = async () => {
    const deviceId = ensureSupported()
    const [review, cv] = await Promise.all([
      queryAiMBeanSide(deviceId, 'review'),
      queryAiMBeanSide(deviceId, 'cv'),
    ])
    return detailResult({
      deviceId,
      review,
      cv,
    })
  }

  const masterSummary = async () => {
    const deviceId = ensureSupported()
    const sections = await getMBeanSections(deviceId, ['master'])
    const masters = asArray<Record<string, any>>(firstAttribute(sections, 'master', 'Masters'))
    const connections = masters.flatMap(master => asArray<Record<string, any>>(master.connections))
    const returnedMasters = masters.slice(0, 10)
    return detailResult({
      deviceId,
      returnedCount: returnedMasters.length,
      connectedCount: connections.filter(item => item.connected).length,
      errorCount: connections.reduce((sum, item) => (
        sum
        + Number(item?.upstream?.numberOfErrors || 0)
        + Number(item?.downstream?.numberOfErrors || 0)
      ), 0),
      masters: returnedMasters.map(master => ({
        id: master.id,
        provider: master.provider,
        connections: asArray<Record<string, any>>(master.connections).slice(0, 5).map(connection => ({
          connected: !!connection.connected,
          upstream: summarizeMonitor(connection.upstream),
          downstream: summarizeMonitor(connection.downstream),
        })),
      })),
      truncated: masters.length > returnedMasters.length,
      sections,
    }, {
      truncated: masters.length > returnedMasters.length,
    })
  }

  const persistenceBufferSummary = async () => {
    const deviceId = ensureSupported()
    const sections = await getMBeanSections(deviceId, ['buffer'])
    const beans = sections.flatMap((section: any) => (section.ok ? section.beans : []))
    const buffers = beans.slice(0, 20).map((bean: any) => ({
      name: bean.name,
      remainder: Number(bean.attributes?.Remainder || 0),
      deadSize: Number(bean.attributes?.DeadSize || 0),
      wip: Number(bean.attributes?.Wip || 0),
      monitor: bean.attributes?.Monitor,
      settings: bean.attributes?.Settings,
      dataBytes: bean.attributes?.DataBytes,
      lastError: bean.attributes?.LastError,
    }))
    return detailResult({
      deviceId,
      returnedCount: buffers.length,
      buffers,
      truncated: beans.length > buffers.length,
      sections,
    }, {
      truncated: beans.length > buffers.length,
    })
  }

  const traceSummary = async () => {
    const deviceId = ensureSupported()
    const sections = await getMBeanSections(deviceId, ['trace'])
    const bean = sections.flatMap((section: any) => (section.ok ? section.beans : []))[0]
    return detailResult({
      deviceId,
      enabled: bean?.attributes?.Enabled,
      size: bean?.attributes?.Size,
      sizeInMemory: bean?.attributes?.SizeInMemory,
      sizeInMemoryBytes: bean?.attributes?.SizeInMemoryBytes,
      maxStoreSize: bean?.attributes?.MaxStoreSize,
      maxStoreTimeSeconds: bean?.attributes?.MaxStoreTimeSeconds,
      storeBytes: bean?.attributes?.StoreBytes,
      sections,
    })
  }

  const systemFileWorkdir = async () => {
    const deviceId = ensureSupported()
    const workingDirectory = await executeFileCommand(id => getRemoteSystemWorkingDirectory(id))
    return detailResult({ deviceId, workingDirectory })
  }

  const systemFileList = async (args: DeviceDetailAgentArgs) => {
    const deviceId = ensureSupported()
    const limit = clampNumber(args.limit, 1, 200, 50)
    const filter = String(args.filter || '').trim()
    const path = String(args.path || '').trim()
      || ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId))
    const files = asArray<Record<string, any>>(ensureSuccessResult(await listRemoteSystemFiles(deviceId, {
      path,
      filter: filter
        ? {
          id: 'fileName',
          configuration: { pattern: escapeRegex(filter) },
        }
        : undefined,
    })))
    const data = files.slice(0, limit).map(normalizeRemoteFile)
    const window = boundedWindow(data.length, limit, files.length > limit)
    return boundedResult({
      deviceId,
      path,
      filter: filter || undefined,
      ...window,
      data,
    }, window)
  }

  const systemFileStat = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    return detailResult(sanitizeValue(await executeFileCommand(deviceId => statRemoteSystemFile(deviceId, {
      path,
      entry: String(args.entry || '').trim() || undefined,
    }))))
  }

  const systemFileTail = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    const lines = clampNumber(args.lines, 1, 300, 120)
    const slice = await executeFileCommand(deviceId => tailRemoteSystemFile(deviceId, {
      path,
      entry: String(args.entry || '').trim() || undefined,
      lines,
      charset: String(args.charset || '').trim() || undefined,
    }))
    const data = normalizeTextSlice(slice, lines)
    const window = boundedWindow(data.returnedCount, lines, data.truncated)
    return boundedResult(data, window)
  }

  const systemFileHead = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    const lines = clampNumber(args.lines, 1, 300, 80)
    const slice = await executeFileCommand(deviceId => headRemoteSystemFile(deviceId, {
      path,
      entry: String(args.entry || '').trim() || undefined,
      lines,
      charset: String(args.charset || '').trim() || undefined,
    }))
    const data = normalizeTextSlice(slice, lines)
    const window = boundedWindow(data.returnedCount, lines, data.truncated)
    return boundedResult(data, window)
  }

  const systemFileReadText = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    const maxLines = clampNumber(args.maxLines ?? args.lines, 1, 300, 120)
    const slice = await executeFileCommand(deviceId => readRemoteSystemTextFile(deviceId, {
      path,
      entry: String(args.entry || '').trim() || undefined,
      charset: String(args.charset || '').trim() || undefined,
      fromLine: args.fromLine === undefined ? undefined : Number(args.fromLine),
      toLine: args.toLine === undefined ? undefined : Number(args.toLine),
      tailLines: args.tailLines === undefined ? undefined : clampNumber(args.tailLines, 1, 300, 120),
      maxLines,
    }))
    const data = normalizeTextSlice(slice, maxLines)
    const window = boundedWindow(data.returnedCount, maxLines, data.truncated)
    return boundedResult(data, window)
  }

  const systemFileSearch = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    const maxMatches = clampNumber(args.maxMatches, 1, 50, 20)
    const matches = asArray<Record<string, any>>(await executeFileCommand(deviceId => searchRemoteSystemFile(deviceId, {
      path,
      entry: String(args.entry || '').trim() || undefined,
      pattern: buildSearchPattern(args.pattern, args.regex),
      caseInsensitive: args.caseInsensitive !== false,
      includeGlob: String(args.includeGlob || TEXT_FILE_GLOB).trim(),
      maxMatches,
      maxFiles: clampNumber(args.maxFiles, 1, 80, 20),
      maxDepth: clampNumber(args.maxDepth, 1, 6, 3),
      beforeLines: clampNumber(args.beforeLines, 0, 3, 1),
      afterLines: clampNumber(args.afterLines, 0, 3, 1),
    })))
    const data = normalizeSearchMatches(matches, maxMatches)
    const truncated = matches.length > maxMatches || matches.some(item => item?.truncated)
    const window = boundedWindow(data.length, maxMatches, truncated)
    return boundedResult({
      deviceId: ensureSupported(),
      path,
      ...window,
      pattern: args.regex === true ? String(args.pattern || DEFAULT_ERROR_PATTERN) : undefined,
      keyword: args.regex === true ? undefined : String(args.pattern || DEFAULT_ERROR_PATTERN),
      data,
      reason: matches.find(item => item?.reason)?.reason,
    }, window)
  }

  const systemFileArchiveEntries = async (args: DeviceDetailAgentArgs) => {
    ensureSupported()
    const path = requirePath(args)
    const maxEntries = clampNumber(args.maxEntries, 1, 200, 50)
    const entries = asArray<Record<string, any>>(await executeFileCommand(deviceId => listRemoteSystemArchiveEntries(deviceId, {
      path,
      maxEntries,
    })))
    const data = entries.slice(0, maxEntries).map(sanitizeValue)
    const window = boundedWindow(data.length, maxEntries, entries.length > maxEntries)
    return boundedResult({
      deviceId: String(getDevice()?.id || '').trim(),
      path,
      ...window,
      data,
    }, window)
  }

  const runtimeLogsSummary = async (args: DeviceDetailAgentArgs) => {
    const deviceId = ensureSupported()
    const lines = clampNumber(args.lines, 1, 200, 80)
    const maxFiles = clampNumber(args.maxFiles, 1, 5, 3)
    const requestedPath = String(args.path || '').trim()
    const workingDirectory = requestedPath
      ? ''
      : ensureSuccessResult(await getRemoteSystemWorkingDirectory(deviceId))
    const candidates = requestedPath
      ? [{ path: requestedPath, name: requestedPath.split('/').pop() || requestedPath, directory: false }]
      : asArray<Record<string, any>>(ensureSuccessResult(await listRemoteSystemFiles(deviceId, {
        path: workingDirectory,
        filter: {
          id: 'fileName',
          configuration: { pattern: escapeRegex(String(args.filter || 'log').trim() || 'log') },
        },
      })))
        .filter(file => !file.directory)
        .sort((left, right) => Number(right.modifyTime || 0) - Number(left.modifyTime || 0))
        .slice(0, maxFiles)

    const summaries = await Promise.all(candidates.slice(0, maxFiles).map(async (file) => {
      const path = String(file.path || '')
      const [stat, tail, search] = await Promise.all([
        safePart(async () => ensureSuccessResult(await statRemoteSystemFile(deviceId, { path }))),
        safePart(async () => ensureSuccessResult(await tailRemoteSystemFile(deviceId, { path, lines }))),
        safePart(async () => asArray<Record<string, any>>(ensureSuccessResult(await searchRemoteSystemFile(deviceId, {
          path,
          pattern: buildSearchPattern(args.pattern, args.regex),
          caseInsensitive: true,
          includeGlob: TEXT_FILE_GLOB,
          maxMatches: 10,
          maxFiles: 1,
          beforeLines: 1,
          afterLines: 1,
        })))),
      ])
      return {
        file: normalizeRemoteFile(file),
        stat: stat.ok ? sanitizeValue(stat.data) : undefined,
        tail: tail.ok ? normalizeTextSlice(tail.data, lines) : undefined,
        search: search.ok ? normalizeSearchMatches(search.data, 10) : undefined,
        errors: [stat, tail, search].filter(item => !item.ok).map((item: any) => item.error),
      }
    }))
    const truncated = !requestedPath && candidates.length >= maxFiles
    const window = boundedWindow(summaries.length, maxFiles, truncated)
    return boundedResult({
      deviceId,
      workingDirectory: workingDirectory || undefined,
      ...window,
      patternHint: String(args.pattern || DEFAULT_ERROR_PATTERN),
      summaries,
    }, window)
  }

  const threadDumpSummary = async (args: DeviceDetailAgentArgs) => {
    const deviceId = ensureSupported()
    const maxPreviewLength = clampNumber(args.maxPreviewLength, 1000, 12000, 6000)
    const text = String(ensureSuccessResult(await dumpRemoteSystemThreadText(deviceId)) || '')
    const states = ['RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'].reduce<Record<string, number>>((result, state) => {
      result[state] = (text.match(new RegExp(`Thread\\.State:\\s*${state}`, 'g')) || []).length
      return result
    }, {})
    const truncated = text.length > maxPreviewLength
    const window = boundedWindow(1, 1, truncated)
    return boundedResult({
      deviceId,
      states,
      threadLikeBlocks: (text.match(/^"/gm) || []).length,
      preview: redactSensitiveText(text, maxPreviewLength),
      truncated,
      requestedLimit: maxPreviewLength,
    }, window)
  }

  return {
    runtimeSummary,
    mbeanSummary,
    aiRuntimeSummary,
    masterSummary,
    persistenceBufferSummary,
    traceSummary,
    systemFileWorkdir,
    systemFileList,
    systemFileStat,
    systemFileTail,
    systemFileHead,
    systemFileReadText,
    systemFileSearch,
    systemFileArchiveEntries,
    runtimeLogsSummary,
    threadDumpSummary,
  }
}
