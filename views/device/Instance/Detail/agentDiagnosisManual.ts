import type { AgentConversationWorkflowGuide } from '@jetlinks-ai-agent-ui/components/AgentConversation/types'

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

export const EDGE_DIAGNOSIS_WORKFLOW_GUIDES: AgentConversationWorkflowGuide[] = [
  {
    id: 'edge-health-check',
    name: '云边协同健康检查',
    description: '检查边缘网关运行稳定性、云边连接、边端 JVM、消息缓冲和最近日志异常。',
    when: ['当前设备是边缘网关，且用户提出宽泛诊断、分析、健康、稳定性、是否正常或全面检查类需求。'],
    scenarios: ['检查边缘网关健康情况', '运行是否稳定', '全面检查', '帮我看看', '是否正常', '健康检查', '边端健康', '云边协同状态'],
    keywords: ['边缘网关', '网关', '边端', '云边', '诊断', '分析', '排查', '检查', '健康', '稳定', '运行情况', '全面检查', '正常', '异常', '故障'],
    priority: 120,
    steps: [
      {
        title: '确认设备状态和接入证据',
        tools: ['device_access_summary', 'device_online_offline_summary'],
        inputs: { timeRange: '最近24小时', type: 'both' },
      },
      {
        title: '读取边端系统运行摘要',
        tools: ['edge_runtime_summary'],
      },
      {
        title: '检查云边连接和关键运行指标摘要',
        tools: ['edge_master_summary', 'edge_persistence_buffer_summary', 'edge_mbean_summary'],
        inputs: { scope: 'all' },
      },
      {
        title: '补充最近边端日志异常',
        tools: ['edge_runtime_logs_summary'],
        inputs: { filter: 'log', lines: 120 },
      },
    ],
    output: ['结论', '证据摘要', '可能原因', '建议动作', '限制'],
    notes: ['不要输出内部监控链接或内部指标名称；普通设备不使用边端工具。'],
  },
  {
    id: 'edge-offline-unstable-diagnosis',
    name: '边缘网关离线/不稳定排查',
    description: '排查边缘网关离线、频繁上下线、云边连接抖动、认证或网络异常。',
    when: ['当前设备是边缘网关，且用户提出离线、频繁掉线、连接不稳、认证失败、平台连不上边端等问题。'],
    scenarios: ['边缘网关离线', '为什么离线', '频繁上下线', '频繁掉线', '上线后又掉', '连接抖动', '连接不稳', '云边连接失败', '平台连不上边端', '边端不稳定'],
    keywords: ['离线', '下线', '掉线', '上下线', '抖动', '重连', '连接失败', '连接不稳', '认证失败', '断开', '超时', 'refused', 'disconnect'],
    priority: 118,
    steps: [
      {
        title: '统计平台侧上下线',
        tools: ['device_online_offline_summary'],
        inputs: { timeRange: '最近24小时', type: 'both' },
      },
      {
        title: '查看接入配置和会话',
        tools: ['device_access_summary'],
      },
      {
        title: '检查 master 连接摘要',
        tools: ['edge_master_summary'],
      },
      {
        title: '读取网络、会话和链路摘要',
        tools: ['edge_mbean_summary', 'edge_trace_summary'],
        inputs: { scope: 'network,session,trace' },
      },
      {
        title: '搜索最近边端日志错误',
        tools: ['edge_runtime_logs_summary', 'edge_system_file_search'],
        inputs: { pattern: 'error|exception|failed|timeout|refused|disconnect|denied|认证|失败|超时|断开' },
      },
    ],
    output: ['最可能原因', '已验证证据', '现场待确认项', '下一步处理动作'],
  },
  {
    id: 'edge-buffer-backlog-diagnosis',
    name: '边端消息积压/丢失排查',
    description: '定位边端上行消息积压、平台接收延迟、缓冲死信或链路异常。',
    when: ['当前设备是边缘网关，且用户提出消息积压、平台收不到数据、上报慢、数据延迟、丢失或死信等问题。'],
    scenarios: ['消息积压', '数据延迟', '上报丢失', '平台收不到数据', '平台没有数据', '上报慢', '消息堆积', 'buffer 异常', '队列异常', '死信'],
    keywords: ['积压', '堆积', '延迟', '丢失', '收不到', '没有数据', 'buffer', '队列', '死信', '上报', '消息', 'delay', 'backlog'],
    priority: 116,
    steps: [
      {
        title: '读取缓冲区只读指标',
        tools: ['edge_persistence_buffer_summary'],
      },
      {
        title: '查看 EventBus 和设备会话摘要',
        tools: ['edge_mbean_summary'],
        inputs: { scope: 'eventbus,session' },
      },
      {
        title: '结合平台日志、事件和属性时间线',
        tools: ['device_logs_summary', 'device_event_history_query', 'device_property_history_summary'],
        inputs: { timeRange: '最近24小时' },
      },
      {
        title: '补充链路样本和边端错误日志',
        tools: ['edge_trace_summary', 'edge_runtime_logs_summary'],
      },
    ],
    output: ['积压位置', '影响范围', '证据摘要', '低风险建议', '需人工确认的动作'],
    notes: ['不要自动执行 flush、retryDead、recovery 或 peekDead。'],
  },
  {
    id: 'edge-runtime-log-analysis',
    name: '边端日志分析',
    description: '读取边端日志片段，搜索错误关键词，必要时枚举压缩包条目继续分析。',
    when: ['当前设备是边缘网关，且用户要求查看日志、搜索错误、分析最近异常、启动失败或压缩日志线索。'],
    scenarios: ['读取边端日志', '看一下边端日志错误', '分析网关日志', '搜索日志异常', '查看最近异常', '启动失败', '日志压缩包'],
    keywords: ['日志', 'log', 'error', 'exception', '异常', '错误', '失败', '启动失败', '压缩包', 'tail', 'search'],
    priority: 114,
    steps: [
      {
        title: '确认工作目录和候选日志文件',
        tools: ['edge_system_file_workdir', 'edge_system_file_list'],
        inputs: { filter: 'log' },
      },
      {
        title: '读取文件状态',
        tools: ['edge_system_file_stat'],
      },
      {
        title: '优先读取尾部并搜索错误',
        tools: ['edge_system_file_tail', 'edge_system_file_head', 'edge_system_file_search'],
        inputs: { lines: 120 },
      },
      {
        title: '按需继续读取文本区间或压缩包 entry',
        tools: ['edge_system_file_read_text', 'edge_system_file_archive_entries'],
      },
    ],
    output: ['错误摘要', '相关时间', '样本范围', '建议动作', '无法确认项'],
    notes: ['不要下载整文件；返回受上限截断时说明样本范围。'],
  },
  {
    id: 'edge-jvm-readonly-diagnosis',
    name: '深度 JVM 只读诊断',
    description: '针对 CPU 高、线程异常、内存异常进行只读摘要排查；重操作只提示人工确认。',
    when: ['当前设备是边缘网关，且用户提出 CPU、内存、线程、GC、阻塞或边端卡顿等运行时问题。'],
    scenarios: ['CPU 高', '内存高', '线程卡住', '线程阻塞', 'JVM 异常', '内存异常', 'GC 异常', '边端很卡'],
    keywords: ['CPU', '线程', 'JVM', '内存', '卡住', '卡顿', '阻塞', 'GC', 'heap', 'thread'],
    priority: 90,
    steps: [
      {
        title: '读取系统、线程和内存摘要',
        tools: ['edge_runtime_summary', 'edge_mbean_summary'],
        inputs: { scope: 'jvm' },
      },
      {
        title: '必要时读取受限线程摘要',
        tools: ['edge_thread_dump_summary'],
        tips: ['只返回摘要，不下载原始 dump。'],
      },
      {
        title: '高风险动作收口为人工建议',
        description: 'JFR、heap dump、网络抓包和终端命令不自动执行。',
      },
    ],
    output: ['只读判断', '异常迹象', '建议动作', '需人工介入项'],
  },
]

export const buildEdgeDiagnosisClientToolsDescription = (supported: boolean) => {
  if (!supported) {
    return '当前设备未提供云边协同诊断工具。'
  }
  return [
    '当前设备提供云边协同只读诊断工具，可读取边端运行摘要、云边连接、消息缓冲、链路摘要、线程摘要和有限日志/文件片段。',
    '工具结果只包含摘要、有限样本、截断原因和下一步读取线索；文件类能力面向日志或配置片段，不用于默认全量下载。',
    '写入、删除、上传、终端命令、JFR、heap dump、边端网络抓包、内部链路开关、消息缓冲修复动作和会话移除不是自动工具。'
  ].join('\n')
}
