import i18n from '@jetlinks-web-core/locales'
import {
  clientToolOutput,
  defineClientTool,
} from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import type { AiClientToolDefinition, AiClientToolInput } from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import {
  adaptDomainAgentClientToolResult,
  domainAgentIntegerValueType,
} from '@jetlinks-web-core/layout/components/AiChat/domainAgentTools'
import { EDGE_DIAGNOSIS_TOOL_IDS } from './deviceDetailEdge.shared'

type EdgeDiagnosisService = {
  runtimeSummary: () => Promise<any>
  mbeanSummary: (args: Record<string, any>) => Promise<any>
  aiRuntimeSummary: () => Promise<any>
  masterSummary: () => Promise<any>
  persistenceBufferSummary: () => Promise<any>
  traceSummary: () => Promise<any>
  systemFileWorkdir: () => Promise<any>
  systemFileList: (args: Record<string, any>) => Promise<any>
  systemFileStat: (args: Record<string, any>) => Promise<any>
  systemFileTail: (args: Record<string, any>) => Promise<any>
  systemFileHead: (args: Record<string, any>) => Promise<any>
  systemFileReadText: (args: Record<string, any>) => Promise<any>
  systemFileSearch: (args: Record<string, any>) => Promise<any>
  systemFileArchiveEntries: (args: Record<string, any>) => Promise<any>
  runtimeLogsSummary: (args: Record<string, any>) => Promise<any>
  threadDumpSummary: (args: Record<string, any>) => Promise<any>
}
type DeviceDetailToolContext = Record<string, unknown>

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})
const owner = { module: 'iot-ui', group: 'device-detail-edge' } as const

const input = (
  id: string,
  description: string,
  valueType: NonNullable<AiClientToolInput['valueType']> = 'string',
  required = false,
): AiClientToolInput => ({
  id,
  name: id,
  description,
  valueType,
  required,
})

const intInput = (id: string, description: string, min: number, max: number, required = false) => (
  input(id, description, domainAgentIntegerValueType(min, max), required)
)

const edgeDetailOutput = (name: string, shape: string, label: string) => clientToolOutput.detail({
  name,
  shape,
  label,
  delivery: 'inline',
  select: (result: any) => result?.data ?? result,
})

const executeEdge = async (runner: () => Promise<any>) => adaptDomainAgentClientToolResult(await runner() as any)

const edgeReadTool = (options: {
  id: typeof EDGE_DIAGNOSIS_TOOL_IDS[number]
  capability: string
  outputName: string
  outputShape: string
  descriptionKey: string
  helpKey: string
  intents?: string[]
  notFor?: string[]
  inputs?: AiClientToolInput[]
  execute: AiClientToolDefinition<DeviceDetailToolContext>['execute']
}) => defineClientTool<Record<string, any>, DeviceDetailToolContext, any>({
  id: options.id,
  description: {
    text: t(options.descriptionKey),
    help: t(options.helpKey),
    capabilities: [options.capability],
    intents: options.intents,
    notFor: options.notFor,
  },
  effect: { kind: 'READ' },
  output: edgeDetailOutput(options.outputName, options.outputShape, t(options.descriptionKey)),
  owner,
  inputs: options.inputs,
  execute: options.execute,
})

export const createDeviceDetailEdgeTools = (
  service: EdgeDiagnosisService,
): AiClientToolDefinition<DeviceDetailToolContext>[] => ([
  edgeReadTool({
    id: 'edge_runtime_summary',
    capability: 'edge.runtime.summary.read',
    outputName: 'edge-runtime-summary',
    outputShape: 'edge.runtime.summary',
    descriptionKey: 'DeviceDetail.edgeTools.runtimeSummary.description',
    helpKey: 'DeviceDetail.edgeTools.runtimeSummary.help',
    intents: ['读取边端运行摘要', 'read edge runtime summary'],
    notFor: ['invoke MBean operations', 'dump heap or JFR'],
    execute: () => executeEdge(service.runtimeSummary),
  }),
  edgeReadTool({
    id: 'edge_mbean_summary',
    capability: 'edge.mbean.summary.read',
    outputName: 'edge-mbean-summary',
    outputShape: 'edge.mbean.summary',
    descriptionKey: 'DeviceDetail.edgeTools.mbeanSummary.description',
    helpKey: 'DeviceDetail.edgeTools.mbeanSummary.help',
    intents: ['读取白名单 MBean 摘要', 'read whitelisted MBean summary'],
    notFor: ['MBean invoke', 'enable or disable trace', 'reset or flush buffers'],
    inputs: [input('scope', t('DeviceDetail.edgeTools.mbeanSummary.inputs.scope'))],
    execute: args => executeEdge(() => service.mbeanSummary(args)),
  }),
  edgeReadTool({
    id: 'edge_ai_runtime_summary',
    capability: 'edge.ai.runtime.summary.read',
    outputName: 'edge-ai-runtime-summary',
    outputShape: 'edge.ai.runtime.summary',
    descriptionKey: 'DeviceDetail.edgeTools.aiRuntime.description',
    helpKey: 'DeviceDetail.edgeTools.aiRuntime.help',
    intents: ['读取边端 AI 复判与 CV 运行摘要', 'read edge AI review and CV runtime summary'],
    notFor: ['dump full tasks or samples', 'MBean invoke'],
    execute: () => executeEdge(service.aiRuntimeSummary),
  }),
  edgeReadTool({
    id: 'edge_master_summary',
    capability: 'edge.master.summary.read',
    outputName: 'edge-master-summary',
    outputShape: 'edge.master.summary',
    descriptionKey: 'DeviceDetail.edgeTools.masterSummary.description',
    helpKey: 'DeviceDetail.edgeTools.masterSummary.help',
    intents: ['读取云边 master 连接摘要', 'read cloud-edge master connection summary'],
    execute: () => executeEdge(service.masterSummary),
  }),
  edgeReadTool({
    id: 'edge_persistence_buffer_summary',
    capability: 'edge.buffer.summary.read',
    outputName: 'edge-buffer-summary',
    outputShape: 'edge.buffer.summary',
    descriptionKey: 'DeviceDetail.edgeTools.bufferSummary.description',
    helpKey: 'DeviceDetail.edgeTools.bufferSummary.help',
    intents: ['读取边端缓冲区摘要', 'read edge persistence buffer summary'],
    notFor: ['reset, flush, retry, recovery, or peekDead'],
    execute: () => executeEdge(service.persistenceBufferSummary),
  }),
  edgeReadTool({
    id: 'edge_trace_summary',
    capability: 'edge.trace.summary.read',
    outputName: 'edge-trace-summary',
    outputShape: 'edge.trace.summary',
    descriptionKey: 'DeviceDetail.edgeTools.traceSummary.description',
    helpKey: 'DeviceDetail.edgeTools.traceSummary.help',
    intents: ['读取边端 trace 摘要', 'read edge trace store summary'],
    notFor: ['enable, disable, cleanup, or compact trace'],
    execute: () => executeEdge(service.traceSummary),
  }),
  edgeReadTool({
    id: 'edge_system_file_workdir',
    capability: 'edge.file.workdir.read',
    outputName: 'edge-file-workdir',
    outputShape: 'edge.file.workdir',
    descriptionKey: 'DeviceDetail.edgeTools.fileWorkdir.description',
    helpKey: 'DeviceDetail.edgeTools.fileWorkdir.help',
    intents: ['读取边端工作目录', 'read edge working directory'],
    execute: () => executeEdge(service.systemFileWorkdir),
  }),
  edgeReadTool({
    id: 'edge_system_file_list',
    capability: 'edge.file.list',
    outputName: 'edge-file-list',
    outputShape: 'edge.file.list.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.fileList.description',
    helpKey: 'DeviceDetail.edgeTools.fileList.help',
    intents: ['列出边端目录有限条目', 'list a bounded edge directory window'],
    notFor: ['write or delete remote files', 'claim a directory population total'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.pathOptionalWorkdir')),
      input('filter', t('DeviceDetail.edgeTools.inputs.filter')),
      intInput('limit', t('DeviceDetail.edgeTools.inputs.limit50'), 1, 200),
    ],
    execute: args => executeEdge(() => service.systemFileList(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_stat',
    capability: 'edge.file.stat',
    outputName: 'edge-file-stat',
    outputShape: 'edge.file.stat',
    descriptionKey: 'DeviceDetail.edgeTools.fileStat.description',
    helpKey: 'DeviceDetail.edgeTools.fileStat.help',
    intents: ['读取边端文件状态', 'stat an edge file or directory'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.fileOrDirectoryPath'), 'string', true),
      input('entry', t('DeviceDetail.edgeTools.inputs.archiveEntry')),
    ],
    execute: args => executeEdge(() => service.systemFileStat(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_tail',
    capability: 'edge.file.tail',
    outputName: 'edge-file-tail',
    outputShape: 'edge.file.tail.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.fileTail.description',
    helpKey: 'DeviceDetail.edgeTools.fileTail.help',
    intents: ['读取边端文件尾部有限行', 'read a bounded edge file tail'],
    notFor: ['download an entire remote file'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.filePath'), 'string', true),
      input('entry', t('DeviceDetail.edgeTools.inputs.archiveEntry')),
      intInput('lines', t('DeviceDetail.edgeTools.inputs.tailLines'), 1, 300),
      input('charset', t('DeviceDetail.edgeTools.inputs.charset')),
    ],
    execute: args => executeEdge(() => service.systemFileTail(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_head',
    capability: 'edge.file.head',
    outputName: 'edge-file-head',
    outputShape: 'edge.file.head.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.fileHead.description',
    helpKey: 'DeviceDetail.edgeTools.fileHead.help',
    intents: ['读取边端文件开头有限行', 'read a bounded edge file head'],
    notFor: ['download an entire remote file'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.filePath'), 'string', true),
      input('entry', t('DeviceDetail.edgeTools.inputs.archiveEntry')),
      intInput('lines', t('DeviceDetail.edgeTools.inputs.headLines'), 1, 300),
      input('charset', t('DeviceDetail.edgeTools.inputs.charset')),
    ],
    execute: args => executeEdge(() => service.systemFileHead(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_read_text',
    capability: 'edge.file.read-text',
    outputName: 'edge-file-read-text',
    outputShape: 'edge.file.read-text.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.fileReadText.description',
    helpKey: 'DeviceDetail.edgeTools.fileReadText.help',
    intents: ['分段读取边端文本', 'read a bounded edge text window'],
    notFor: ['loop through an entire remote file'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.filePath'), 'string', true),
      input('entry', t('DeviceDetail.edgeTools.inputs.archiveEntry')),
      input('fromLine', t('DeviceDetail.edgeTools.inputs.fromLine'), 'long'),
      input('toLine', t('DeviceDetail.edgeTools.inputs.toLine'), 'long'),
      intInput('tailLines', t('DeviceDetail.edgeTools.inputs.tailLinesOverride'), 1, 300),
      intInput('maxLines', t('DeviceDetail.edgeTools.inputs.maxLines'), 1, 300),
      input('charset', t('DeviceDetail.edgeTools.inputs.charset')),
    ],
    execute: args => executeEdge(() => service.systemFileReadText(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_search',
    capability: 'edge.file.search',
    outputName: 'edge-file-search',
    outputShape: 'edge.file.search.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.fileSearch.description',
    helpKey: 'DeviceDetail.edgeTools.fileSearch.help',
    intents: ['搜索边端日志错误样本', 'search a bounded edge log window'],
    notFor: ['claim a search population total', 'write or delete remote files'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.fileOrDirectoryPath'), 'string', true),
      input('entry', t('DeviceDetail.edgeTools.inputs.archiveEntryForSearch')),
      input('pattern', t('DeviceDetail.edgeTools.inputs.pattern')),
      input('regex', t('DeviceDetail.edgeTools.inputs.regex'), 'boolean'),
      input('caseInsensitive', t('DeviceDetail.edgeTools.inputs.caseInsensitive'), 'boolean'),
      intInput('maxMatches', t('DeviceDetail.edgeTools.inputs.maxMatches'), 1, 50),
      intInput('maxFiles', t('DeviceDetail.edgeTools.inputs.maxFiles'), 1, 80),
      intInput('maxDepth', t('DeviceDetail.edgeTools.inputs.maxDepth'), 1, 6),
      intInput('beforeLines', t('DeviceDetail.edgeTools.inputs.beforeLines'), 0, 3),
      intInput('afterLines', t('DeviceDetail.edgeTools.inputs.afterLines'), 0, 3),
      input('includeGlob', t('DeviceDetail.edgeTools.inputs.includeGlob', { glob: '**/*.{log,txt,out,err,json,yml,yaml,properties,conf,xml}' })),
    ],
    execute: args => executeEdge(() => service.systemFileSearch(args)),
  }),
  edgeReadTool({
    id: 'edge_system_file_archive_entries',
    capability: 'edge.file.archive-entries',
    outputName: 'edge-file-archive-entries',
    outputShape: 'edge.file.archive-entries.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.archiveEntries.description',
    helpKey: 'DeviceDetail.edgeTools.archiveEntries.help',
    intents: ['枚举压缩包有限 entry', 'list a bounded archive entry window'],
    notFor: ['extract an entire archive', 'claim an archive population total'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.inputs.archivePath'), 'string', true),
      intInput('maxEntries', t('DeviceDetail.edgeTools.inputs.maxEntries'), 1, 200),
    ],
    execute: args => executeEdge(() => service.systemFileArchiveEntries(args)),
  }),
  edgeReadTool({
    id: 'edge_runtime_logs_summary',
    capability: 'edge.runtime.logs.summary',
    outputName: 'edge-runtime-logs-summary',
    outputShape: 'edge.runtime.logs.summary.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.runtimeLogs.description',
    helpKey: 'DeviceDetail.edgeTools.runtimeLogs.help',
    intents: ['汇总最近边端日志异常样本', 'summarize bounded recent edge logs'],
    notFor: ['claim a log population total'],
    inputs: [
      input('path', t('DeviceDetail.edgeTools.runtimeLogs.inputs.path')),
      input('filter', t('DeviceDetail.edgeTools.runtimeLogs.inputs.filter')),
      input('pattern', t('DeviceDetail.edgeTools.runtimeLogs.inputs.pattern')),
      input('regex', t('DeviceDetail.edgeTools.inputs.regex'), 'boolean'),
      intInput('lines', t('DeviceDetail.edgeTools.runtimeLogs.inputs.lines'), 1, 200),
      intInput('maxFiles', t('DeviceDetail.edgeTools.runtimeLogs.inputs.maxFiles'), 1, 5),
    ],
    execute: args => executeEdge(() => service.runtimeLogsSummary(args)),
  }),
  edgeReadTool({
    id: 'edge_thread_dump_summary',
    capability: 'edge.thread.dump.summary',
    outputName: 'edge-thread-dump-summary',
    outputShape: 'edge.thread.dump.summary.bounded',
    descriptionKey: 'DeviceDetail.edgeTools.threadDump.description',
    helpKey: 'DeviceDetail.edgeTools.threadDump.help',
    intents: ['读取边端线程 dump 有限摘要', 'read a bounded edge thread dump summary'],
    notFor: ['JFR', 'heap dump', 'terminal commands'],
    inputs: [intInput('maxPreviewLength', t('DeviceDetail.edgeTools.threadDump.inputs.maxPreviewLength'), 1000, 12000)],
    execute: args => executeEdge(() => service.threadDumpSummary(args)),
  }),
])
