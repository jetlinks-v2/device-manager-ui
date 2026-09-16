import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readRelative = path => readFile(new URL(path, import.meta.url), 'utf8')

const EXPECTED_EDGE_TOOL_IDS = [
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
]

const UNIFIED_TABS = ['overview', 'access', 'commands', 'data', 'alarm', 'logs']
const GATEWAY_TABS = [
  'runtime',
  'access',
  'thing-model',
  'commands',
  'data',
  'messages',
  'remote',
  'firmwareTasks',
  'subDevices',
]

test('edge diagnosis tools keep the 2.12 ids, defineClientTool READ contract, and provider gate', async () => {
  const shared = await readRelative('../views/device/list/agent/deviceDetailEdge.shared.ts')
  const tools = await readRelative('../views/device/list/agent/deviceDetailEdge.tools.ts')
  const factory = await readRelative('../views/device/list/agent/deviceDetailAgent.tools.ts')
  const hook = await readRelative('../views/device/list/agent/useDeviceDetailAgent.ts')
  const instanceTools = await readRelative('../views/device/Instance/Detail/clientTools.ts')
  const instanceDetail = await readRelative('../views/device/Instance/Detail/useDeviceInstanceDetail.ts')
  const legacy = await readRelative('../views/device/Instance/Detail/edgeDiagnosisTool.ts')
  const instanceManual = await readRelative('../views/device/Instance/Detail/agentDiagnosisManual.ts')

  const uniqueDeclared = [...new Set(shared.match(/EDGE_DIAGNOSIS_TOOL_IDS = \[([\s\S]*?)\] as const/)?.[1]
    .match(/'edge_[a-z0-9_]+'/g)
    .map(item => item.slice(1, -1)))]
  assert.deepEqual(uniqueDeclared, EXPECTED_EDGE_TOOL_IDS)

  for (const id of EXPECTED_EDGE_TOOL_IDS) {
    assert.match(tools, new RegExp(`id: '${id}'`))
  }
  assert.match(tools, /defineClientTool/)
  assert.match(tools, /effect: \{ kind: 'READ' \}/)
  assert.match(tools, /module: 'iot-ui'/)
  assert.match(tools, /group: 'device-detail-edge'/)
  assert.match(tools, /capabilities: \[options\.capability\]/)
  assert.doesNotMatch(tools, /defineClientToolAnalyticalProducer/)
  assert.doesNotMatch(tools, /edge_remote_file_/)

  assert.match(factory, /isEdgeDiagnosisAccessProvider\(options\?\.accessProvider\)/)
  assert.match(factory, /createDeviceDetailEdgeTools\(service\)/)
  assert.match(hook, /tabSurface: surface/)
  assert.match(hook, /IOT_GATEWAY_DETAIL_AGENT_ROUTE_NAME/)
  assert.match(hook, /surface === 'gateway'/)
  assert.match(hook, /router\.replace\(\{ query: \{ \.\.\.route\.query, tab \} \}\)/)
  assert.match(hook, /createDeviceDetailAgentWorkflows\(includeEdge\)/)

  assert.match(instanceTools, /createDeviceDetailEdgeTools\(createDeviceDetailEdgeService\(\(\) => getDevice\(\)\)\)/)
  assert.doesNotMatch(instanceTools, /createEdgeDiagnosisClientTools/)
  assert.match(instanceDetail, /!toolId\.startsWith\('edge_remote_file_'\)/)
  assert.match(legacy, /export \{\s*EDGE_DIAGNOSIS_ACCESS_PROVIDERS,\s*isEdgeDiagnosisAccessProvider,/s)
  assert.match(legacy, /isEdgeDiagnosisToolId/)
  assert.doesNotMatch(legacy, /createEdgeDiagnosisClientTools/)
  assert.doesNotMatch(legacy, /queryRemoteSystemMonitorMBean/)
  assert.match(instanceManual, /isEdgeDiagnosisToolId/)
  assert.match(instanceManual, /edge_ai_runtime_summary/)
  assert.match(instanceManual, /edge-ai-runtime-diagnosis/)
  assert.doesNotMatch(instanceManual, /EDGE_DIAGNOSIS_TOOL_PREFIXES/)
})

test('gateway tab enum stays separate from unified device-detail tabs', async () => {
  const constants = await readRelative('../views/device/list/agent/deviceDetailAgent.constants.ts')
  const hook = await readRelative('../views/device/list/agent/useDeviceDetailAgent.ts')
  const zh = JSON.parse(await readRelative('../locales/lang/zh.json'))
  const en = JSON.parse(await readRelative('../locales/lang/en.json'))

  const readArray = (name) => constants
    .match(new RegExp(`${name} = \\[([\\s\\S]*?)\\] as const`))[1]
    .match(/'[^']+'/g)
    .map(item => item.slice(1, -1))

  assert.deepEqual(readArray('IOT_DEVICE_DETAIL_AGENT_TABS'), UNIFIED_TABS)
  assert.deepEqual(readArray('IOT_GATEWAY_DETAIL_AGENT_TABS'), GATEWAY_TABS)
  assert.match(constants, /IOT_GATEWAY_DETAIL_AGENT_ROUTE_NAME = 'iot-user\/edge-gateway\/Detail'/)
  assert.match(hook, /resolveDeviceDetailAgentTabs\(surface\)/)
  assert.match(hook, /defaultTab: resolveDeviceDetailAgentDefaultTab\(surface\)/)

  for (const tab of [...UNIFIED_TABS, ...GATEWAY_TABS]) {
    assert.equal(typeof zh[`IotDeviceDetailAgent.tabs.${tab}`], 'string')
    assert.equal(typeof en[`IotDeviceDetailAgent.tabs.${tab}`], 'string')
  }
})

test('bounded file search dump evidence never claims a population total', async () => {
  const service = await readRelative('../views/device/list/agent/deviceDetailEdge.service.ts')
  const tools = await readRelative('../views/device/list/agent/deviceDetailEdge.tools.ts')

  assert.match(service, /exhaustive: false as const/)
  assert.match(service, /populationCountSupported: false as const/)
  assert.match(service, /createDomainAgentPreviewCardinality\(\{ displayedCount: window\.returnedCount \}\)/)
  assert.match(service, /truncated: true,/)
  assert.match(service, /requestSatisfied: false/)
  assert.match(service, /evidenceCoverage: 'bounded-query'/)
  assert.doesNotMatch(service, /createDomainAgentRecordSetCardinality/)
  assert.doesNotMatch(service, /totalCount:/)
  assert.doesNotMatch(service, /\btotal:/)
  assert.doesNotMatch(tools, /defineClientToolAnalyticalProducer/)
  assert.match(tools, /claim a directory population total/)
  assert.match(tools, /claim a search population total/)
  assert.match(tools, /claim a log population total/)
})

test('AI runtime summary keeps compact MonitorMetric scopes and locale JSON', async () => {
  const shared = await readRelative('../views/device/list/agent/deviceDetailEdge.shared.ts')
  const tools = await readRelative('../views/device/list/agent/deviceDetailEdge.tools.ts')
  const service = await readRelative('../views/device/list/agent/deviceDetailEdge.service.ts')
  const summary = await readRelative('../views/device/list/agent/deviceDetailEdgeAi.summary.ts')
  const workflows = await readRelative('../views/device/list/agent/deviceDetailAgent.workflows.ts')
  const zh = JSON.parse(await readRelative('../locales/lang/zh.json'))
  const en = JSON.parse(await readRelative('../locales/lang/en.json'))

  assert.match(shared, /isEdgeDiagnosisToolId/)
  assert.match(shared, /edge_ai_runtime_summary/)
  assert.match(tools, /id: 'edge_ai_runtime_summary'/)
  assert.match(tools, /edge\.ai\.runtime\.summary\.read/)
  assert.match(tools, /dump full tasks or samples/)
  assert.match(service, /aiRuntimeSummary/)
  assert.match(service, /'ai\.review'/)
  assert.match(service, /'ai\.cv'/)
  assert.match(service, /compactMBeanAttributes/)
  assert.match(service, /ensureSupported\(\)/)
  assert.match(summary, /compactReviewMetrics/)
  assert.match(summary, /compactCvMetrics/)
  assert.match(summary, /classpath/i)
  assert.match(summary, /systemproperties/i)
  assert.match(summary, /inputarguments/i)
  assert.match(workflows, /edge-ai-runtime-diagnosis/)
  assert.match(workflows, /edge\.ai\.runtime\.summary\.read/)
  assert.equal(typeof zh['DeviceDetail.edgeTools.aiRuntime.description'], 'string')
  assert.equal(typeof en['DeviceDetail.edgeTools.aiRuntime.description'], 'string')
  assert.equal(typeof zh['DeviceDetail.edgeGuides.ai.name'], 'string')
  assert.equal(typeof en['DeviceDetail.edgeGuides.ai.name'], 'string')
})

test('non-gateway execute rejects before remote system APIs', async () => {
  const service = await readRelative('../views/device/list/agent/deviceDetailEdge.service.ts')
  const ensure = service.match(/const ensureSupported = \(\) => \{[\s\S]*?\n  \}/)[0]
  assert.match(ensure, /isEdgeDiagnosisAccessProvider\(accessProvider\)/)
  assert.doesNotMatch(ensure, /queryRemoteSystem|getRemoteSystem|listRemoteSystem|dumpRemoteSystem/)

  const methods = [
    'runtimeSummary',
    'mbeanSummary',
    'aiRuntimeSummary',
    'masterSummary',
    'persistenceBufferSummary',
    'traceSummary',
    'systemFileWorkdir',
    'systemFileList',
    'systemFileStat',
    'systemFileTail',
    'systemFileHead',
    'systemFileReadText',
    'systemFileSearch',
    'systemFileArchiveEntries',
    'runtimeLogsSummary',
    'threadDumpSummary',
  ]
  for (const name of methods) {
    const block = service.match(new RegExp(`const ${name} = async[\\s\\S]*?\\n  \\}`))?.[0]
    assert.ok(block, `missing ${name}`)
    const apiIndex = block.search(/queryRemoteSystem|getRemoteSystem|listRemoteSystem|dumpRemoteSystem|executeFileCommand|getMBeanSections/)
    const pathIndex = block.search(/requirePath\(/)
    const gateIndex = block.search(/ensureSupported\(|executeFileCommand\(/)
    assert.ok(gateIndex >= 0, `${name} must re-check the page subject`)
    if (apiIndex >= 0) assert.ok(gateIndex <= apiIndex, `${name} must gate before remote APIs`)
    if (pathIndex >= 0) assert.ok(gateIndex <= pathIndex, `${name} must gate before path parsing`)
  }
})
