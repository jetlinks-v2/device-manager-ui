export const EDGE_DIAGNOSIS_ACCESS_PROVIDERS = new Set([
  'agent-device-gateway',
  'agent-media-device-gateway',
])

export const isEdgeDiagnosisAccessProvider = (accessProvider?: unknown) => (
  EDGE_DIAGNOSIS_ACCESS_PROVIDERS.has(String(accessProvider || ''))
)

export const EDGE_DIAGNOSIS_TOOL_IDS = [
  'edge_runtime_summary',
  'edge_mbean_summary',
  'edge_ai_runtime_summary',
  'edge_master_summary',
  'edge_persistence_buffer_summary',
  'edge_trace_summary',
  'edge_system_file_workdir',
  'edge_system_file_list',
  'edge_system_file_stat',
  'edge_system_file_tail',
  'edge_system_file_head',
  'edge_system_file_read_text',
  'edge_system_file_search',
  'edge_system_file_archive_entries',
  'edge_runtime_logs_summary',
  'edge_thread_dump_summary',
] as const

export const isEdgeDiagnosisToolId = (toolId?: string) => (
  (EDGE_DIAGNOSIS_TOOL_IDS as readonly string[]).includes(String(toolId || ''))
)
