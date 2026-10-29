import assert from 'node:assert/strict'
import test from 'node:test'
import zh from '../locales/lang/zh.json'
import en from '../locales/lang/en.json'
import { explainNotification, explainPropertyRule } from '../agentCapabilities/deviceAnalysis/propertyRules/explain'
import { devicePropertyRulesService, queryDevicePropertyRules } from '../agentCapabilities/deviceAnalysis/propertyRules/service'
import { deviceModelService } from '../agentCapabilities/deviceAnalysis/deviceModel.service'
import { iotDeviceAnalysisGeneralAgentProvider } from '../agentCapabilities/deviceAnalysis/generalAgentProvider'
import { createDeviceDetailAgentWorkflows } from '../views/device/list/agent/deviceDetailAgent.workflows'
import { createDeviceDetailAgentService } from '../views/device/list/agent/deviceDetailAgent.service'
import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools'
import { createDeviceAnalysisTools } from '../agentCapabilities/deviceAnalysis/tools'
import { toAiClientToolSessionDefinition } from '@jetlinks-web-core/layout/components/AiChat/clientToolApi'
import { request } from '@jetlinks-web/core'
import { deviceAlarmApi } from '../views/device/alarm/api'
import { buildPreprocessPayload, createEmptyNotification, getAlarmProcessor, getNotifyProcessor } from '../views/device/alarm/utils'
import { iotDeviceDetailRealApi } from '../views/device/list/services/iotDeviceDetailReal.service'
import { mapApiDevice } from '../views/device/list/services/adapters/iotDeviceApiAdapter'

const property = { id: 'temperature', name: 'Temperature', valueType: { type: 'double', unit: 'celsius' } }
const translate = messages => (key, params = {}) => {
  assert.ok(messages[key], `Missing translation: ${key}`)
  return messages[key].replace(/\{(\w+)\}/g, (_, field) => String(params[field] ?? ''))
}
const t = translate(zh)

test('rule explanation distinguishes cleaning records, report suppression and unknown chains', () => {
  const raw = { provider: 'composite', configuration: { recordInvalid: true, processors: [
    { provider: 'simple', configuration: { matcher: { provider: 'value-set', configuration: { values: [-1] } },
      processors: [{ provider: 'ignore', configuration: {} }] } },
    { provider: 'ratio-sampling', configuration: { ratio: 0.5 } },
  ] } }
  for (const messages of [zh, en]) {
    const explain = value => explainPropertyRule({ property, product: value }, {}, translate(messages))
    const result = explain(raw)
    assert.equal(result.invalidDataRecording.enabled, true)
    assert.deepEqual(result.steps.map(step => Boolean(step.recordInvalid)), [true, false])
    assert.ok(result.summary.includes(messages['PropertyRules.recordInvalid']))
    const samplingOnly = structuredClone(raw)
    samplingOnly.configuration.processors.shift()
    assert.equal(explain(samplingOnly).invalidDataRecording.enabled, false)
    const unsupported = structuredClone(raw)
    unsupported.configuration.processors.push({ provider: 'custom', configuration: {} })
    assert.equal(explain(unsupported).invalidDataRecording.enabled, null)
    const disabled = structuredClone(raw)
    delete disabled.configuration.recordInvalid
    assert.equal(explain(disabled).invalidDataRecording.enabled, false)
  }
})
const alarmForm = () => ({
  property: 'temperature', name: 'High temperature', source: 'product', targetId: 'product-1', level: 3,
  trigger: 'gt', value: 80, limit: {}, autoRelieve: true,
  relieveCondition: { trigger: 'lte', value: 75, limit: {} },
  notification: { ...createEmptyNotification(), enabled: true, includeRelieve: true,
    channelProviders: ['email'], userIds: ['user-1', 'user-2'] },
})
const alarmRule = () => ({ ...buildPreprocessPayload(alarmForm()), id: 'config-1', property: 'temperature' })
const empty = { property: 'temperature', provider: 'composite', configuration: { processors: [] } }
const resources = {
  levels: [{ value: 3, label: '一般' }],
  methods: [{ id: 'email', providerId: 'email', key: 'email', label: '邮件', desc: '', icon: 'MailOutlined',
    channelIds: ['channel-1'], templates: { trigger: 'ready', relieve: 'missing' } }],
  users: [{ id: 'user-1', name: '张三' }, { id: 'user-2', name: '李四' }],
}

test('named field discovery searches beyond the first model page without exposing unrelated configuration', async () => {
  const properties = [...Array.from({ length: 60 }, (_, index) => ({ id: `p${index}`, name: `Field ${index}` })), property]
  let reads = 0
  const resolveMetadata = async id => {
    reads++
    assert.equal(id, 'device-1')
    return { device: { id, name: 'Device' }, metadata: { properties, events: [], functions: [], tags: [] } }
  }
  const result = await deviceModelService.getModel({ deviceId: 'device-1', section: 'properties', keyword: 'Temperature' }, resolveMetadata)
  assert.equal(reads, 1)
  assert.equal(result.total, 1)
  assert.equal(result.truncated, false)
  assert.equal(result.data.properties[0].id, 'temperature')
  assert.equal(result.data.properties.length, 1)
  const unchanged = await deviceModelService.getModel({ deviceId: 'device-1', section: 'properties' }, resolveMetadata)
  assert.equal(unchanged.total, 61)
  assert.equal(unchanged.data.properties.length, 20)
  assert.equal(unchanged.truncated, true)
  const tools = createDeviceAnalysisTools().map(factory => factory.build())
  assert.ok(toAiClientToolSessionDefinition(tools.find(tool => tool.id === 'device_model_get')).inputs.some(input => input.name === 'keyword'))
})

test('rule guidance keeps discovery before configuration and event evidence conditional for both entry points', () => {
  const context = { findMenu: () => ({ code: 'device' }) }
  const global = iotDeviceAnalysisGeneralAgentProvider.getWorkflowGuides(context).find(guide => guide.id === 'device-property-rules')
  const detail = createDeviceDetailAgentWorkflows(true)
  const local = detail.find(guide => guide.id === 'device-detail-property-rules')
  for (const guide of [global, local]) {
    assert.ok(guide.description)
    assert.equal(guide.scenarios.length, 4)
    const configIndex = guide.steps.findIndex(step => step.capability === 'subject.property.rules.read')
    assert.ok(configIndex > 0)
    assert.ok(guide.steps.slice(0, configIndex).some(step => step.evidence === 'subject-property-id'))
    assert.equal(guide.steps.some(step => step.capability.includes('history')), false)
  }
  const alarm = detail.find(guide => guide.id === 'device-detail-alarm-diagnosis')
  assert.equal(alarm.steps.find(step => step.capability === 'subject.property.rules.read').required, false)
  assert.equal(alarm.steps.find(step => step.capability === 'subject.alarm.history.summary').required, false)
  for (const id of ['device-detail-today-operation', 'device-detail-offline-diagnosis']) {
    assert.equal(detail.find(guide => guide.id === id).steps.some(step => step.capability === 'subject.property.rules.read'), false)
  }
  assert.deepEqual(iotDeviceAnalysisGeneralAgentProvider.getSystemPromptLines({ findMenu: () => undefined }), [])
})

test('business guidance translations are complete for configuration, recovery, notification and data questions', () => {
  const keys = Object.keys(zh).filter(key => key === 'PropertyRuleAgent.usage' || key.startsWith('PropertyRuleAgent.workflow.'))
  for (const messages of [zh, en]) {
    for (const key of keys) assert.ok(translate(messages)(key))
  }
})

test('effective rule explanation distinguishes inheritance, an entire override, disabling and absence', () => {
  const product = alarmRule()
  const inherited = explainPropertyRule({ property, product }, resources, t)
  assert.equal(inherited.source.inherited, true)
  assert.equal(inherited.alarm?.trigger.operator, 'gt')
  const disabled = explainPropertyRule({ property, product, device: empty }, {}, t)
  assert.equal(disabled.status, 'disabled')
  assert.equal(disabled.source.kind, 'device')
  assert.equal(disabled.source.overridesProduct, true)
  assert.equal(disabled.alarm, undefined)
  const override = explainPropertyRule({ property, product, device: {
    property: 'temperature', provider: 'ratio-sampling', configuration: { ratio: 0.1 },
  } }, {}, t)
  assert.deepEqual(override.steps.map(step => step.kind), ['sampling'])
  assert.equal(override.alarm, undefined)
  const absent = explainPropertyRule({ property }, {}, t)
  assert.equal(absent.status, 'unconfigured')
  assert.match(absent.summary, /不代表没有场景联动/)
})

test('complete chains preserve cleaning, calibration, filling, alarm and sampling order without evaluating values', () => {
  const product = { provider: 'composite', configuration: { processors: [
    { provider: 'simple', configuration: { matcher: { provider: 'value-set', configuration: { values: [-1] } }, processors: [{ provider: 'ignore', configuration: {} }] } },
    { provider: 'calibration', configuration: { scale: '0.1', offset: '2' } },
    { provider: 'fallback', configuration: { mode: 'previous', maxAgeMillis: 300000, includeMissing: true } },
    alarmRule(), { provider: 'interval-sampling', configuration: { intervalMillis: 10000 } },
  ] } }
  const result = explainPropertyRule({ property, product }, resources, t)
  assert.equal(result.interpretation, 'complete')
  assert.deepEqual(result.steps.map(step => step.kind), ['values', 'scale', 'fallback', 'alarm', 'sampling'])
  assert.deepEqual(result.steps[1].parameters, { scale: '0.1', offset: '2' })
  assert.match(result.semantics.fallback, /不触发或解除/)
  assert.match(result.semantics.sampling, /先判断告警/)
  assert.equal(result.alarm?.trigger.value, 80)
  assert.equal(result.alarm?.recovery.condition?.value, 75)
  assert.equal(result.alarm?.recovery.mode, 'custom')
  assert.equal(result.alarm?.trigger.unit, '℃')
})

test('notification explanation distinguishes types, recipients, trigger/recovery templates and delivery policy', () => {
  const result = explainPropertyRule({ property, product: alarmRule() }, resources, t)
  const notification = result.alarm.notification
  assert.deepEqual(notification.recipients.map(user => user.name), ['张三', '李四'])
  assert.deepEqual(notification.types[0].templates, { trigger: 'ready', relieve: 'missing' })
  assert.equal(notification.triggerPolicy, 'first-alarm')
  assert.equal(notification.relievePolicy, 'successful-relieve')
  assert.equal(notification.relieveTopic, 'alarm-device-relieve')
  assert.equal(notification.resolution, 'complete')
  assert.match(notification.notices[0], /不代表投递成功/)
  assert.ok(notification.warnings.some(warning => warning.includes('尚无对应')))
  assert.equal(JSON.stringify(result).includes('notifierId'), false)
})

test('persisted recovery using the trigger topic keeps its actual template selection', () => {
  const form = alarmForm()
  form.notification.relieveTopicProvider = 'alarm-device'
  const result = explainPropertyRule({ property, product: buildPreprocessPayload(form) }, resources, t)
  assert.equal(result.alarm?.notification?.relieveTopic, 'alarm-device')
  assert.equal(result.alarm?.notification?.types[0].templates.relieve, 'ready')
})

test('notification event policies follow effective switches rather than template availability', () => {
  const available = { ...resources, methods: [
    ...resources.methods,
    { providerId: 'site', label: '站内信', templates: { trigger: 'unneeded', relieve: 'unneeded' } },
  ] }
  for (const messages of [zh, en]) {
    for (const [enabled, includeRelieve, autoRelieve, triggerPolicy, relievePolicy] of [
      [false, true, true, 'disabled', 'disabled'],
      [true, false, true, 'first-alarm', 'disabled'],
      [true, true, false, 'first-alarm', 'disabled'],
      [true, true, true, 'first-alarm', 'successful-relieve'],
    ]) {
      const result = explainNotification({ ...alarmForm().notification, enabled, includeRelieve,
        channelProviders: ['email', 'site'] }, available, autoRelieve, translate(messages))
      assert.equal(result.triggerPolicy, triggerPolicy)
      assert.equal(result.relievePolicy, relievePolicy)
      assert.equal(result.includeRelieve, relievePolicy !== 'disabled')
      assert.equal(result.types.find(type => type.id === 'site').templates.relieve, 'unneeded')
      if (enabled && relievePolicy === 'disabled') {
        assert.ok(result.description.includes(messages['PropertyRuleAgent.excludeRelieve']))
      }
    }
  }
  const form = alarmForm()
  form.notification.includeRelieve = false
  const result = explainPropertyRule({ property, product: buildPreprocessPayload(form) }, available, t)
  assert.equal(result.alarm.notification.relievePolicy, 'disabled')
  assert.equal(result.alarm.actions.find(action => action.event === 'relieve').order.some(action => action.provider === 'notify'), false)
})

test('missing resources remain unknown, not absent, and notification-off needs no template', () => {
  const result = explainPropertyRule({ property, product: alarmRule() }, {}, t)
  assert.equal(result.alarm?.notification?.types[0].templates.trigger, 'unknown')
  assert.equal(result.alarm?.notification?.recipients[0].resolved, false)
  assert.equal(result.alarm?.notification?.resolution, 'partial')
  const form = alarmForm()
  form.notification.enabled = false
  const disabled = explainPropertyRule({ property, product: buildPreprocessPayload(form) }, {}, t)
  assert.equal(disabled.alarm?.notification?.enabled, false)
  assert.deepEqual(disabled.alarm?.notification?.warnings, [])
})

test('unsupported order and notification-before-alarm never return a fabricated complete chain', () => {
  const alarm = alarmRule()
  const reordered = { provider: 'composite', configuration: { processors: [
    { provider: 'ratio-sampling', configuration: { ratio: 0.5 } }, alarm,
  ] } }
  const result = explainPropertyRule({ property, product: reordered }, {}, t)
  assert.equal(result.interpretation, 'unsupported')
  assert.deepEqual(result.steps, [])
  assert.equal(result.alarm, undefined)
  assert.deepEqual(result.providers, ['ratio-sampling', 'composite'])
  const branch = buildPreprocessPayload({ ...alarmForm(), autoRelieve: false })
  branch.configuration.processors.reverse()
  assert.equal(explainPropertyRule({ property, product: branch }, {}, t).interpretation, 'unsupported')
  const custom = alarmRule()
  getNotifyProcessor(custom).configuration.topicProvider = 'custom-topic'
  assert.equal(explainPropertyRule({ property, product: custom }, {}, t).interpretation, 'unsupported')
})

test('runtime defaults and complementary conditions are explained without adopting editor defaults', () => {
  const form = { ...alarmForm(), relieveCondition: undefined }
  const product = buildPreprocessPayload(form)
  delete getAlarmProcessor(product).configuration.alarmLevel
  delete getAlarmProcessor(product).configuration.alarmName
  const result = explainPropertyRule({ property, product }, resources, t)
  assert.equal(result.alarm?.level.value, 3)
  assert.equal(result.alarm?.name, 'Temperature阈值告警')
  assert.equal(result.alarm?.recovery.mode, 'complement')
  assert.equal(result.alarm?.recovery.condition?.operator, 'lte')
  assert.equal(result.alarm?.recovery.condition?.value, 80)
})

test('range boundaries, enum sets and booleans keep typed values while summaries support both languages', () => {
  for (const messages of [zh, en]) {
    const localize = translate(messages)
    const range = { ...alarmForm(), trigger: 'outside', limit: { lower: 10, upper: 90 },
      notification: createEmptyNotification(), autoRelieve: false }
    const result = explainPropertyRule({ property, product: buildPreprocessPayload(range) }, resources, localize)
    assert.equal(result.alarm?.trigger.inclusive, true)
    assert.equal(result.alarm?.trigger.lower, 10)
    assert.doesNotMatch(result.summary, /PropertyRuleAgent\.|DeviceAlarm\.|PropertyRules\./)
    const scalarProperty = { id: 'mode', name: 'Mode', valueType: { type: 'enum', elements: [{ value: 'on', text: 'Running' }, { value: 'off', text: 'Stopped' }] } }
    const set = explainPropertyRule({ property: scalarProperty, product: buildPreprocessPayload({ ...range, trigger: 'in', values: ['on', 'off'] }) }, resources, localize)
    assert.deepEqual(set.alarm?.trigger.values, ['on', 'off'])
    assert.match(set.summary, /Running/)
    const boolean = explainPropertyRule({ property: { id: 'enabled', valueType: { type: 'boolean' } },
      product: buildPreprocessPayload({ ...range, trigger: 'eq', value: false }) }, resources, localize)
    assert.equal(boolean.alarm?.trigger.value, false)
  }
})

test('rule queries batch only the requested property page and skip all notification lookups without alarms', async () => {
  const originalProduct = deviceAlarmApi.queryProductAlarmList
  const originalDevice = deviceAlarmApi.queryDeviceAlarmList
  const calls = []
  deviceAlarmApi.queryProductAlarmList = async (productId, query) => { calls.push({ productId, query }); return [] }
  deviceAlarmApi.queryDeviceAlarmList = async (productId, deviceId, query) => { calls.push({ productId, deviceId, query }); return [] }
  try {
    const subject = { id: 'device-1', productId: 'product-1', properties: Array.from({ length: 51 }, (_, index) => ({ id: `p${index}` })) }
    const result = await queryDevicePropertyRules(subject, { pageIndex: 1, pageSize: 20 })
    assert.equal(result.success, true)
    assert.equal(result.data.length, 20)
    assert.equal(result.total, 51)
    assert.equal(result.nextPage, 2)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].query.terms[0].value,
      Array.from({ length: 20 }, (_, index) => `p${index + 20}`))
    await assert.rejects(() => queryDevicePropertyRules(subject, { propertyId: 'not-in-model' }), /propertyNotFound/)
    assert.equal(calls.length, 2)
    const pastEnd = await queryDevicePropertyRules(subject, { pageIndex: 3, pageSize: 20 })
    assert.deepEqual(pastEnd.data, [])
    assert.equal(calls.length, 2)
  } finally {
    deviceAlarmApi.queryProductAlarmList = originalProduct
    deviceAlarmApi.queryDeviceAlarmList = originalDevice
  }
})

test('permission failures do not fall back to an inherited rule or report absence', async () => {
  const originalProduct = deviceAlarmApi.queryProductAlarmList
  const originalDevice = deviceAlarmApi.queryDeviceAlarmList
  deviceAlarmApi.queryProductAlarmList = async () => [alarmRule()]
  deviceAlarmApi.queryDeviceAlarmList = async () => { throw { status: 403, message: 'Forbidden' } }
  try {
    const result = await queryDevicePropertyRules({ id: 'device-1', productId: 'product-1', properties: [property] }, {})
    assert.equal(result.success, false)
    assert.deepEqual(result.data, [])
    assert.notEqual(result.evidence?.supportsAbsenceClaim, true)
  } finally {
    deviceAlarmApi.queryProductAlarmList = originalProduct
    deviceAlarmApi.queryDeviceAlarmList = originalDevice
  }
})

test('malformed or failed rule-list responses cannot masquerade as an empty configuration', async () => {
  const original = request.post
  try {
    for (const response of [{ success: false, result: [] }, { status: 403, result: [] }, { result: {} }, { result: [{ provider: 'simple' }] }]) {
      request.post = async () => response
      await assert.rejects(() => deviceAlarmApi.queryProductAlarmList('product-1', {}), /loadFailed/)
      await assert.rejects(() => deviceAlarmApi.queryDeviceAlarmList('product-1', 'device-1', {}), /loadFailed/)
    }
    request.post = async () => ({ result: [] })
    assert.deepEqual(await deviceAlarmApi.queryProductAlarmList('product-1', {}), [])
    request.post = async () => ({ result: [alarmRule()] })
    assert.equal((await deviceAlarmApi.queryDeviceAlarmList('product-1', 'device-1', {})).length, 1)
  } finally {
    request.post = original
  }
})

test('notification resources load once per page, omit contact data and keep failed lookups partial', async () => {
  const originals = {
    product: deviceAlarmApi.queryProductAlarmList, device: deviceAlarmApi.queryDeviceAlarmList,
    levels: deviceAlarmApi.queryDefaultAlarmLevels, types: deviceAlarmApi.queryNotifyTypes,
    channels: deviceAlarmApi.queryNotifyChannels, users: deviceAlarmApi.queryNotifyUsers,
  }
  const calls = { levels: 0, types: 0, channels: 0, users: 0 }
  const properties = Array.from({ length: 3 }, (_, index) => ({ ...property, id: `p${index}` }))
  deviceAlarmApi.queryProductAlarmList = async () => properties.map(item => ({ ...alarmRule(), property: item.id }))
  deviceAlarmApi.queryDeviceAlarmList = async () => []
  deviceAlarmApi.queryDefaultAlarmLevels = (async () => {
    calls.levels++
    return { result: { levels: [{ level: 3, title: 'Normal' }] } }
  })
  deviceAlarmApi.queryNotifyTypes = async () => { calls.types++; return [{ id: 'email', name: 'Email' }] }
  deviceAlarmApi.queryNotifyChannels = (async () => {
    calls.channels++
    return ['alarm-device', 'alarm-device-relieve'].map(provider => ({ provider, state: 'enabled', channels: [
      { id: provider, channelProvider: 'email', state: 'enabled', channelConfiguration: { templateId: 'template', notifierId: 'notifier' } },
    ] }))
  })
  deviceAlarmApi.queryNotifyUsers = (async args => {
    calls.users++
    assert.deepEqual(args.userIds, ['user-1', 'user-2'])
    return { result: { data: [{ id: 'user-1', name: 'Alice', email: 'private@example.com' }, { id: 'user-2', name: 'Bob' }], total: 2 } }
  })
  try {
    const subject = { id: 'device-1', productId: 'product-1', properties }
    const result = await queryDevicePropertyRules(subject, {})
    assert.equal(result.success, true)
    assert.deepEqual(calls, { levels: 1, types: 1, channels: 1, users: 1 })
    assert.equal(result.data.every(item => item.alarm?.notification?.resolution === 'complete'), true)
    assert.equal(JSON.stringify(result).includes('private@example.com'), false)
    deviceAlarmApi.queryNotifyUsers = async () => { throw new Error('Lookup unavailable') }
    deviceAlarmApi.queryNotifyChannels = async () => { throw new Error('Not authorized') }
    const partial = await queryDevicePropertyRules(subject, {})
    assert.equal(partial.status, 'partial')
    assert.equal(partial.data[0].alarm?.trigger.value, 80)
    assert.equal(partial.data[0].alarm?.notification?.types[0].templates.trigger, 'unknown')
    assert.equal(partial.data[0].alarm?.notification?.recipients[0].id, 'user-1')
    assert.equal(partial.data[0].alarm?.notification?.recipients[0].resolved, false)
  } finally {
    deviceAlarmApi.queryProductAlarmList = originals.product
    deviceAlarmApi.queryDeviceAlarmList = originals.device
    deviceAlarmApi.queryDefaultAlarmLevels = originals.levels
    deviceAlarmApi.queryNotifyTypes = originals.types
    deviceAlarmApi.queryNotifyChannels = originals.channels
    deviceAlarmApi.queryNotifyUsers = originals.users
  }
})

test('detail and global tools use the verified subject and share the same effective configuration', async () => {
  const originalProduct = deviceAlarmApi.queryProductAlarmList
  const originalDevice = deviceAlarmApi.queryDeviceAlarmList
  const originalDetail = iotDeviceDetailRealApi.getDeviceDetail
  const originalLevels = deviceAlarmApi.queryDefaultAlarmLevels
  let detailCalls = 0
  const scopes = []
  deviceAlarmApi.queryProductAlarmList = async productId => { scopes.push(productId); return [] }
  deviceAlarmApi.queryDeviceAlarmList = async (_, id) => { scopes.push(id); return [] }
  iotDeviceDetailRealApi.getDeviceDetail = (async id => {
    detailCalls++
    return { result: { id, productId: 'product-1', metadata: { properties: [property] } } }
  })
  const host = mapApiDevice({ id: 'device-1', productId: 'product-1', metadata: { properties: [property] } }, 'project-1')
  const service = createDeviceDetailAgentService(host)
  try {
    const detail = await service.propertyRules({ propertyId: 'temperature', deviceId: 'intruder', productId: 'intruder' })
    assert.equal(detailCalls, 0)
    const global = await devicePropertyRulesService.propertyRules({ deviceId: 'device-1', productId: 'intruder', propertyId: 'temperature' })
    assert.equal(detailCalls, 1)
    assert.deepEqual(detail.data, global.data)
    assert.deepEqual(scopes, ['product-1', 'device-1', 'product-1', 'device-1'])
    for (const tools of [createDeviceDetailAgentTools(service), createDeviceAnalysisTools().map(factory => factory.build())]) {
      const tool = tools.find(item => item.id === 'device_property_rules_get')
      assert.ok(tool)
      const serialized = toAiClientToolSessionDefinition(tool)
      assert.equal(tool.annotations?.readOnlyHint, true)
      assert.ok(JSON.stringify(serialized).includes('subject.property.rules.read'))
      assert.ok(JSON.stringify(serialized).includes('property.rules'))
    }
  } finally {
    service.dispose()
    deviceAlarmApi.queryProductAlarmList = originalProduct
    deviceAlarmApi.queryDeviceAlarmList = originalDevice
    deviceAlarmApi.queryDefaultAlarmLevels = originalLevels
    iotDeviceDetailRealApi.getDeviceDetail = originalDetail
  }
})
