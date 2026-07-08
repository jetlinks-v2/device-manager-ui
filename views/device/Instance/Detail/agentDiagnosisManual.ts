import type { AgentConversationWorkflowGuide } from '@jetlinks-ai-agent-ui/components/AgentConversation/types'

type TranslateFn = (key: string, params?: Record<string, any>) => string

export const EDGE_DIAGNOSIS_TOOL_PREFIXES = [
  'edge_runtime_',
  'edge_mbean_',
  'edge_master_',
  'edge_persistence_buffer_',
  'edge_trace_',
  'edge_system_file_',
  'edge_thread_'
]

export const isEdgeDiagnosisToolId = (toolId?: string) => (
  EDGE_DIAGNOSIS_TOOL_PREFIXES.some((prefix) => String(toolId || '').startsWith(prefix))
)

export const createEdgeDiagnosisWorkflowGuides = (t: TranslateFn): AgentConversationWorkflowGuide[] => [
  {
    id: 'edge-health-check',
    name: t('DeviceDetail.edgeGuides.health.name'),
    description: t('DeviceDetail.edgeGuides.health.description'),
    when: [t('DeviceDetail.edgeGuides.health.when.0')],
    scenarios: [t('DeviceDetail.edgeGuides.health.scenarios.0'), t('DeviceDetail.edgeGuides.health.scenarios.1'), t('DeviceDetail.edgeGuides.health.scenarios.2'), t('DeviceDetail.edgeGuides.health.scenarios.3'), t('DeviceDetail.edgeGuides.health.scenarios.4'), t('DeviceDetail.edgeGuides.health.scenarios.5'), t('DeviceDetail.edgeGuides.health.scenarios.6'), t('DeviceDetail.edgeGuides.health.scenarios.7')],
    keywords: [t('DeviceDetail.edgeGuides.common.keywords.edgeGateway'), t('DeviceDetail.edgeGuides.common.keywords.gateway'), t('DeviceDetail.edgeGuides.common.keywords.edgeSide'), t('DeviceDetail.edgeGuides.common.keywords.cloudEdge'), t('DeviceDetail.edgeGuides.common.keywords.diagnosis'), t('DeviceDetail.edgeGuides.common.keywords.analysis'), t('DeviceDetail.edgeGuides.common.keywords.troubleshoot'), t('DeviceDetail.edgeGuides.common.keywords.check'), t('DeviceDetail.edgeGuides.common.keywords.health'), t('DeviceDetail.edgeGuides.common.keywords.stable'), t('DeviceDetail.edgeGuides.health.keywords.operation'), t('DeviceDetail.edgeGuides.health.keywords.fullCheck'), t('DeviceDetail.edgeGuides.health.keywords.normal'), t('DeviceDetail.edgeGuides.common.keywords.exception'), t('DeviceDetail.edgeGuides.common.keywords.fault')],
    priority: 120,
    steps: [
      {
        title: t('DeviceDetail.edgeGuides.health.steps.access.title'),
        tools: ['device_access_summary', 'device_online_offline_summary'],
        inputs: { timeRange: t('DeviceDetail.agentGuides.inputs.recent24h'), type: 'both' },
      },
      {
        title: t('DeviceDetail.edgeGuides.health.steps.runtime.title'),
        tools: ['edge_runtime_summary'],
      },
      {
        title: t('DeviceDetail.edgeGuides.health.steps.cloudEdge.title'),
        tools: ['edge_master_summary', 'edge_persistence_buffer_summary', 'edge_mbean_summary'],
        inputs: { scope: 'all' },
      },
      {
        title: t('DeviceDetail.edgeGuides.health.steps.logs.title'),
        tools: ['edge_runtime_logs_summary'],
        inputs: { filter: 'log', lines: 120 },
      },
    ],
    output: [t('DeviceDetail.edgeGuides.health.output.0'), t('DeviceDetail.edgeGuides.health.output.1'), t('DeviceDetail.edgeGuides.health.output.2'), t('DeviceDetail.edgeGuides.health.output.3'), t('DeviceDetail.edgeGuides.health.output.4')],
    notes: [t('DeviceDetail.edgeGuides.health.notes.0')],
  },
  {
    id: 'edge-offline-unstable-diagnosis',
    name: t('DeviceDetail.edgeGuides.offline.name'),
    description: t('DeviceDetail.edgeGuides.offline.description'),
    when: [t('DeviceDetail.edgeGuides.offline.when.0')],
    scenarios: [t('DeviceDetail.edgeGuides.offline.scenarios.0'), t('DeviceDetail.edgeGuides.offline.scenarios.1'), t('DeviceDetail.edgeGuides.offline.scenarios.2'), t('DeviceDetail.edgeGuides.offline.scenarios.3'), t('DeviceDetail.edgeGuides.offline.scenarios.4'), t('DeviceDetail.edgeGuides.offline.scenarios.5'), t('DeviceDetail.edgeGuides.offline.scenarios.6'), t('DeviceDetail.edgeGuides.offline.scenarios.7'), t('DeviceDetail.edgeGuides.offline.scenarios.8'), t('DeviceDetail.edgeGuides.offline.scenarios.9')],
    keywords: [t('DeviceDetail.edgeGuides.offline.keywords.0'), t('DeviceDetail.edgeGuides.offline.keywords.1'), t('DeviceDetail.edgeGuides.offline.keywords.2'), t('DeviceDetail.edgeGuides.offline.keywords.3'), t('DeviceDetail.edgeGuides.offline.keywords.4'), t('DeviceDetail.edgeGuides.offline.keywords.5'), t('DeviceDetail.edgeGuides.offline.keywords.6'), t('DeviceDetail.edgeGuides.offline.keywords.7'), t('DeviceDetail.edgeGuides.offline.keywords.8'), t('DeviceDetail.edgeGuides.offline.keywords.9'), t('DeviceDetail.edgeGuides.offline.keywords.10'), 'refused', 'disconnect'],
    priority: 118,
    steps: [
      {
        title: t('DeviceDetail.edgeGuides.offline.steps.onlineOffline.title'),
        tools: ['device_online_offline_summary'],
        inputs: { timeRange: t('DeviceDetail.agentGuides.inputs.recent24h'), type: 'both' },
      },
      {
        title: t('DeviceDetail.edgeGuides.offline.steps.access.title'),
        tools: ['device_access_summary'],
      },
      {
        title: t('DeviceDetail.edgeGuides.offline.steps.master.title'),
        tools: ['edge_master_summary'],
      },
      {
        title: t('DeviceDetail.edgeGuides.offline.steps.network.title'),
        tools: ['edge_mbean_summary', 'edge_trace_summary'],
        inputs: { scope: 'network,session,trace' },
      },
      {
        title: t('DeviceDetail.edgeGuides.offline.steps.logs.title'),
        tools: ['edge_runtime_logs_summary', 'edge_system_file_search'],
        inputs: { pattern: t('DeviceDetail.edgeGuides.inputs.errorPattern') },
      },
    ],
    output: [t('DeviceDetail.edgeGuides.offline.output.0'), t('DeviceDetail.edgeGuides.offline.output.1'), t('DeviceDetail.edgeGuides.offline.output.2'), t('DeviceDetail.edgeGuides.offline.output.3')],
  },
  {
    id: 'edge-buffer-backlog-diagnosis',
    name: t('DeviceDetail.edgeGuides.backlog.name'),
    description: t('DeviceDetail.edgeGuides.backlog.description'),
    when: [t('DeviceDetail.edgeGuides.backlog.when.0')],
    scenarios: [t('DeviceDetail.edgeGuides.backlog.scenarios.0'), t('DeviceDetail.edgeGuides.backlog.scenarios.1'), t('DeviceDetail.edgeGuides.backlog.scenarios.2'), t('DeviceDetail.edgeGuides.backlog.scenarios.3'), t('DeviceDetail.edgeGuides.backlog.scenarios.4'), t('DeviceDetail.edgeGuides.backlog.scenarios.5'), t('DeviceDetail.edgeGuides.backlog.scenarios.6'), t('DeviceDetail.edgeGuides.backlog.scenarios.7'), t('DeviceDetail.edgeGuides.backlog.scenarios.8'), t('DeviceDetail.edgeGuides.backlog.scenarios.9')],
    keywords: [t('DeviceDetail.edgeGuides.backlog.keywords.0'), t('DeviceDetail.edgeGuides.backlog.keywords.1'), t('DeviceDetail.edgeGuides.backlog.keywords.2'), t('DeviceDetail.edgeGuides.backlog.keywords.3'), t('DeviceDetail.edgeGuides.backlog.keywords.4'), t('DeviceDetail.edgeGuides.backlog.keywords.5'), 'buffer', t('DeviceDetail.edgeGuides.backlog.keywords.6'), t('DeviceDetail.edgeGuides.backlog.keywords.7'), t('DeviceDetail.edgeGuides.backlog.keywords.8'), t('DeviceDetail.edgeGuides.backlog.keywords.9'), 'delay', 'backlog'],
    priority: 116,
    steps: [
      {
        title: t('DeviceDetail.edgeGuides.backlog.steps.buffer.title'),
        tools: ['edge_persistence_buffer_summary'],
      },
      {
        title: t('DeviceDetail.edgeGuides.backlog.steps.eventbus.title'),
        tools: ['edge_mbean_summary'],
        inputs: { scope: 'eventbus,session' },
      },
      {
        title: t('DeviceDetail.edgeGuides.backlog.steps.platformEvidence.title'),
        tools: ['device_logs_summary', 'device_event_history_query', 'device_property_history_summary'],
        inputs: { timeRange: t('DeviceDetail.agentGuides.inputs.recent24h') },
      },
      {
        title: t('DeviceDetail.edgeGuides.backlog.steps.traceLogs.title'),
        tools: ['edge_trace_summary', 'edge_runtime_logs_summary'],
      },
    ],
    output: [t('DeviceDetail.edgeGuides.backlog.output.0'), t('DeviceDetail.edgeGuides.backlog.output.1'), t('DeviceDetail.edgeGuides.backlog.output.2'), t('DeviceDetail.edgeGuides.backlog.output.3'), t('DeviceDetail.edgeGuides.backlog.output.4')],
    notes: [t('DeviceDetail.edgeGuides.backlog.notes.0')],
  },
  {
    id: 'edge-runtime-log-analysis',
    name: t('DeviceDetail.edgeGuides.logs.name'),
    description: t('DeviceDetail.edgeGuides.logs.description'),
    when: [t('DeviceDetail.edgeGuides.logs.when.0')],
    scenarios: [t('DeviceDetail.edgeGuides.logs.scenarios.0'), t('DeviceDetail.edgeGuides.logs.scenarios.1'), t('DeviceDetail.edgeGuides.logs.scenarios.2'), t('DeviceDetail.edgeGuides.logs.scenarios.3'), t('DeviceDetail.edgeGuides.logs.scenarios.4'), t('DeviceDetail.edgeGuides.logs.scenarios.5'), t('DeviceDetail.edgeGuides.logs.scenarios.6')],
    keywords: [t('DeviceDetail.edgeGuides.logs.keywords.0'), 'log', 'error', 'exception', t('DeviceDetail.edgeGuides.common.keywords.exception'), t('DeviceDetail.edgeGuides.logs.keywords.1'), t('DeviceDetail.edgeGuides.logs.keywords.2'), t('DeviceDetail.edgeGuides.logs.keywords.3'), t('DeviceDetail.edgeGuides.logs.keywords.4'), 'tail', 'search'],
    priority: 114,
    steps: [
      {
        title: t('DeviceDetail.edgeGuides.logs.steps.workdir.title'),
        tools: ['edge_system_file_workdir', 'edge_system_file_list'],
        inputs: { filter: 'log' },
      },
      {
        title: t('DeviceDetail.edgeGuides.logs.steps.stat.title'),
        tools: ['edge_system_file_stat'],
      },
      {
        title: t('DeviceDetail.edgeGuides.logs.steps.tailSearch.title'),
        tools: ['edge_system_file_tail', 'edge_system_file_head', 'edge_system_file_search'],
        inputs: { lines: 120 },
      },
      {
        title: t('DeviceDetail.edgeGuides.logs.steps.continue.title'),
        tools: ['edge_system_file_read_text', 'edge_system_file_archive_entries'],
      },
    ],
    output: [t('DeviceDetail.edgeGuides.logs.output.0'), t('DeviceDetail.edgeGuides.logs.output.1'), t('DeviceDetail.edgeGuides.logs.output.2'), t('DeviceDetail.edgeGuides.logs.output.3'), t('DeviceDetail.edgeGuides.logs.output.4')],
    notes: [t('DeviceDetail.edgeGuides.logs.notes.0')],
  },
  {
    id: 'edge-jvm-readonly-diagnosis',
    name: t('DeviceDetail.edgeGuides.jvm.name'),
    description: t('DeviceDetail.edgeGuides.jvm.description'),
    when: [t('DeviceDetail.edgeGuides.jvm.when.0')],
    scenarios: [t('DeviceDetail.edgeGuides.jvm.scenarios.0'), t('DeviceDetail.edgeGuides.jvm.scenarios.1'), t('DeviceDetail.edgeGuides.jvm.scenarios.2'), t('DeviceDetail.edgeGuides.jvm.scenarios.3'), t('DeviceDetail.edgeGuides.jvm.scenarios.4'), t('DeviceDetail.edgeGuides.jvm.scenarios.5'), t('DeviceDetail.edgeGuides.jvm.scenarios.6'), t('DeviceDetail.edgeGuides.jvm.scenarios.7')],
    keywords: ['CPU', t('DeviceDetail.edgeGuides.jvm.keywords.thread'), 'JVM', t('DeviceDetail.edgeGuides.jvm.keywords.memory'), t('DeviceDetail.edgeGuides.jvm.keywords.stuck'), t('DeviceDetail.edgeGuides.jvm.keywords.laggy'), t('DeviceDetail.edgeGuides.jvm.keywords.blocked'), 'GC', 'heap', 'thread'],
    priority: 90,
    steps: [
      {
        title: t('DeviceDetail.edgeGuides.jvm.steps.runtime.title'),
        tools: ['edge_runtime_summary', 'edge_mbean_summary'],
        inputs: { scope: 'jvm' },
      },
      {
        title: t('DeviceDetail.edgeGuides.jvm.steps.threadDump.title'),
        tools: ['edge_thread_dump_summary'],
        tips: [t('DeviceDetail.edgeGuides.jvm.steps.threadDump.tips.0')],
      },
      {
        title: t('DeviceDetail.edgeGuides.jvm.steps.risk.title'),
        description: t('DeviceDetail.edgeGuides.jvm.steps.risk.description'),
      },
    ],
    output: [t('DeviceDetail.edgeGuides.jvm.output.0'), t('DeviceDetail.edgeGuides.jvm.output.1'), t('DeviceDetail.edgeGuides.jvm.output.2'), t('DeviceDetail.edgeGuides.jvm.output.3')],
  },
]

export const buildEdgeDiagnosisClientToolsDescription = (supported: boolean, t: TranslateFn) => {
  if (!supported) {
    return t('DeviceDetail.edgeTools.description.unsupported')
  }
  return [
    t('DeviceDetail.edgeTools.description.supported.0'),
    t('DeviceDetail.edgeTools.description.supported.1'),
    t('DeviceDetail.edgeTools.description.supported.2')
  ].join('\n')
}
