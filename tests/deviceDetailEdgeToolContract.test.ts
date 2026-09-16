import assert from 'node:assert/strict'
import test from 'node:test'

import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'
import {
  IOT_DEVICE_DETAIL_AGENT_TABS,
  IOT_GATEWAY_DETAIL_AGENT_TABS,
} from '../views/device/list/agent/deviceDetailAgent.constants.ts'
import {
  EDGE_DIAGNOSIS_TOOL_IDS,
  isEdgeDiagnosisAccessProvider,
} from '../views/device/list/agent/deviceDetailEdge.shared.ts'
import { createDeviceDetailEdgeTools } from '../views/device/list/agent/deviceDetailEdge.tools.ts'
import { createDeviceDetailAgentWorkflows } from '../views/device/list/agent/deviceDetailAgent.workflows.ts'

const detailService = new Proxy({}, {
  get: () => async () => ({}),
}) as any

const edgeIds = (tools: readonly { id?: string }[]) => tools
  .map(tool => String(tool.id || ''))
  .filter(id => id.startsWith('edge_'))

test('provider gate mounts the exact edge tool ids only for gateway access providers', () => {
  assert.equal(isEdgeDiagnosisAccessProvider('mqtt'), false)
  assert.equal(isEdgeDiagnosisAccessProvider('agent-device-gateway'), true)
  assert.equal(isEdgeDiagnosisAccessProvider('agent-media-device-gateway'), true)

  assert.deepEqual(edgeIds(createDeviceDetailAgentTools(detailService)), [])
  assert.deepEqual(edgeIds(createDeviceDetailAgentTools(detailService, { accessProvider: 'mqtt' })), [])

  const gatewayTools = createDeviceDetailAgentTools(detailService, {
    accessProvider: 'agent-device-gateway',
  })
  assert.deepEqual(edgeIds(gatewayTools), [...EDGE_DIAGNOSIS_TOOL_IDS])
})

test('edge tools compile defineClientTool READ contracts with owner and capabilities', () => {
  const tools = createDeviceDetailEdgeTools(detailService)

  assert.deepEqual(tools.map(tool => tool.id), [...EDGE_DIAGNOSIS_TOOL_IDS])
  for (const tool of tools) {
    const compiled = tool._meta?.clientToolDefinition
    assert.equal(compiled?.effect, 'READ')
    assert.ok(Number(compiled?.outputCount) > 0)
    assert.equal(tool._meta?.ownerModule, 'iot-ui')
    assert.equal(tool._meta?.capabilityGroup, 'device-detail-edge')
    assert.ok(tool.routing?.capabilities?.length, `${tool.id} missing capabilities`)
    assert.equal(tool.annotations?.readOnlyHint, true)
    assert.doesNotMatch(JSON.stringify(tool.routing || {}), /analyticalCapability/)
  }
})

test('gateway tab enum is distinct from unified device-detail tabs', () => {
  const unified = createDeviceDetailAgentTools(detailService)
  const gateway = createDeviceDetailAgentTools(detailService, { tabSurface: 'gateway' })
  const tabInput = (tools: readonly any[]) => tools
    .find(tool => tool.id === 'device_open_tab')
    ?.inputs
    ?.find((item: any) => item.id === 'tab')
    ?.valueType
    ?.elements
    ?.map((item: any) => item.value)

  assert.deepEqual(tabInput(unified), [...IOT_DEVICE_DETAIL_AGENT_TABS])
  assert.deepEqual(tabInput(gateway), [...IOT_GATEWAY_DETAIL_AGENT_TABS])
  assert.notDeepEqual([...IOT_GATEWAY_DETAIL_AGENT_TABS], [...IOT_DEVICE_DETAIL_AGENT_TABS])
})

test('edge workflow guides are capability evidence, not raw tool-id steps', () => {
  const withoutEdge = createDeviceDetailAgentWorkflows()
  const withEdge = createDeviceDetailAgentWorkflows(true)
  assert.equal(withoutEdge.some(item => item.id?.startsWith('edge-')), false)
  const edgeGuides = withEdge.filter(item => String(item.id || '').startsWith('edge-'))
  assert.ok(edgeGuides.length >= 3)
  assert.ok(edgeGuides.some(item => item.id === 'edge-health-check'))
  assert.ok(edgeGuides.some(item => item.id === 'edge-offline-unstable-diagnosis'))
  assert.ok(edgeGuides.some(item => item.id === 'edge-runtime-log-analysis'))
  assert.ok(edgeGuides.some(item => item.id === 'edge-ai-runtime-diagnosis'))
  for (const guide of edgeGuides) {
    for (const step of guide.steps || []) {
      if (typeof step === 'string') continue
      assert.ok(step.capability, `${guide.id} step missing capability`)
      assert.equal(step.tools, undefined)
    }
  }
})
