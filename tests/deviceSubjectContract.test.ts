import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { request } from '@jetlinks-web/core'
import { createAiClientToolRuntime } from '@jetlinks-web-core/layout/components/AiChat/clientTools'
import type { HomeAgentCapabilityContext } from '@jetlinks-web-core/layout/components/AiChat/homeAgentContracts'

import {
  createDeviceDomainTools,
  DEVICE_DOMAIN_TOOL_IDS,
} from '../views/device/Domain/agentDeviceDomainTools.ts'
import {
  createDeviceSubjectRequiredError,
  DEVICE_DEVICE_ID_REQUIRED_CODE,
  DEVICE_SUBJECT_REQUIRED_CODE,
} from '../views/device/agentTools/deviceSubjectContract.ts'
import {
  createDevicePropertyAggregateTool,
  type DevicePropertyAggregateCopy,
} from '../views/device/agentTools/propertyAggregateTool.ts'

const createContext = (menuCodes = ['device/Instance', 'device/Product']): HomeAgentCapabilityContext => {
  const menus = menuCodes.map(code => ({
    code, name: code, title: code, breadcrumb: [], keywords: [],
  }))
  return {
    currentRoute: {},
    menus,
    capabilities: [],
    findMenu: value => menus.find(menu => menu.code === value),
    navigateToMenu: () => { throw new Error('Unexpected navigation') },
    navigateToRoute: () => { throw new Error('Unexpected navigation') },
  }
}

const tools = createDeviceDomainTools()
const callTool = (id: string, args: Record<string, unknown>, context = createContext()) => {
  const tool = tools.find(candidate => candidate.id === id)
  assert.ok(tool, `Missing tool ${id}`)
  return tool.execute(args, context, { id: `${id}-call`, toolName: id })
}

const isRequiredFailure = (code: string, message: string) => (error: unknown) => {
  assert.ok(error instanceof Error)
  assert.equal(error.message, message)
  assert.equal((error as any).code, code)
  assert.equal((error as any).failureDisposition, 'request')
  assert.equal((error as any).recoveryAction, 'repair')
  assert.equal((error as any).retryable, false)
  assert.equal((error as any).repair.maxAttempts, 1)
  assert.equal((error as any).details, undefined)
  return true
}

test('missing subjects declare an inclusive device-or-product repair schema without workflow instructions', () => {
  const error = createDeviceSubjectRequiredError('subject', 'Subject required')
  assert.ok(isRequiredFailure(DEVICE_SUBJECT_REQUIRED_CODE, 'Subject required')(error))
  assert.deepEqual(error.repair, {
    maxAttempts: 1,
    requiredInput: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', minLength: 1, pattern: '\\S' },
        productId: { type: 'string', minLength: 1, pattern: '\\S' },
      },
      anyOf: [{ required: ['deviceId'] }, { required: ['productId'] }],
    },
  })
})

test('device-only failures retain caller copy and require a nonblank device ID', () => {
  const message = 'Missing device identifier'
  const error = createDeviceSubjectRequiredError('deviceId', message)
  assert.ok(isRequiredFailure(DEVICE_DEVICE_ID_REQUIRED_CODE, message)(error))
  assert.equal(error.repair.field, 'deviceId')
  const schema = error.repair.requiredInput
  assert.ok('required' in schema)
  assert.deepEqual(schema.required, ['deviceId'])
  assert.deepEqual(Object.keys(schema.properties), ['deviceId'])
  const pattern = new RegExp(schema.properties.deviceId.pattern)
  assert.equal(pattern.test(' \t\n'), false)
  assert.equal(pattern.test(' device-1 '), true)
})

test('both model tools classify absent and blank device/product identifiers consistently', async () => {
  for (const id of [DEVICE_DOMAIN_TOOL_IDS.modelGet, DEVICE_DOMAIN_TOOL_IDS.metadataSearch]) {
    for (const args of [{}, { deviceId: ' \t', productId: '\n' }, { subjectType: 'product' }]) {
      await assert.rejects(
        () => callTool(id, args),
        isRequiredFailure(DEVICE_SUBJECT_REQUIRED_CODE, 'Domain.homeAgent.tool.common.subjectIdRequired'),
      )
    }
  }
})

const dataToolIds = [
  DEVICE_DOMAIN_TOOL_IDS.latestProperties,
  DEVICE_DOMAIN_TOOL_IDS.propertyHistorySummary,
  DEVICE_DOMAIN_TOOL_IDS.propertyHistory,
  DEVICE_DOMAIN_TOOL_IDS.propertyAggregate,
]

test('device data tools classify unresolved device identifiers before property/time queries', async () => {
  for (const id of dataToolIds) {
    for (const args of [{}, { deviceId: ' \n', propertyId: 'temperature' }]) {
      await assert.rejects(
        () => callTool(id, args),
        isRequiredFailure(DEVICE_DEVICE_ID_REQUIRED_CODE, 'Domain.homeAgent.tool.common.deviceIdMissing'),
      )
    }
  }
})

test('device data tools keep permission failures ahead of missing-argument repair', async () => {
  for (const id of dataToolIds) {
    await assert.rejects(() => callTool(id, {}, createContext([])), (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.message, 'Domain.homeAgent.tool.common.noDevicePermission')
      assert.equal((error as any).repair, undefined)
      return true
    })
  }
})

test('model tools still select device or product permissions independently for nonblank IDs', async () => {
  for (const id of [DEVICE_DOMAIN_TOOL_IDS.modelGet, DEVICE_DOMAIN_TOOL_IDS.metadataSearch]) {
    await assert.rejects(
      () => callTool(id, { productId: ' product-1 ' }, createContext(['device/Instance'])),
      { message: 'Domain.homeAgent.tool.common.noProductPermission' },
    )
    await assert.rejects(
      () => callTool(id, { deviceId: ' device-1 ' }, createContext(['device/Product'])),
      { message: 'Domain.homeAgent.tool.common.noDevicePermission' },
    )
    // A valid ID reaches the existing HTTP boundary, not the missing-subject branch.
    await assert.rejects(
      () => callTool(id, { productId: ' product-1 ' }),
      { message: 'Node declaration test transport is unavailable' },
    )
  }
})

test('model tools trim accepted identifiers without changing successful model results', async () => {
  const originalGet = request.get
  const paths: string[] = []
  const metadata = { properties: [{ id: 'temperature', valueType: { type: 'double' } }] }
  request.get = (async (url: string) => {
    paths.push(url)
    return { success: true, result: { metadata } }
  }) as typeof request.get
  try {
    for (const [args, expectedPath, expectedType] of [
      [{ deviceId: ' device-1 ' }, '/device-instance/device-1/detail', 'device'],
      [{ productId: ' product-1 ' }, '/device-product/product-1', 'product'],
      [{ deviceId: ' device-1 ', productId: ' product-1 ' }, '/device-instance/device-1/detail', 'device'],
    ] as const) {
      const result = await callTool(DEVICE_DOMAIN_TOOL_IDS.modelGet, { ...args, format: 'json' }) as any
      assert.equal(paths.at(-1), expectedPath)
      assert.equal(result.success, true)
      assert.equal(result.summary.subjectType, expectedType)
      assert.deepEqual(result.__clientToolOutputs.output4, {
        ...metadata, functions: [], events: [], tags: [],
      })
    }
  } finally {
    request.get = originalGet
  }
})

test('shared aggregate reports an unresolved subject before invoking time-range processing', async () => {
  const copy: DevicePropertyAggregateCopy = {
    description: 'Aggregate properties', help: 'Aggregate properties',
    propertyId: 'Property', propertyIds: 'Properties', aggregation: 'Aggregation',
    interval: 'Interval', startTime: 'Start', endTime: 'End', timeRange: 'Time range',
    limit: 'Limit', deviceIdMissing: 'Select a device', propertyIdMissing: 'Select a property',
    nonNumericWarning: id => id, longitudeLabel: label => label, latitudeLabel: label => label,
    pathResolutionAdjusted: (requested, resolved) => `${requested} -> ${resolved}`, truncated: 'Truncated',
  }
  const tool = createDevicePropertyAggregateTool({
    copy,
    resolveSubject: () => ({ deviceId: ' \t', metadata: {} }),
    resolveTimeRange: () => { throw new Error('Unexpected time-range processing') },
    describeTimeRange: () => undefined,
    dataTypeText: () => '',
  })
  await assert.rejects(
    () => tool.execute({}, {}, { id: 'aggregate-call', toolName: tool.id }),
    isRequiredFailure(DEVICE_DEVICE_ID_REQUIRED_CODE, copy.deviceIdMissing),
  )
})

test('actual core runtime preserves device repair schemas under the default result guard', async () => {
  const runtime = createAiClientToolRuntime(tools, {
    includeHelpTool: false,
    getContext: () => createContext(),
  })
  try {
    for (const toolName of [DEVICE_DOMAIN_TOOL_IDS.modelGet, ...dataToolIds]) {
      const result = await runtime.handleClientToolCall({
        id: `${toolName}-runtime-call`, toolName, arguments: {},
      }) as any
      const deviceOnly = toolName !== DEVICE_DOMAIN_TOOL_IDS.modelGet
      const expected = createDeviceSubjectRequiredError(deviceOnly ? 'deviceId' : 'subject', result.message)
      assert.equal(result.success, false)
      assert.equal(result.code, expected.code)
      assert.equal(result.failureDisposition, 'request')
      assert.equal(result.recoveryAction, 'repair')
      assert.equal(result.retryable, false)
      assert.deepEqual(result.repair, expected.repair)
      assert.equal(result.details?.instruction, undefined)
      assert.equal(result.nextAction, undefined)
    }
  } finally {
    runtime.dispose()
  }
})

test('the subject-error helper depends only on the shared core type contract', () => {
  const source = readFileSync(path.resolve(
    process.cwd(), 'views/device/agentTools/deviceSubjectContract.ts',
  ), 'utf8')
  const imports = source.match(/^import\s.*$/gm)
  assert.deepEqual(imports, [
    "import type { AiClientToolFailureOptions } from '@jetlinks-web-core/layout/components/AiChat/clientTools'",
  ])
})
