import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  mapModelProperty,
  mapModelPropertyAccess,
  normalizePropertyAccessTypes,
} from '../agentCapabilities/deviceAnalysis/deviceModel.service.ts'
import { createDeviceDetailAlarmService } from '../views/device/list/agent/deviceDetailAlarm.service.ts'
import { createDeviceDetailCommandService } from '../views/device/list/agent/deviceDetailCommand.service.ts'
import { createAiClientToolRuntime } from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'
import { createDeviceDetailAgentWorkflows } from '../views/device/list/agent/deviceDetailAgent.workflows.ts'
import { createDeviceDetailDiagnosticsService } from '../views/device/list/agent/deviceDetailDiagnostics.service.ts'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service.ts'

const ACTION_IDS = [
  'device_function_invoke',
  'device_property_read',
  'device_property_write',
  'device_alarm_handle',
] as const

const CONFIRMED_IDS = [
  'device_function_invoke',
  'device_property_write',
  'device_alarm_handle',
] as const

const fixtureMetadata = {
  properties: [
    { id: 'reported', name: 'Reported', expands: { type: 'report' }, valueType: { type: 'int' } },
    { id: 'readable', name: 'Readable', expands: { type: 'read' }, valueType: { type: 'int', min: 0, max: 10 } },
    {
      id: 'writable',
      name: 'Writable',
      expands: { type: ['read', 'write'] },
      valueType: { type: 'enum', elements: [{ value: 'on', text: 'On' }, { value: 'off', text: 'Off' }] },
    },
    { id: 'empty-access', name: 'Empty', expands: { type: '' }, valueType: { type: 'string' } },
    { id: 'comma-access', name: 'Comma', expands: { type: 'read,write' }, valueType: { type: 'boolean' } },
  ],
  functions: [
    { id: 'ping', name: 'Ping', inputs: [] },
    {
      id: 'set-mode',
      name: 'Set Mode',
      inputs: [{ id: 'mode', name: 'Mode', expands: { required: true }, valueType: { type: 'string' } }],
    },
    { id: 'alpha-one', name: 'Alpha One', inputs: [] },
    { id: 'alpha-two', name: 'Alpha Two', inputs: [] },
  ],
  events: [],
  tags: [],
}

const fixtureDevice = {
  id: 'device-1',
  name: 'Fixture Device',
  projectId: 'project-1',
  thingModelMetadata: fixtureMetadata,
} as any

const detailService = new Proxy({}, { get: () => async () => ({}) }) as any
const call = (toolName: string) => ({ id: `${toolName}-call`, toolName })

const commandService = () => {
  const created = {
    ...createDeviceDetailCommandService(fixtureDevice),
    ...createDeviceDetailAlarmService(fixtureDevice),
  }
  return new Proxy(created, {
    get: (target, prop) => {
      const value = Reflect.get(target, prop)
      return value === undefined ? async () => ({}) : value
    },
  }) as any
}

test('property access follows expands.type array, comma string, and empty type', () => {
  assert.deepEqual(normalizePropertyAccessTypes('read, write'), ['read', 'write'])
  assert.deepEqual(normalizePropertyAccessTypes(['report', 'read']), ['report', 'read'])
  assert.deepEqual(normalizePropertyAccessTypes(''), [])
  assert.deepEqual(mapModelPropertyAccess({ expands: { type: '' } }), {
    reportable: true,
    deviceReadable: false,
    deviceWritable: false,
  })
  assert.deepEqual(mapModelPropertyAccess({ expands: { type: 'report' } }), {
    reportable: true,
    deviceReadable: false,
    deviceWritable: false,
  })
  assert.deepEqual(mapModelPropertyAccess({ expands: { type: 'read' } }), {
    reportable: false,
    deviceReadable: true,
    deviceWritable: false,
  })
  assert.deepEqual(mapModelPropertyAccess({ expands: { type: ['read', 'write'] } }), {
    reportable: false,
    deviceReadable: true,
    deviceWritable: true,
  })
  assert.deepEqual(mapModelPropertyAccess({ expands: { type: 'read,write' } }), {
    reportable: false,
    deviceReadable: true,
    deviceWritable: true,
  })
  assert.equal(mapModelProperty({ id: 'reported', expands: { type: 'report' }, readOnly: false }).access.deviceWritable, false)
})

test('model search candidates expose the same property access projection', async () => {
  const result = await createDeviceDetailDiagnosticsService(fixtureDevice).modelSearch({}) as any
  const byId = Object.fromEntries((result.data || []).map((item: any) => [item.id, item.access]))
  assert.deepEqual(byId.reported, { reportable: true, deviceReadable: false, deviceWritable: false })
  assert.deepEqual(byId.writable, { reportable: false, deviceReadable: true, deviceWritable: true })
  assert.deepEqual(byId['empty-access'], { reportable: true, deviceReadable: false, deviceWritable: false })
})

test('query tools stay read-only while the four action tools are EXTERNAL_ACTION', () => {
  const tools = createDeviceDetailAgentTools(detailService)
  const byId = Object.fromEntries(tools.map(tool => [tool.id, tool]))
  for (const id of ACTION_IDS) {
    assert.ok(byId[id], `${id} missing from catalog`)
    assert.equal(byId[id]._meta?.clientToolDefinition?.effect, 'EXTERNAL_ACTION')
    assert.equal(byId[id].annotations?.readOnlyHint, false)
    assert.equal(byId[id].risk?.readOnly, false)
    assert.equal(byId[id].risk?.parallelSafe, false)
    assert.equal((byId[id].inputs || []).some((item: any) => item.id === 'deviceId'), false)
  }
  for (const id of CONFIRMED_IDS) {
    assert.equal(typeof byId[id].prepare, 'function', `${id} missing prepare`)
    assert.ok(byId[id].confirm, `${id} missing confirmation`)
    assert.equal(byId[id].confirm?.localConfirmation, true)
    assert.equal(byId[id].risk?.needsApproval, false)
  }
  assert.equal(byId.device_property_read.prepare, undefined)
  assert.equal(byId.device_property_read.confirm, undefined)
  assert.equal(byId.device_property_read.risk?.needsApproval, false)
  const runtime = createAiClientToolRuntime(tools, {
    includeHelpTool: false,
    toolsName: 'device-detail-tools',
    toolsDescription: 'test',
    riskDefaults: {
      readOnly: true,
      parallelSafe: true,
      needsApproval: false,
    },
  })
  const published = Object.fromEntries(runtime.clientTools.map(tool => [tool.id, tool]))
  for (const id of CONFIRMED_IDS) {
    assert.equal(published[id].expands?.needsApproval, false, `${id} published needsApproval`)
    assert.equal(published[id].annotations?.destructiveHint, true, `${id} should stay destructive`)
    assert.equal(published[id].confirm, undefined, `${id} must not publish confirm to the catalog`)
  }
  assert.equal(published.device_property_read.expands?.needsApproval, false)
  assert.equal(published.device_property_read.confirm, undefined)
  assert.deepEqual(byId.device_function_invoke.routing?.produces, ['function-invocation-receipt'])
  assert.deepEqual(byId.device_property_write.routing?.produces, ['property-write-receipt'])
  assert.deepEqual(byId.device_alarm_handle.routing?.produces, ['alarm-handle-receipt'])
  assert.deepEqual(byId.device_property_read.routing?.produces, ['property-live-value'])
  for (const tool of tools) {
    if (ACTION_IDS.includes(tool.id as typeof ACTION_IDS[number]) || tool.id === 'device_open_tab') continue
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.id} should stay read-only`)
  }
})

test('ambiguous or incomplete function invoke does not call the backend', async () => {
  const original = iotDeviceDetailRealApi.executeFunction
  let calls = 0
  iotDeviceDetailRealApi.executeFunction = async () => {
    calls += 1
    return { result: 'pong' }
  }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_function_invoke') as any
    const missing = await tool.prepare({ functionId: 'missing' }, {}, call(tool.id))
    const ambiguous = await tool.prepare({ keyword: 'alpha' }, {}, call(tool.id))
    const incomplete = await tool.prepare({ functionId: 'set-mode' }, {}, call(tool.id))
    assert.equal(missing.success, false)
    assert.equal(ambiguous.success, false)
    assert.equal(incomplete.success, false)
    assert.ok(Array.isArray(incomplete.details?.missingInputs))
    assert.equal(calls, 0)
  } finally {
    iotDeviceDetailRealApi.executeFunction = original
  }
})

test('confirmed function invoke hits the API once after a valid prepare', async () => {
  const original = iotDeviceDetailRealApi.executeFunction
  const calls: Array<{ deviceId: string; functionId: string; data: unknown }> = []
  iotDeviceDetailRealApi.executeFunction = async (deviceId, functionId, data) => {
    calls.push({ deviceId, functionId, data })
    return { result: 'pong' }
  }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_function_invoke') as any
    const prepared = await tool.prepare({ functionId: 'ping' }, {}, call(tool.id))
    assert.equal(prepared.success, undefined)
    assert.deepEqual(prepared.arguments.functionId, 'ping')
    assert.match(String(prepared.confirmation?.content || ''), /Fixture Device/)
    assert.match(String(prepared.confirmation?.content || ''), /Ping/)
    const result = await tool.execute(prepared.arguments, {}, call(tool.id))
    assert.notEqual(result.success, false)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].deviceId, 'device-1')
    assert.equal(calls[0].functionId, 'ping')
  } finally {
    iotDeviceDetailRealApi.executeFunction = original
  }
})

test('report-only and empty-access properties cannot live-read or write and do not call APIs', async () => {
  const originalRead = iotDeviceDetailRealApi.readProperty
  const originalWrite = iotDeviceDetailRealApi.setProperty
  let reads = 0
  let writes = 0
  iotDeviceDetailRealApi.readProperty = async () => {
    reads += 1
    return { result: 1 }
  }
  iotDeviceDetailRealApi.setProperty = async () => {
    writes += 1
    return {}
  }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const readTool = tools.find(item => item.id === 'device_property_read') as any
    const writeTool = tools.find(item => item.id === 'device_property_write') as any
    const live = await readTool.execute({ propertyId: 'reported' }, {}, call(readTool.id))
    const emptyLive = await readTool.execute({ propertyId: 'empty-access' }, {}, call(readTool.id))
    const prepared = await writeTool.prepare({ propertyId: 'reported', value: 1 }, {}, call(writeTool.id))
    const emptyWrite = await writeTool.prepare({ propertyId: 'empty-access', value: 'x' }, {}, call(writeTool.id))
    const invalid = await writeTool.prepare({ propertyId: 'writable', value: 'invalid' }, {}, call(writeTool.id))
    assert.equal(live.success, false)
    assert.equal(emptyLive.success, false)
    assert.equal(prepared.success, false)
    assert.equal(emptyWrite.success, false)
    assert.equal(invalid.success, false)
    assert.equal(reads, 0)
    assert.equal(writes, 0)
  } finally {
    iotDeviceDetailRealApi.readProperty = originalRead
    iotDeviceDetailRealApi.setProperty = originalWrite
  }
})

test('live property read hits the device API once for a deviceReadable property', async () => {
  const original = iotDeviceDetailRealApi.readProperty
  const calls: Array<{ deviceId: string; property: string }> = []
  iotDeviceDetailRealApi.readProperty = async (deviceId, property) => {
    calls.push({ deviceId, property })
    return { result: { value: 7, timestamp: 1 } }
  }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_property_read') as any
    const result = await tool.execute({ propertyId: 'readable' }, {}, call(tool.id))
    assert.notEqual(result.success, false)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { deviceId: 'device-1', property: 'readable' })
  } finally {
    iotDeviceDetailRealApi.readProperty = original
  }
})

test('writable property execute after prepare writes once per confirmed payload', async () => {
  const original = iotDeviceDetailRealApi.setProperty
  const calls: Array<{ deviceId: string; data: Record<string, unknown> }> = []
  iotDeviceDetailRealApi.setProperty = async (deviceId, data) => {
    calls.push({ deviceId, data })
    return {}
  }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_property_write') as any
    const prepared = await tool.prepare({ propertyId: 'writable', value: 'on' }, {}, call(tool.id))
    assert.ok(prepared.arguments?.properties)
    assert.match(String(prepared.confirmation?.content || ''), /Fixture Device/)
    const result = await tool.execute(prepared.arguments, {}, call(tool.id))
    const mapped = await tool.prepare({ properties: { writable: 'off', 'comma-access': true } }, {}, call(tool.id))
    const mappedResult = await tool.execute(mapped.arguments, {}, call(tool.id))
    assert.notEqual(result.success, false)
    assert.notEqual(mappedResult.success, false)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].data, { writable: 'on' })
    assert.deepEqual(calls[1].data, { writable: 'off', 'comma-access': true })
  } finally {
    iotDeviceDetailRealApi.setProperty = original
  }
})

test('alarm handle rejects missing describe, other devices, and already handled records', async () => {
  const originalQuery = iotDeviceDetailRealApi.queryAlarmByDevice
  const originalHandle = iotDeviceDetailRealApi.handleAlarmByDevice
  let handles = 0
  iotDeviceDetailRealApi.handleAlarmByDevice = async () => {
    handles += 1
    return {}
  }
  iotDeviceDetailRealApi.queryAlarmByDevice = async () => ({ result: { data: [], total: 0 } })
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_alarm_handle') as any
    const missingDescribe = await tool.prepare({ alarmRecordId: 'alarm-1' }, {}, call(tool.id))
    const tooLong = await tool.prepare({ alarmRecordId: 'alarm-1', describe: 'x'.repeat(201) }, {}, call(tool.id))
    const missingRecord = await tool.prepare({ alarmRecordId: 'alarm-1', describe: 'checked' }, {}, call(tool.id))
    iotDeviceDetailRealApi.queryAlarmByDevice = async () => ({
      result: {
        data: [{
          id: 'alarm-foreign',
          alarmName: 'Foreign',
          alarmConfigId: 'cfg-2',
          alarmTime: 1,
          state: { value: 'warning', text: '告警中' },
          sourceId: 'device-other',
        }],
        total: 1,
      },
    })
    const foreign = await tool.prepare({ alarmRecordId: 'alarm-foreign', describe: 'checked' }, {}, call(tool.id))
    assert.equal(missingDescribe.success, false)
    assert.equal(tooLong.success, false)
    assert.equal(missingRecord.success, false)
    assert.equal(foreign.success, false)
    assert.equal(handles, 0)
  } finally {
    iotDeviceDetailRealApi.queryAlarmByDevice = originalQuery
    iotDeviceDetailRealApi.handleAlarmByDevice = originalHandle
  }
})

test('already handled and valid warning alarms only send _handle after prepare', async () => {
  const originalQuery = iotDeviceDetailRealApi.queryAlarmByDevice
  const originalHandle = iotDeviceDetailRealApi.handleAlarmByDevice
  const calls: unknown[] = []
  iotDeviceDetailRealApi.handleAlarmByDevice = async (data) => {
    calls.push(data)
    return {}
  }
  const warning = {
    id: 'alarm-open',
    alarmName: 'Fixture alarm',
    alarmConfigId: 'cfg-1',
    alarmTime: 1700000000000,
    state: { value: 'warning', text: '告警中' },
    sourceId: 'device-1',
  }
  const handled = { ...warning, id: 'alarm-closed', state: { value: 'normal', text: '已处理' } }
  try {
    const tools = createDeviceDetailAgentTools(commandService())
    const tool = tools.find(item => item.id === 'device_alarm_handle') as any
    iotDeviceDetailRealApi.queryAlarmByDevice = async () => ({ result: { data: [handled], total: 1 } })
    const already = await tool.prepare({ alarmRecordId: 'alarm-closed', describe: 'checked' }, {}, call(tool.id))
    assert.equal(already.success, false)
    assert.equal(calls.length, 0)

    iotDeviceDetailRealApi.queryAlarmByDevice = async () => ({ result: { data: [warning], total: 1 } })
    const prepared = await tool.prepare({ alarmRecordId: 'alarm-open', describe: 'checked' }, {}, call(tool.id))
    const result = await tool.execute(prepared.arguments, {}, call(tool.id))
    assert.notEqual(result.success, false)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      describe: 'checked',
      type: 'user',
      state: 'normal',
      alarmRecordId: 'alarm-open',
      alarmConfigId: 'cfg-1',
      alarmTime: 1700000000000,
    })
  } finally {
    iotDeviceDetailRealApi.queryAlarmByDevice = originalQuery
    iotDeviceDetailRealApi.handleAlarmByDevice = originalHandle
  }
})

test('diagnosis workflow does not auto-handle alarms', () => {
  const alarm = createDeviceDetailAgentWorkflows().find(item => item.id === 'device-detail-alarm-diagnosis')
  assert.ok(alarm)
  assert.equal(
    (alarm?.steps || []).some((step: any) => step.capability === 'subject.alarm.handle'),
    false,
  )
  assert.ok(String(alarm?.notes?.[0] || '').includes('IotDeviceDetailAgent.workflows.alarm.note'))
})

test('action tools stay off the project general-agent catalog', () => {
  const source = readFileSync('agentCapabilities/deviceAnalysis/tools.ts', 'utf8')
  for (const id of ACTION_IDS) {
    assert.equal(source.includes(`'${id}'`) || source.includes(`"${id}"`), false, `${id} leaked into general agent tools`)
  }
})
