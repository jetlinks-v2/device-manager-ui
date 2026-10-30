import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availableRuleParts, buildRule, isEmptyRule, parseRule, replaceAlarm, validateDraft, type RuleDraft } from '../views/device/components/PropertyRules/codec'
import { buildPreprocessPayload, createEmptyNotification, formatPropertyUnit, getAlarmMatcher, getAlarmProcessor, getNotifyProcessor, toDeviceAlarmRow } from '../views/device/alarm/utils'
import type { ThingPropertyPreprocess } from '../views/device/alarm/types'
import { saveRule, restoreRule, loadRules } from '../views/device/components/PropertyRules/service'
import { setAlarmRequestHandler } from './alarmRequest.test-shim'
import { summarizeDraft, summarizeDraftRows, summarizeRule, summarizeRuleRows, type RuleTranslator } from '../views/device/components/PropertyRules/summary'
import zh from '../locales/lang/zh.json'
import { buildRuleExample, createRuleExampleInputs, validateRuleExampleInputs } from '../views/device/components/PropertyRules/diagram'
import { MAX_INTERVAL_MILLIS, readSampling } from '../views/device/components/PropertyRules/sampling'
import { buildCondition, conditionsOverlap, conditionOperators, matchesCondition, readCondition, switchConditionOperator, validateAlarmConditions } from '../views/device/alarm/conditions'
import type { DeviceAlarmCondition } from '../views/device/alarm/types'
import { invalidRecordDescription } from '../views/device/components/PropertyRules/invalidRecord'
import en from '../locales/lang/en.json'

const translate: RuleTranslator = (key, values = {}) => {
  const text = (zh as Record<string, string>)[key]
  assert.ok(text, `Missing translation: ${key}`)
  return text.replace(/\{(\w+)\}/g, (_match, name) => String(values[name]))
}

function draft(): RuleDraft {
  return {
    valuesEnabled: true, valuesMode: 'ignore', values: [-9999], rangeEnabled: true, min: -40, max: 120,
    alarmEnabled: true, alarm: { name: 'Temperature', source: 'product', targetId: 'p1', productId: 'p1', property: 'temperature',
      level: 2, trigger: 'outside', limit: { lower: 0, upper: 80 }, autoRelieve: false, notification: createEmptyNotification() },
    samplingEnabled: true, ...readSampling(), scaleEnabled: false, scale: '1', fileEnabled: false,
  }
}

test('invalid data recording is opt-in and preserved through rule and alarm edits', () => {
  const current = draft()
  const legacy = buildRule(parseRule(), current)
  assert.equal(legacy.configuration.recordInvalid, undefined)
  current.recordInvalid = true
  const saved = buildRule(parseRule(legacy), current)
  assert.equal(saved.configuration.recordInvalid, true)
  assert.equal(parseRule(saved).editable, true)
  assert.deepEqual(buildRule(parseRule(saved), current), saved)
  assert.equal(replaceAlarm(saved, { ...current.alarm, name: 'Renamed' }).configuration.recordInvalid, true)
  current.recordInvalid = false
  assert.equal(buildRule(parseRule(saved), current).configuration.recordInvalid, undefined)
})

test('recording applies only to rejecting cleaning stages and not corrections or sampling', () => {
  const current = draft()
  current.recordInvalid = true
  current.valuesMode = 'replace'; current.replacementValue = 0; current.rangeAction = 'clamp'
  assert.equal(buildRule(parseRule(), current).configuration.recordInvalid, undefined)
  assert.ok(summarizeDraftRows(current, {}, translate).every(row => !row.recordInvalid))
  current.valuesMode = 'keep'
  const rows = summarizeDraftRows(current, {}, translate)
  assert.deepEqual(rows.filter(row => row.recordInvalid).map(row => row.key), ['values'])
  current.valuesEnabled = false; current.rangeEnabled = false
  current.stepEnabled = true; current.maxStep = 1; current.baselineTtl = 300000
  assert.equal(buildRule(parseRule(), current).configuration.recordInvalid, true)
  assert.deepEqual(summarizeRuleRows(parseRule(buildRule(parseRule(), current)), {}, translate)
    .filter(row => row.recordInvalid).map(row => row.key), ['step'])
})

test('invalid recording preview marks only the stage that actually discards each value', () => {
  const current = draft()
  current.recordInvalid = true
  const example = buildRuleExample(current, { valueType: { type: 'double' } }, [-9999, 121, 10]
    .map(value => ({ value, arrivalMillis: 0 })))
  assert.deepEqual(example.map(point => point.stages.filter(stage => stage.recordInvalid).map(stage => stage.key)), [['values'], ['range'], []])
  current.recordInvalid = false
  assert.ok(buildRuleExample(current, { valueType: { type: 'double' } }).every(point => point.stages.every(stage => !stage.recordInvalid)))
})

test('unknown or nested recording settings remain read-only without losing saved content', () => {
  const current = draft()
  const saved = buildRule(parseRule(), current)
  for (const value of ['true', 1, null]) {
    const raw = structuredClone(saved)
    raw.configuration.recordInvalid = value
    assert.equal(parseRule(raw).editable, false)
  }
  const raw = structuredClone(saved)
  raw.configuration.processors[0].configuration.recordInvalid = true
  assert.equal(parseRule(raw).editable, false)
  assert.equal(parseRule(raw).raw, raw)
})

test('invalid data reasons translate at display time and legacy descriptions remain intact', () => {
  for (const messages of [zh, en]) {
    const t: RuleTranslator = key => (messages as Record<string, string>)[key]
    for (const reason of ['value-set', 'number-range', 'max-step']) {
      const record = { detail: { reason, valueTruncated: true }, description: 'old language' }
      assert.equal(invalidRecordDescription(record, t), `${t(`PropertyRules.invalidReason.${reason}`)} · ${t('PropertyRules.invalidValueTruncated')}`)
    }
    assert.equal(invalidRecordDescription({ description: 'Legacy custom text' }, t), 'Legacy custom text')
    assert.equal(invalidRecordDescription({ detail: { reason: 'extension' }, description: 'Custom rule' }, t), 'Custom rule')
    assert.equal(invalidRecordDescription({ detail: 'invalid', description: 'Legacy text' }, t), 'Legacy text')
  }
})

test('recovery notification shares recipients and channels and survives full-chain save/read', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  current.alarm.notification = { enabled: true, includeRelieve: true, userIds: ['u1'], channelProviders: ['inbox'], parameters: {} }
  const saved = buildRule(parseRule(), current)
  assert.equal(parseRule(saved).editable, true)
  const loaded = toDeviceAlarmRow(saved, 'product', 'Product')!
  assert.equal(loaded.notification.includeRelieve, true)
  assert.deepEqual(buildRule(parseRule(saved), { ...current, alarm: loaded }), saved)
  const alarm = parseRule(saved).nodes.alarm!
  const [trigger, recovery] = alarm.configuration.processors
  assert.deepEqual(recovery.configuration.processors[1].configuration,
    { ...trigger.configuration.processors[1].configuration, event: 'relieve', topicProvider: 'alarm-device-relieve' })
  recovery.configuration.processors[1].configuration.userIds = ['someone-else']
  assert.equal(parseRule(saved).editable, false)
})

test('recovery notification is opt-in and follows automatic recovery and notification enablement', () => {
  const form = draft().alarm
  form.notification = { enabled: true, userIds: ['u1'], channelProviders: ['inbox'], parameters: {} }
  form.autoRelieve = true
  const optedOut = buildPreprocessPayload(form)
  assert.equal(optedOut.configuration.processors[1].configuration.processors.length, 1)
  form.notification.includeRelieve = true
  form.notification.enabled = false
  const disabled = buildPreprocessPayload(form)
  assert.equal(disabled.configuration.processors[1].configuration.processors[1].configuration.enabled, false)
  assert.equal(toDeviceAlarmRow(disabled, 'product', 'Product')?.notification.includeRelieve, true)
  form.autoRelieve = false
  const manual = buildPreprocessPayload(form)
  assert.equal(manual.provider, 'simple')
  assert.equal(getNotifyProcessor(manual)?.configuration.includeRelieve, false)
})

test('persisted shared recovery template and exact channels round trip without silent migration', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  current.alarm.notification = { enabled: true, includeRelieve: true, userIds: ['u1'], channelProviders: ['notifier-email'],
    notifyChannelIds: ['legacy-channel'], parameters: { 'notifier-email': { templateId: 'legacy-template', notifierId: 'sender' } } }
  const saved = buildPreprocessPayload(current.alarm)
  const recovery = saved.configuration.processors[1].configuration.processors[1].configuration
  delete recovery.topicProvider
  const original = JSON.stringify(saved)
  const loaded = toDeviceAlarmRow(saved, 'product', 'Product')!
  assert.ok(loaded)
  assert.equal(loaded.notification.relieveTopicProvider, 'alarm-device')
  assert.deepEqual(buildPreprocessPayload(loaded), saved)
  assert.equal(JSON.stringify(saved), original)
  recovery.topicProvider = 'another-provider'
  assert.equal(parseRule(saved).editable, false)
})

test('simple numeric conditions preserve all comparison boundaries and reject invalid values', () => {
  const expected = { gt: [false, false, true], gte: [false, true, true], lt: [true, false, false], lte: [true, true, false], eq: [false, true, false], neq: [true, false, true] }
  for (const [operator, matches] of Object.entries(expected)) {
    const condition: DeviceAlarmCondition = { trigger: operator as DeviceAlarmCondition['trigger'], value: 80, limit: {} }
    assert.deepEqual([79, 80, 81].map(value => matchesCondition(condition, value)), matches)
    assert.equal(matchesCondition(condition, null), false)
    assert.equal(matchesCondition(condition, NaN), false)
    assert.deepEqual(readCondition(buildCondition(condition)), condition)
  }
})

test('typed scalar alarm conditions retain false, zero and empty strings', () => {
  for (const value of [false, 0, '', '0']) {
    const current = draft().alarm
    current.trigger = 'eq'; current.value = value; current.limit = {}
    const saved = buildPreprocessPayload(current)
    const loaded = toDeviceAlarmRow(saved, 'product', 'Product')!
    assert.equal(loaded.value, value)
    assert.equal(matchesCondition(loaded, value), true)
    assert.equal(matchesCondition(loaded, value === 0 ? '0' : 0), false)
    assert.equal(parseRule(saved).editable, true)
  }
  assert.deepEqual(conditionOperators({ valueType: { type: 'boolean' } }), ['eq', 'neq'])
  assert.ok(availableRuleParts({ valueType: { type: 'string' } }, {}, true).some(item => item === 'alarm'))
  const model = { ...draft().alarm, trigger: 'in' as const, values: [1], limit: {} }
  assert.equal(validateAlarmConditions(model, { valueType: { type: 'enum', elements: [{ value: '1', text: 'One' }] } }), 'DeviceAlarm.validation.condition')
})

test('custom recovery round trips and leaves the neutral band without an action', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.samplingEnabled = false
  Object.assign(current.alarm, { trigger: 'gte', value: 80, limit: {}, autoRelieve: true,
    relieveCondition: { trigger: 'lte', value: 75, limit: {} } })
  assert.equal(validateAlarmConditions(current.alarm), undefined)
  const saved = buildRule(parseRule(), current)
  const loaded = toDeviceAlarmRow(saved, 'product', 'Product')!
  assert.deepEqual(loaded.relieveCondition, current.alarm.relieveCondition)
  assert.equal(parseRule(saved).editable, true)
  assert.deepEqual(buildRuleExample(current, { valueType: { type: 'double' } }, [75, 76, 79, 80].map(value => ({ value, arrivalMillis: 0 })))
    .map(point => point.stages[0].status), ['recovered', 'kept', 'kept', 'alarm'])
  current.alarm.relieveCondition!.value = 80
  assert.equal(validateAlarmConditions(current.alarm), 'DeviceAlarm.validation.overlap')
})

test('condition intersection respects open endpoints and inverse scalar sets', () => {
  const a: DeviceAlarmCondition = { trigger: 'gt', value: 80, limit: {} }
  assert.equal(conditionsOverlap(a, { trigger: 'lte', value: 80, limit: {} }), false)
  assert.equal(conditionsOverlap(a, { trigger: 'lt', value: 81, limit: {} }), true)
  assert.equal(conditionsOverlap({ ...a, trigger: 'gte' }, { trigger: 'lte', value: 80, limit: {} }), true)
  assert.equal(conditionsOverlap({ trigger: 'neq', value: false, limit: {} }, { trigger: 'neq', value: true, limit: {} }), false)
  assert.equal(conditionsOverlap({ trigger: 'nin', values: ['fault'], limit: {} }, { trigger: 'nin', values: ['good'], limit: {} }), true)
})

test('operator changes retain meaningful selections without keeping hidden parameters', () => {
  for (const value of [false, 0, '', 'fault']) {
    const set = switchConditionOperator({ trigger: 'eq', value, limit: {} }, 'in')
    assert.deepEqual(set.values, [value])
    assert.equal(set.value, undefined)
    assert.equal(switchConditionOperator(set, 'neq').value, value)
  }
  const single = switchConditionOperator({ trigger: 'inside', limit: { lower: 0, upper: 100 } }, 'gte')
  assert.deepEqual(single.limit, {})
  assert.equal(single.value, undefined)
})

test('changing alarm matcher removes obsolete keys and preserves actions, extensions and history identity', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  const saved = buildRule(parseRule(), current)
  const unit = parseRule(saved).nodes.alarm!
  unit.configuration.processors.forEach((branch: any, i: number) => {
    branch.configuration.matcher.configuration.extension = 'keep'
    branch.configuration.processors[0].id = `action-${i}`
  })
  Object.assign(current.alarm, { trigger: 'gte', value: 80, limit: {}, relieveCondition: { trigger: 'lte', value: 75, limit: {} } })
  const changed = buildRule(parseRule(saved), current)
  const branches = parseRule(changed).nodes.alarm!.configuration.processors
  assert.deepEqual(branches[0].configuration.matcher, { provider: 'number-compare', configuration: { operator: 'gte', value: 80, extension: 'keep' } })
  assert.equal(branches[0].configuration.processors[0].id, 'action-0')
  assert.equal(branches[1].configuration.processors[0].id, 'action-1')
  assert.deepEqual(parseRule(changed).nodes.sampling, parseRule(saved).nodes.sampling)
})

test('integer diagrams retain raw replacement and clamp values until calibration', () => {
  const property = { valueType: { type: 'int' } }
  for (const mode of ['replace', 'clamp']) {
    const current = draft()
    current.valuesMode = 'replace'; current.values = [-999]; current.replacementValue = 2.5
    current.valuesEnabled = mode === 'replace'; current.rangeEnabled = true
    current.rangeAction = mode === 'clamp' ? 'clamp' : 'ignore'
    current.min = mode === 'clamp' ? 2.5 : 2.4; current.max = 2.6
    current.scaleEnabled = true; current.scale = '2'
    current.alarmEnabled = current.samplingEnabled = false
    const point = buildRuleExample(current, property, [{ value: -999, arrivalMillis: 0 }])[0]
    assert.equal(point.filtered, false)
    assert.equal(point.stages.find(stage => stage.key === 'range')?.value, '2.5')
    assert.equal(point.stages.find(stage => stage.key === 'scale')?.value, '5')
  }
})

test('integer diagrams do not overflow a raw replacement before calibration', () => {
  const current = draft()
  current.valuesMode = 'replace'; current.values = [-999]; current.replacementValue = 2500000000
  current.scaleEnabled = true; current.scale = '0.1'
  current.rangeEnabled = current.alarmEnabled = current.samplingEnabled = false
  const point = buildRuleExample(current, { valueType: { type: 'int' } }, [{ value: -999, arrivalMillis: 0 }])[0]
  assert.equal(point.stages.find(stage => stage.key === 'values')?.value, '2500000000')
  assert.equal(point.stages.find(stage => stage.key === 'scale')?.value, '250000000')
})

test('canonical automatic relief remains one editable alarm unit inside a property chain', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  const original = buildPreprocessPayload(current.alarm)
  const parsed = parseRule(original)
  assert.equal(parsed.editable, true)
  assert.equal(parsed.nodes.alarm?.provider, 'composite')
  const result = buildRule(parsed, current)
  assert.equal(parseRule(result).editable, true)
  assert.equal(toDeviceAlarmRow(result, 'product', 'Product')?.autoRelieve, true)
  assert.equal(getAlarmMatcher(result)?.configuration.max, 80)
})

test('alarm updates preserve relief identity and unrelated preprocessing', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  const original = buildRule(parseRule(), current)
  const previous = parseRule(original)
  const [alarm, relieve] = previous.nodes.alarm!.configuration.processors
  alarm.configuration.processors[0].configuration.alarmId = 'existing-alarm'
  relieve.configuration.processors[0].configuration.alarmId = 'existing-relief'
  relieve.configuration.matcher.configuration.extension = 'retained'
  const result = replaceAlarm(original, { ...current.alarm, name: 'Updated', limit: { lower: 10, upper: 90 } })
  const next = parseRule(result)
  assert.deepEqual(next.nodes.values, previous.nodes.values)
  assert.deepEqual(next.nodes.range, previous.nodes.range)
  assert.deepEqual(next.nodes.sampling, previous.nodes.sampling)
  const [updatedAlarm, updatedRelieve] = next.nodes.alarm!.configuration.processors
  assert.equal(updatedAlarm.configuration.processors[0].configuration.alarmId, 'existing-alarm')
  assert.equal(updatedRelieve.configuration.processors[0].configuration.alarmId, 'existing-relief')
  assert.equal(updatedRelieve.configuration.matcher.configuration.extension, 'retained')
  assert.equal(updatedAlarm.configuration.matcher.configuration.max, 90)
  assert.equal(updatedRelieve.configuration.matcher.configuration.max, 90)
  assert.equal(updatedRelieve.configuration.matcher.configuration.not, false)
  assert.equal(toDeviceAlarmRow(result, 'product', 'Product')?.autoRelieve, true)
})

test('disabling or removing automatic relief keeps the other property rules', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  const original = buildRule(parseRule(), current)
  const disabled = replaceAlarm(original, { ...current.alarm, autoRelieve: false })
  assert.equal(parseRule(disabled).nodes.alarm?.provider, 'simple')
  assert.equal(toDeviceAlarmRow(disabled, 'product', 'Product')?.autoRelieve, false)
  const removed = replaceAlarm(original)
  assert.equal(parseRule(removed).nodes.alarm, undefined)
  assert.deepEqual(parseRule(removed).nodes.sampling, parseRule(original).nodes.sampling)
  assert.equal(JSON.stringify(removed).includes('device-alarm-relieve'), false)
})

test('unknown relief matchers remain read-only', () => {
  const current = draft()
  current.alarm.autoRelieve = true
  const raw = buildPreprocessPayload(current.alarm)
  raw.configuration.processors[1].configuration.matcher.provider = 'unknown'
  assert.equal(parseRule(raw).editable, false)
})

test('finite enum recovery can be edited without losing the metadata domain', () => {
  const form = draft().alarm
  Object.assign(form, { trigger: 'neq', value: 'fault', limit: {}, autoRelieve: true,
    relieveCondition: { trigger: 'neq', value: 'normal', limit: {} } })
  const property = { valueType: { type: 'enum', elements: [{ value: 'fault' }, { value: 'normal' }] } }
  assert.equal(validateAlarmConditions(form, property), undefined)
  const saved = buildPreprocessPayload(form)
  assert.equal(parseRule(saved).editable, true)
  assert.deepEqual(toDeviceAlarmRow(saved, 'product', '', property)?.relieveCondition, form.relieveCondition)
})

test('cleaning uses raw-value labels while alarm and sampling retain calibrated units', () => {
  const current = { ...draft(), scaleEnabled: true, scale: '0.1', stepEnabled: true, maxStep: 10,
    baselineTtl: 300000, samplingMode: 'change' as const, deadband: 2 }
  const property = { valueType: { type: 'double', unit: '%' } }
  const rows = summarizeDraftRows(current, property, translate)
  assert.match(rows.find(row => row.key === 'range')!.sentence, /原值/)
  assert.match(rows.find(row => row.key === 'step')!.sentence, /10 原值/)
  assert.doesNotMatch(rows.find(row => row.key === 'step')!.sentence, /10%/)
  assert.match(rows.find(row => row.key === 'range')!.notice!, /校正前/)
  assert.match(rows.find(row => row.key === 'alarm')!.sentence, /%/)
  assert.match(rows.find(row => row.key === 'sampling')!.sentence, /2个百分点/)
  const direct = summarizeDraftRows({ ...current, scaleEnabled: false }, property, translate)
  assert.match(direct.find(row => row.key === 'step')!.sentence, /10个百分点/)
})

test('percentage points distinguish absolute changes from relative changes and retention ratios', () => {
  for (const messages of [zh, en]) {
    const t: RuleTranslator = (key, values = {}) => (messages as Record<string, string>)[key]
      .replace(/\{(\w+)\}/g, (_match, name) => String(values[name]))
    for (const unit of ['%', 'percent', formatPropertyUnit({ id: 'percent' })]) {
      const property = { valueType: { type: 'double', unit } }
      const current = { ...draft(), stepEnabled: true, maxStep: 10, baselineTtl: 300000,
        samplingMode: 'change' as const, deadband: 10 }
      const rows = summarizeRuleRows(parseRule(buildRule(parseRule(), current)), property, t)
      const points = t('PropertyRules.percentagePoints')
      assert.ok(rows.find(row => row.key === 'step')!.sentence.includes(`10${points}`))
      assert.ok(rows.find(row => row.key === 'sampling')!.sentence.includes(`10${points}`))
      assert.ok(rows.find(row => row.key === 'alarm')!.sentence.endsWith('%'))
      assert.ok(rows.find(row => row.key === 'range')!.sentence.endsWith('%'))
      const relative = summarizeDraftRows({ ...current, deadbandType: 'percent', deadband: 50 }, property, t)
        .find(row => row.key === 'sampling')!
      assert.ok(relative.sentence.includes(t('PropertyRules.sentence.relativeChange')))
      assert.ok(relative.sentence.includes('50%'))
      assert.ok(!relative.sentence.includes(points))
      const ratio = summarizeDraftRows({ ...current, samplingMode: 'ratio', percent: 10 }, property, t)
        .find(row => row.key === 'sampling')!
      assert.ok(ratio.sentence.includes('10%'))
      assert.ok(!ratio.sentence.includes(points))
      const raw = summarizeDraftRows({ ...current, scaleEnabled: true, scale: '0.1' }, property, t)
      assert.ok(raw.find(row => row.key === 'step')!.sentence.includes(t('PropertyRules.rawValue')))
      assert.ok(!raw.find(row => row.key === 'step')!.sentence.includes(points))
      assert.ok(raw.find(row => row.key === 'sampling')!.sentence.includes(`10${points}`))
    }
  }
})

test('raw replacement can be calibrated into the model range and diagram hides display tails', () => {
  const current = { ...draft(), valuesMode: 'replace' as const, replacementValue: 250, rangeEnabled: false,
    scaleEnabled: true, scale: '0.1', alarmEnabled: false, samplingEnabled: false }
  const property = { valueType: { type: 'double', min: 0, max: 100 } }
  assert.equal(validateDraft(current, true), undefined)
  const raw = buildRule(parseRule(), current)
  assert.equal(parseRule(raw).nodes.values!.configuration.processors[0].configuration.value, 250)
  assert.equal(buildRuleExample(current, property, [{ value: -9999, arrivalMillis: 0 }])[0].label, '25')
  const points = buildRuleExample({ ...current, replacementValue: 19, samplingEnabled: true, samplingMode: 'change', deadband: 0 }, property,
    [{ value: -9999, arrivalMillis: 0 }, { value: -9999, arrivalMillis: 1000 }])
  assert.deepEqual(points.map(point => point.label), ['1.9', '1.9'])
  assert.equal(points[1].stages.find(stage => stage.key === 'sampling')!.baseline, '1.9')
  assert.equal(points[1].sampled, true)
  const integer = 1234567890123456
  assert.equal(buildRuleExample({ ...current, valuesEnabled: false, scaleEnabled: false }, property,
    [{ value: integer, arrivalMillis: 0 }])[0].label, String(integer))
})

test('fallback round-trips opt-ins and removes optional fixed value without losing extensions', () => {
  const current = { ...draft(), fallbackEnabled: true, fallbackMode: 'previous' as const, fallbackMaxAge: 300000,
    fallbackValue: 0, fallbackMissing: true, fallbackEmpty: false }
  const raw = buildRule(parseRule(), current)
  const node = parseRule(raw).nodes.fallback!
  assert.deepEqual({ ...node.configuration }, { mode: 'previous', maxAgeMillis: 300000, value: 0, includeEmpty: false, includeMissing: true })
  node.configuration.custom = 'keep'
  const updated = buildRule({ ...parseRule(raw), nodes: { ...parseRule(raw).nodes, fallback: node } }, { ...current, fallbackValue: null })
  assert.equal(parseRule(updated).nodes.fallback!.configuration.value, undefined)
  assert.equal(parseRule(updated).nodes.fallback!.configuration.custom, 'keep')
  assert.equal(validateDraft({ ...current, fallbackMaxAge: 0 }, true), 'PropertyRules.validation.fallback')
  assert.equal(validateDraft({ ...current, fallbackMode: 'fixed', fallbackValue: false, valuesEnabled: false, rangeEnabled: false, alarmEnabled: false }, false), undefined)
  assert.equal(parseRule({ provider: 'fallback', configuration: { mode: 'previous' } }).editable, false)
})

test('fallback bypasses raw cleaning and calibration, retains age and skips alarms', () => {
  const current = { ...draft(), scaleEnabled: true, scale: '0.1', fallbackEnabled: true, fallbackMode: 'previous' as const,
    fallbackMaxAge: 300000, fallbackValue: 9, samplingEnabled: false }
  const inputs = [null, null, null].map((value, index) => ({ value, arrivalMillis: index * 200000 }))
  const points = buildRuleExample(current, { valueType: { type: 'double' } }, inputs, { value: 100, time: -1000, outcome: 'ready' })
  assert.deepEqual(points.map(p => p.label), ['100', '100', '9'])
  assert.ok(points.every(p => !p.alarm))
  assert.equal(points[0].stages[2].status, 'skipped')
  assert.equal(points[0].stages[2].skipReason, 'missing')
  assert.equal(points[0].stages[4].skipReason, 'filled')
  assert.equal(points[1].stages[3].elapsedMillis, 201000)
  const failure = buildRuleExample(current, { valueType: { type: 'double' } }, inputs, { value: 100, time: -1000, outcome: 'error' })
  assert.ok(failure.every(p => p.label === '9'))
  const dropped = buildRuleExample(current, { valueType: { type: 'double' } }, [{ value: -9999, arrivalMillis: 0 }])
  assert.equal(dropped[0].filtered, true)
  assert.equal(dropped[0].stages[3].status, 'skipped')
  assert.equal(dropped[0].stages[3].skipReason, undefined)
  const absent = [{ value: null, missing: true, arrivalMillis: 0 }]
  assert.equal(buildRuleExample(current, { valueType: { type: 'double' } }, absent)[0].filtered, true)
  assert.equal(buildRuleExample({ ...current, fallbackMissing: true }, { valueType: { type: 'double' } }, absent)[0].label, '9')
})

test('replacement, clamp and offset are represented losslessly and simulated in order', () => {
  const current = { ...draft(), valuesMode: 'replace' as const, replacementValue: 19, min: 0, max: 20,
    rangeAction: 'clamp' as const, scaleEnabled: true, scale: '0.1', offset: '0.2', alarmEnabled: false, samplingEnabled: false }
  const raw = buildRule(parseRule(), current)
  assert.equal(parseRule(raw).editable, true)
  assert.equal(parseRule(raw).nodes.scale!.provider, 'calibration')
  assert.equal(parseRule(raw).nodes.range!.configuration.processors[0].provider, 'clamp')
  const points = buildRuleExample(current, { valueType: { type: 'int' } }, [-9999, 120].map(value => ({ value, arrivalMillis: 0 })))
  assert.deepEqual(points.map(p => p.label), ['2', '2'])
  assert.deepEqual(points[0].stages.map(s => s.status), ['processed', 'kept', 'processed'])
  assert.equal(validateDraft({ ...current, replacementValue: null }, true), 'PropertyRules.validation.replacement')
  assert.ok(summarizeDraft(current, { valueType: { type: 'int' } }, translate)[0].text.includes('→ 19'))
})

test('maximum silence is change OR elapsed time and optional removal drops the saved field', () => {
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false,
    samplingMode: 'change' as const, deadband: 5, maxSilence: 10000 }
  const raw = buildRule(parseRule(), current)
  const parsed = parseRule(raw)
  assert.equal(parsed.editable, true)
  assert.equal(parsed.nodes.sampling!.provider, 'change-sampling-timed')
  assert.equal(readSampling(parsed.nodes.sampling).maxSilence, 10000)
  const input = [100, 104, 104, 109, 109].map((value, i) => ({ value, arrivalMillis: [0, 9000, 10000, 11000, 20000][i] }))
  const points = buildRuleExample(current, { valueType: { type: 'double' } }, input)
  assert.deepEqual(points.map(p => p.sampled), [false, true, false, false, true])
  const removed = parseRule(buildRule(parsed, { ...current, maxSilence: null })).nodes.sampling!
  assert.equal(removed.provider, 'change-sampling')
  assert.equal(removed.configuration.maxSilenceMillis, undefined)
  assert.equal(validateDraft({ ...current, maxSilence: 0 }, true), 'PropertyRules.validation.maxSilence')
})

test('maximum step uses pre-calibration baseline and rejected inputs do not refresh its age', () => {
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false, samplingEnabled: false,
    stepEnabled: true, maxStep: 5, baselineTtl: 10000, scaleEnabled: true, scale: '0.1' }
  const raw = buildRule(parseRule(), current)
  assert.equal(parseRule(raw).editable, true)
  assert.deepEqual(raw.configuration!.processors.map((node: { provider: string }) => node.provider), ['max-step', 'scale'])
  const inputs = [100, 200, 105, 200, 200].map((value, i) => ({ value, arrivalMillis: [0, 1000, 2000, 11000, 12000][i] }))
  const points = buildRuleExample(current, { valueType: { type: 'double' } }, inputs)
  assert.deepEqual(points.map(p => p.filtered), [false, true, false, true, false])
  assert.deepEqual(points.filter(p => !p.filtered).map(p => Number(p.label)), [10, 10.5, 20])
  assert.equal(validateDraft({ ...current, baselineTtl: null }, true), 'PropertyRules.validation.step')
  assert.equal(summarizeRuleRows(parseRule(raw), { valueType: { type: 'double' } }, translate)[0].key, 'step')
})

test('fixed sequence serializes percentage and round-trips every section', () => {
  const raw = buildRule(parseRule(), draft())
  const parsed = parseRule(raw)
  assert.equal(parsed.editable, true)
  assert.deepEqual(raw.configuration?.processors.map((node: { provider: string }) => node.provider), ['simple', 'simple', 'simple', 'ratio-sampling'])
  assert.equal(parsed.nodes.sampling?.configuration.ratio, 0.1)
  assert.equal(getAlarmMatcher(raw)?.configuration.min, 0)
  assert.equal(getAlarmProcessor(raw)?.configuration.alarmName, 'Temperature')
})

test('direct add menus offer only applicable missing rules and respect alarm availability', () => {
  assert.deepEqual(availableRuleParts({ valueType: { type: 'double' } }, { sampling: true }, true), ['values', 'range', 'step', 'scale', 'fallback', 'alarm'])
  assert.deepEqual(availableRuleParts({ valueType: { type: 'double' } }, {}, false), ['values', 'range', 'step', 'scale', 'fallback', 'sampling', 'interval', 'change'])
  assert.deepEqual(availableRuleParts({ valueType: { type: 'boolean' } }, {}, true), ['values', 'fallback', 'alarm', 'sampling', 'interval', 'change'])
  assert.deepEqual(availableRuleParts({ valueType: { type: 'object' } }, {}, true), ['sampling', 'interval'])
  assert.ok(availableRuleParts({ valueType: { type: 'file', bodyType: 'base64' } }, {}, true).includes('file'))
  assert.ok(!availableRuleParts({ valueType: { type: 'file', bodyType: 'url' } }, {}, true).includes('file'))
})

test('multiplier preserves decimal text and extensions; later alarm and deadband see its output', () => {
  const current = draft()
  Object.assign(current, { valuesEnabled: false, rangeEnabled: false, scaleEnabled: true, scale: '0.1000000000000000000001',
    samplingMode: 'change', deadband: 1 })
  current.alarm.limit = { lower: 0, upper: 1.5 }
  const raw = buildRule(parseRule(), current)
  assert.deepEqual(raw.configuration!.processors.map((node: { provider: string }) => node.provider), ['scale', 'simple', 'change-sampling'])
  raw.configuration!.processors[0].configuration.extension = 'keep'
  const parsed = parseRule(raw)
  assert.equal(parsed.editable, true)
  assert.equal(buildRule(parsed, current).configuration!.processors[0].configuration.scale, '0.1000000000000000000001')
  assert.equal(buildRule(parsed, current).configuration!.processors[0].configuration.extension, 'keep')
  const points = buildRuleExample(current, { valueType: { type: 'double' } }, [10, 14, 20].map(value => ({ value, arrivalMillis: 0 })))
  assert.deepEqual(points.map(point => point.alarm), [false, false, true])
  assert.deepEqual(points.map(point => point.sampled), [false, true, false])
  assert.deepEqual(points.map(point => point.label), ['1', '1.4', '2'])
  assert.equal(points[2].stages[2].baseline, '1')
  for (const scale of ['0', '-0.5', '1e-3']) assert.equal(validateDraft({ ...current, scale }, true), undefined)
  for (const scale of ['', 'Infinity', '0x10', '1e400', null]) assert.equal(validateDraft({ ...current, scale }, true), 'PropertyRules.validation.scale')
  assert.equal(validateDraft(current, false), 'PropertyRules.validation.scale')
  const integer = buildRuleExample({ ...current, scale: '0.1' }, { valueType: { type: 'int' } }, [{ value: 19, arrivalMillis: 0 }])
  assert.equal(integer[0].label, '1')
})

test('file chains sample before storage, preserve URL values and never reorder legacy upload-first chains', () => {
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false, fileEnabled: true, percent: 50 }
  const raw = buildRule(parseRule(), current)
  assert.deepEqual(raw.configuration!.processors.map((node: { provider: string }) => node.provider), ['ratio-sampling', 'file-storage'])
  assert.equal(parseRule(raw).editable, true)
  const property = { valueType: { type: 'file', bodyType: 'base64' } }
  const points = buildRuleExample(current, property)
  assert.equal(points[0].stages[1].status, 'processed')
  assert.equal(points[1].stages[1].status, 'skipped')
  assert.equal(points[2].stages[1].status, 'kept')
  assert.equal(points[2].label, 'https://example.invalid/file-3')
  assert.deepEqual(summarizeRuleRows(parseRule(raw), property, translate).map(row => row.key), ['sampling', 'file'])
  const uploadFirst = { provider: 'composite', configuration: { processors: [...raw.configuration!.processors].reverse() } }
  assert.equal(parseRule(uploadFirst).editable, false)
  assert.throws(() => buildRule(parseRule(uploadFirst), current), /PropertyRules.readonly/)
  assert.equal(parseRule({ provider: 'file-storage', configuration: {} }).editable, true)
  assert.equal(validateDraft({ ...current, scaleEnabled: true }, false), 'PropertyRules.validation.scale')
})

test('interval examples measure elapsed arrival time from the last admitted value after cleaning', () => {
  const current = { ...draft(), valuesEnabled: false, min: 0, max: 100, scaleEnabled: true, scale: '0.1', samplingMode: 'interval' as const }
  const values = [-1, 12, 65, 95, 50]
  const times = [0, 4000, 11000, 12000, 14000]
  const points = buildRuleExample(current, { valueType: { type: 'double' } }, values.map((value, i) => ({ value, arrivalMillis: times[i] })))
  assert.equal(points[0].filtered, true)
  assert.deepEqual(points.slice(1).map(point => point.sampled), [false, true, true, false])
  assert.equal(points[2].stages[3].elapsedMillis, 7000)
  assert.equal(points[3].stages[3].elapsedMillis, 8000)
  assert.equal(points[4].stages[3].elapsedMillis, 10000)
})

test('non-scalar examples match property types without reading live values', () => {
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false }
  assert.ok(Array.isArray(createRuleExampleInputs(current, { valueType: { type: 'array' } })[0].value))
  assert.equal(typeof createRuleExampleInputs(current, { valueType: { type: 'object' } })[0].value, 'object')
  assert.match(String(createRuleExampleInputs(current, { valueType: { type: 'date' } })[0].value), /^2026-/)
  assert.equal(createRuleExampleInputs(current, { valueType: { type: 'password' } })[0].value, '•••')
})

test('editing and deleting alarm preserve cleaning, sampling, extensions and history identity', () => {
  const raw = buildRule(parseRule(), draft())
  Object.assign(raw, { id: 'stable-config', i18nMessages: { en: { name: 'temperature' } }, extension: { value: 1 } })
  raw.configuration!.extension = { supported: false }
  const before = structuredClone(raw)
  const form = draft().alarm
  form.name = 'High temperature'
  const updated = replaceAlarm(raw, form)
  assert.equal(updated.id, 'stable-config')
  assert.deepEqual(updated.configuration?.extension, raw.configuration?.extension)
  assert.deepEqual((updated as Record<string, unknown>).i18nMessages, (raw as Record<string, unknown>).i18nMessages)
  const removed = replaceAlarm(updated)
  assert.equal(getAlarmProcessor(removed), undefined)
  assert.deepEqual(parseRule(removed).nodes.values, parseRule(before).nodes.values)
  assert.deepEqual(parseRule(removed).nodes.range, parseRule(before).nodes.range)
  assert.deepEqual(parseRule(removed).nodes.sampling, parseRule(before).nodes.sampling)
  assert.deepEqual(raw, before)
})

test('legacy simple alarm keeps record actions and unknown fields when explicitly wrapped', () => {
  const raw: ThingPropertyPreprocess = buildPreprocessPayload(draft().alarm)
  raw.configuration!.processors.push({ provider: 'device-record', configuration: { type: 'alarm', custom: true } })
  raw.configuration!.matcher.configuration.extension = 'kept'
  raw.configuration!.processors[0].configuration.extension = 'also kept'
  const updated = replaceAlarm(raw, draft().alarm)
  assert.equal(updated.provider, 'composite')
  assert.equal(getAlarmMatcher(updated)?.configuration.extension, 'kept')
  assert.equal(getAlarmProcessor(updated)?.configuration.extension, 'also kept')
  assert.equal(parseRule(updated).nodes.alarm?.configuration.processors[1].configuration.custom, true)
  assert.equal(isEmptyRule(replaceAlarm(updated)), true)
})

test('notification lookup follows the alarm step, and disabling it removes only that action', () => {
  const form = draft().alarm
  form.notification = { enabled: true, userIds: ['u1'], channelProviders: ['inbox'], parameters: {} }
  const raw = replaceAlarm(undefined, form)
  assert.deepEqual(getNotifyProcessor(raw)?.configuration.userIds, ['u1'])
  form.notification.enabled = false
  const updated = replaceAlarm(raw, form)
  // Existing disabled-channel settings are retained by the alarm form for re-enabling.
  assert.equal(getNotifyProcessor(updated)?.configuration.enabled, false)
  assert.ok(getAlarmProcessor(updated))
})

test('unsupported, duplicated and reordered chains are read-only and never overwritten', () => {
  for (const raw of [
    { provider: 'script', configuration: { script: 'return value' } },
    { provider: 'composite', configuration: { processors: [buildPreprocessPayload(draft().alarm), buildPreprocessPayload(draft().alarm)] } },
    { provider: 'composite', configuration: { processors: [{ provider: 'ratio-sampling', configuration: { ratio: 0.1 } }, buildPreprocessPayload(draft().alarm)] } },
    { provider: 'simple', configuration: { matcher: { provider: 'custom', configuration: {} }, processors: [] } },
  ]) {
    assert.equal(parseRule(raw).editable, false)
    assert.throws(() => replaceAlarm(raw, draft().alarm), /PropertyRules.readonly/)
  }
})

test('empty composite is distinct from absence and can be persisted as a device override', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.alarmEnabled = current.samplingEnabled = false
  const empty = buildRule(parseRule(), current)
  assert.equal(isEmptyRule(empty), true)
  assert.equal(parseRule(empty).editable, true)
  assert.deepEqual(empty.configuration?.processors, [])
})

test('invalid drafts reject non-finite values, string numeric sentinels and reversed bounds', () => {
  const current = draft()
  assert.equal(validateDraft(current, true), undefined)
  current.percent = null
  assert.equal(validateDraft(current, true), 'PropertyRules.validation.percent')
  current.percent = 10
  current.values = ['65535']
  assert.equal(validateDraft(current, true), 'PropertyRules.validation.values')
  current.values = [65535]
  current.max = -41
  assert.equal(validateDraft(current, true), 'PropertyRules.validation.range')
  current.rangeEnabled = false
  current.alarmEnabled = false
  assert.equal(validateDraft(current, false), undefined)
})

test('clear product deletes; clear device persists empty override; restore alone deletes device', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  setAlarmRequestHandler(async (url, body) => { calls.push({ url, body }); return { result: [] } })
  const empty = { provider: 'composite', configuration: { processors: [] } }
  await saveRule({ productId: 'p1' }, 'temp', empty)
  await saveRule({ productId: 'p1', deviceId: 'd1' }, 'temp', empty)
  await restoreRule({ productId: 'p1', deviceId: 'd1' }, 'temp')
  assert.deepEqual(calls.map(call => call.body.method), ['DELETE', 'PUT', 'DELETE'])
  assert.equal(calls[0].url, '/message/preprocessor/product/p1/property/temp')
  assert.equal(calls[1].url, '/message/preprocessor/device/p1/d1/property/temp')
  assert.deepEqual(calls[1].body.configuration, { processors: [] })
})

test('raw reads distinguish device absence from an explicit empty override and propagate failures', async () => {
  const empty = { property: 'temp', provider: 'composite', configuration: { processors: [] } }
  setAlarmRequestHandler(async (url) => ({ result: url.includes('/p1/d1/') ? [empty] : [{ ...buildRule(parseRule(), draft()), property: 'temp' }] }))
  const rules = await loadRules({ productId: 'p1', deviceId: 'd1' }, 'temp')
  assert.equal(isEmptyRule(rules.device[0]), true)
  assert.equal(isEmptyRule(rules.product[0]), false)
  setAlarmRequestHandler(async () => { throw new Error('unavailable') })
  await assert.rejects(() => loadRules({ productId: 'p1', deviceId: 'd1' }), /unavailable/)
})

test('saved and draft summaries describe actual bounds, alarm direction, units and keep ratio consistently', () => {
  const current = draft()
  const property = { valueType: { type: 'double', unit: 'celsius' } }
  const saved = summarizeRule(parseRule(buildRule(parseRule(), current)), property, translate)
  assert.deepEqual(saved, summarizeDraft(current, property, translate))
  assert.deepEqual(saved.map(step => step.text), ['忽略 -9999 · 有效范围 -40～120℃', '超出 0～80℃ 时告警', '约保留 10%'])
  current.alarm.trigger = 'inside'
  assert.equal(summarizeDraft(current, property, translate)[1].text, '在 0～80℃ 内时告警')
  current.percent = 0.29 * 100
  assert.equal(summarizeDraft(current, property, translate)[2].text, '约保留 29%')
})

test('rule sentences preserve processing order, exact enum identities and threshold meanings', () => {
  const current = draft()
  current.values = [1, '1', false, 'other']
  current.percent = 0
  const property = { valueType: { elements: [{ value: 1, text: '数字一' }, { value: '1', text: '字符串一' }] } }
  const rows = summarizeRuleRows(parseRule(buildRule(parseRule(), current)), property, translate)
  assert.deepEqual(rows.map(row => row.key), ['values', 'range', 'alarm', 'sampling'])
  assert.deepEqual(rows.map(row => row.sentence), [
    '值为 数字一、字符串一、false… 时 忽略', '保留 -40～120', '超出 0～80', '约保留 0%',
  ])
  current.alarm.trigger = 'inside'
  current.valuesEnabled = current.rangeEnabled = current.samplingEnabled = false
  const alarmOnly = summarizeRuleRows(parseRule(buildRule(parseRule(), current)), {}, translate)
  assert.deepEqual(alarmOnly.map(row => row.key), ['alarm'])
  assert.equal(alarmOnly[0].sentence, '处于 0～80')
})

test('state lifetimes and silence remain part of the same readable condition', () => {
  const property = { valueType: { type: 'double', unit: 'celsius' } }
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false,
    stepEnabled: true, maxStep: 5, baselineTtl: 300000, fallbackEnabled: true, fallbackMode: 'previous' as const,
    fallbackMaxAge: 60000, fallbackValue: 20, samplingMode: 'change' as const, deadband: 0, maxSilence: 10000 }
  const rows = summarizeRuleRows(parseRule(buildRule(parseRule(), current)), property, translate)
  assert.equal(rows[0].sentence, '与 300 秒 内的上次保留值相比，差值 ≤ 5℃ 时保留')
  assert.equal(rows[0].details, undefined)
  assert.equal(rows[1].sentence, '空值 时取 60 秒 内的 上一值 无可用值时取 20℃')
  assert.equal(rows[1].details, undefined)
  assert.equal(rows[2].sentence, '差值 > 0℃ 时保留 · 或间隔 10 秒')
  assert.equal(rows[2].details, undefined)
  const changed = summarizeRuleRows(parseRule(buildRule(parseRule(), { ...current, deadband: 5, maxSilence: null })), property, translate)
  assert.equal(changed[2].sentence, '差值 ≥ 5℃ 时保留')
  const relative = summarizeRuleRows(parseRule(buildRule(parseRule(), { ...current, deadbandType: 'percent' })), property, translate)
  assert.equal(relative[2].sentence, '相对变化 > 0% 时保留 · 或间隔 10 秒')
})

test('fallback sentences expose active conditions and preserve zero, false, empty and enum values', () => {
  const current = { ...draft(), valuesEnabled: false, rangeEnabled: false, alarmEnabled: false, samplingEnabled: false,
    fallbackEnabled: true, fallbackMode: 'fixed' as const, fallbackValue: 0, fallbackMissing: true }
  const row = (value: Parameters<typeof summarizeDraftRows>[0], property: Parameters<typeof summarizeDraftRows>[1]) => summarizeDraftRows(value, property, translate)[0]
  assert.equal(row(current, { valueType: { type: 'double', unit: 'percent' } }).sentence, '空值 / 未上报 时取 指定值 0%')
  assert.equal(row({ ...current, fallbackValue: false }, { valueType: { type: 'boolean' } }).sentence, '空值 / 未上报 时取 指定值 false')
  assert.equal(row({ ...current, fallbackValue: '', fallbackEmpty: true }, { valueType: { type: 'string' } }).sentence, '空值 / 空字符串 / 未上报 时取 指定值 ""')
  assert.equal(row({ ...current, fallbackValue: 1 }, { valueType: { type: 'enum', elements: [{ value: 1, text: '启动' }] } }).sentence, '空值 / 未上报 时取 指定值 启动')
  const previous = row({ ...current, fallbackMode: 'previous', fallbackValue: null, fallbackMaxAge: 60000 }, { valueType: { type: 'double' } })
  assert.equal(previous.sentence, '空值 / 未上报 时取 60 秒 内的 上一值')
  assert.equal(previous.details, undefined)
})

test('summary distinguishes disabled rules, incomplete inputs and zero-percent sampling', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.alarmEnabled = current.samplingEnabled = false
  const off = summarizeDraft(current, {}, translate)
  assert.ok(off.every(step => !step.enabled))
  assert.equal(off[2].text, '全量保留，不抽样')
  current.valuesEnabled = current.rangeEnabled = current.samplingEnabled = true
  current.values = []
  current.min = undefined
  current.percent = null
  assert.deepEqual(summarizeDraft(current, {}, translate).map(step => step.text), ['待填写值集合 · 待填写有效上下限', '关闭', '待填写保留比例'])
  current.percent = 0
  assert.equal(summarizeDraft(current, {}, translate)[2].text, '约保留 0%')
})

test('value summaries use enum labels, preserve scalar identity and abbreviate long lists', () => {
  const current = draft()
  current.rangeEnabled = false
  current.values = [false, 'false', '', 1]
  const property = { valueType: { type: 'enum', elements: [{ value: false, text: '关闭' }] } }
  const summary = summarizeDraft(current, property, translate)[0].text
  assert.equal(summary, '忽略 关闭、"false"、"" 等 4 个值')
})

test('diagram applies cleaning before alarm; alarm is independent of later sampling', () => {
  const current = draft()
  current.values = [-999]
  current.min = 0
  current.max = 100
  current.alarm.limit = { lower: 10, upper: 90 }
  current.percent = 0
  const points = buildRuleExample(current, { valueType: { type: 'double' } })
  assert.deepEqual(points.map(point => point.filtered), [true, false, false, false, true])
  assert.deepEqual(points.map(point => point.alarm), [false, false, false, true, false])
  assert.ok(points.filter(point => !point.filtered).every(point => point.sampled))
  assert.deepEqual(points[0].stages, [
    { key: 'values', status: 'filtered' }, { key: 'range', status: 'skipped' },
    { key: 'alarm', status: 'skipped' }, { key: 'sampling', status: 'skipped' },
  ])
  assert.deepEqual(points[3].stages, [
    { key: 'values', status: 'kept' }, { key: 'range', status: 'kept' },
    { key: 'alarm', status: 'alarm' }, { key: 'sampling', status: 'filtered' },
  ], 'an alarm side effect occurs even when sampling later discards the sample')
  current.percent = 100
  assert.ok(buildRuleExample(current, { valueType: { type: 'double' } }).every(point => !point.sampled))
  current.alarm.trigger = 'inside'
  current.alarm.limit = { lower: 12, upper: 65 }
  assert.deepEqual(buildRuleExample(current, { valueType: { type: 'double' } }).map(point => point.alarm), [false, true, true, false, false])
})

test('diagram preserves boolean identity and never converts non-numeric properties into alarm values', () => {
  const current = draft()
  current.rangeEnabled = current.samplingEnabled = false
  current.values = [false]
  const points = buildRuleExample(current, { valueType: { type: 'boolean' } })
  assert.deepEqual(points.map(point => point.filtered), [false, true, false, true, false])
  assert.ok(points.every(point => !point.alarm))
})

test('allowlists preserve typed values and matcher extensions without rebuilding alarm actions', () => {
  const current = draft()
  current.valuesMode = 'keep'
  current.values = [false, 'false', 0, '0']
  const raw = buildRule(parseRule(), current)
  const matcher = raw.configuration!.processors[0].configuration.matcher
  matcher.configuration.extension = 'retained'
  const parsed = parseRule(raw)
  assert.equal(parsed.editable, true)
  assert.equal(parsed.nodes.values?.configuration.matcher.configuration.not, true)
  const updated = replaceAlarm(raw, { ...current.alarm, name: 'Updated' })
  assert.deepEqual(parseRule(updated).nodes.values, parsed.nodes.values)
  current.valuesMode = 'ignore'
  const changed = buildRule(parsed, current)
  assert.equal(parseRule(changed).nodes.values?.configuration.matcher.configuration.not, false)
  assert.equal(parseRule(changed).nodes.values?.configuration.matcher.configuration.extension, 'retained')
  assert.equal(summarizeDraft({ ...current, valuesMode: 'keep', rangeEnabled: false }, {}, translate)[0].text, '仅保留 false、"false"、0 等 4 个值')
})

test('all single report strategies round-trip with exact intervals, defaults and preserved extensions', () => {
  const current = draft()
  for (const node of [
    { provider: 'ratio-sampling', configuration: { ratio: 1e-15, extension: true } },
    { provider: 'interval-sampling', configuration: { intervalMillis: 777, extension: true } },
    { provider: 'interval-sampling', configuration: { intervalMillis: 120000, extension: true } },
    { provider: 'change-sampling', configuration: { deadband: 150, deadbandType: 'percent', extension: true } },
    { provider: 'change-sampling', configuration: { extension: true } },
  ]) {
    const raw = { ...buildRule(parseRule(), current) }
    raw.configuration!.processors[3] = node
    const parsed = parseRule(raw)
    assert.equal(parsed.editable, true)
    const loaded = { ...current, ...readSampling(parsed.nodes.sampling) }
    const saved = parseRule(buildRule(parsed, loaded)).nodes.sampling!
    assert.equal(saved.provider, node.provider)
    assert.equal(saved.configuration.extension, true)
    for (const [key, value] of Object.entries(node.configuration)) assert.deepEqual(saved.configuration[key], value)
    assert.deepEqual(parseRule(replaceAlarm(raw, { ...current.alarm, name: 'Updated' })).nodes.sampling, parsed.nodes.sampling)
  }
  assert.equal(readSampling({ provider: 'interval-sampling', configuration: { intervalMillis: 777 } }).intervalUnit, 1)
  assert.deepEqual([readSampling({ provider: 'interval-sampling', configuration: { intervalMillis: 120000 } }).interval, readSampling({ provider: 'interval-sampling', configuration: { intervalMillis: 120000 } }).intervalUnit], [2, 60000])
})

test('switching report strategies replaces old parameters and never appends a second sampler', () => {
  const current = draft()
  const raw = buildRule(parseRule(), current)
  current.samplingMode = 'interval'
  current.interval = 1.5
  current.intervalUnit = 1000
  const interval = buildRule(parseRule(raw), current)
  assert.deepEqual(parseRule(interval).nodes.sampling?.configuration, { intervalMillis: 1500 })
  current.samplingMode = 'change'
  current.deadband = 0.5
  const changed = buildRule(parseRule(interval), current)
  assert.deepEqual(parseRule(changed).nodes.sampling?.configuration, { deadband: 0.5, deadbandType: 'absolute' })
  assert.equal(changed.configuration!.processors.length, 4)
  assert.deepEqual(parseRule(changed).nodes.alarm, parseRule(raw).nodes.alarm)
})

test('multiple samplers, misplaced stages and malformed new providers remain read-only', () => {
  for (const processors of [
    [{ provider: 'interval-sampling', configuration: { intervalMillis: 10 } }, { provider: 'change-sampling', configuration: {} }],
    [{ provider: 'change-sampling', configuration: {} }, buildPreprocessPayload(draft().alarm)],
    [{ provider: 'interval-sampling', configuration: { intervalMillis: 0 } }],
    [{ provider: 'interval-sampling', configuration: { intervalMillis: MAX_INTERVAL_MILLIS + 1 } }],
    [{ provider: 'change-sampling', configuration: { deadband: -1 } }],
    [{ provider: 'change-sampling', configuration: { deadbandType: 'unknown' } }],
  ]) {
    const raw = { provider: 'composite', configuration: { processors } }
    assert.equal(parseRule(raw).editable, false)
    assert.throws(() => replaceAlarm(raw), /PropertyRules.readonly/)
  }
})

test('interval and deadband validation follows backend units and scalar restrictions', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.alarmEnabled = false
  current.samplingMode = 'interval'
  current.intervalUnit = 1
  for (const value of [null, 0, -1, 0.5, Infinity, MAX_INTERVAL_MILLIS + 1]) {
    current.interval = value
    assert.equal(validateDraft(current, true), 'PropertyRules.validation.interval')
  }
  current.interval = MAX_INTERVAL_MILLIS
  assert.equal(validateDraft(current, false), undefined)
  current.interval = 0.001
  current.intervalUnit = 1000
  assert.equal(validateDraft(current, false), undefined)
  current.samplingMode = 'change'
  current.deadbandType = 'percent'
  current.deadband = 150
  assert.equal(validateDraft(current, true), undefined, 'percent deadband is not a retention ratio')
  assert.equal(validateDraft(current, false), 'PropertyRules.validation.deadband')
  current.deadband = 0
  assert.equal(validateDraft(current, false), undefined)
  for (const value of [null, -1, Infinity, NaN]) {
    current.deadband = value
    assert.equal(validateDraft(current, true), 'PropertyRules.validation.deadband')
  }
})

test('stateful diagrams use first admission time and the last retained value after cleaning', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.alarmEnabled = false
  current.samplingMode = 'interval'
  const interval = buildRuleExample(current, { valueType: { type: 'double' } })
  assert.deepEqual(interval.map(point => point.arrival), [0, 4, 11, 12, 22])
  assert.deepEqual(interval.map(point => point.sampled), [false, true, false, true, false])
  current.samplingMode = 'change'
  current.deadband = 1
  const changed = buildRuleExample(current, { valueType: { type: 'double' } })
  assert.deepEqual(changed.map(point => point.sampled), [false, true, true, false, false])
  assert.deepEqual(changed.map(point => point.baseline), [undefined, '10', '10', '10', '11'])
  current.valuesEnabled = true
  current.valuesMode = 'keep'
  current.values = [false]
  current.deadband = 0
  const kept = buildRuleExample(current, { valueType: { type: 'boolean' } })
  assert.deepEqual(kept.map(point => point.filtered), [true, false, true, false, true])
  assert.deepEqual(kept.map(point => point.sampled), [false, false, false, true, false])
})

test('manual trial values and arrival times drive every node without reading device state', () => {
  const current = draft()
  current.valuesEnabled = current.rangeEnabled = current.alarmEnabled = false
  current.samplingMode = 'interval'
  current.interval = 10
  current.intervalUnit = 1000
  const inputs = [0, 1000, 10000, 19000, 20000].map((arrivalMillis, value) => ({ value, arrivalMillis }))
  const interval = buildRuleExample(current, { valueType: { type: 'double' } }, inputs)
  assert.deepEqual(interval.map(point => point.sampled), [false, true, false, true, false])
  current.samplingMode = 'change'
  current.deadband = 1
  const changed = buildRuleExample(current, { valueType: { type: 'double' } }, [10, 10.4, 10.8, 11, 11.3].map(value => ({ value, arrivalMillis: 0 })))
  assert.deepEqual(changed.map(point => point.sampled), [false, true, true, false, true])
  assert.equal(changed[2].stages[0].baseline, '10')
  assert.equal(changed[4].stages[0].baseline, '11')
  assert.equal(validateRuleExampleInputs([{ value: null, arrivalMillis: 0 }], true, false), 'PropertyRules.diagram.invalidValue')
  assert.equal(validateRuleExampleInputs([{ value: 1, arrivalMillis: -1 }], true, true), 'PropertyRules.diagram.invalidArrival')
  assert.equal(validateRuleExampleInputs(inputs.map((input, index) => ({ ...input, arrivalMillis: index === 1 ? 30000 : input.arrivalMillis })), true, true), 'PropertyRules.diagram.invalidArrival')
  assert.deepEqual(createRuleExampleInputs(current, { valueType: { type: 'boolean' } }).map(input => input.value), [true, false, true, false, true])
})

test('generated examples reflect configured ranges and business allowlists', () => {
  const current = draft()
  current.min = 1000
  current.max = 2000
  const property = { valueType: { type: 'double' } }
  const ranged = createRuleExampleInputs(current, property)
  assert.ok(ranged.some(input => Number(input.value) >= 1000 && Number(input.value) <= 2000))
  assert.ok(ranged.some(input => Number(input.value) > 2000))
  current.valuesMode = 'keep'
  current.values = [1500, 1600]
  const whitelisted = buildRuleExample(current, property)
  assert.ok(whitelisted.some(point => !point.filtered), 'an allowlist example includes values that can reach later stages')
  current.rangeEnabled = false
  current.values = ['RUNNING', 'STOPPED']
  const strings = createRuleExampleInputs(current, { valueType: { type: 'string' } })
  assert.ok(strings.some(input => input.value === 'RUNNING'))
  assert.ok(strings.some(input => typeof input.value === 'string' && !current.values.includes(input.value)))
})

test('new saved strategy summaries match loaded drafts and display exact units', () => {
  const current = draft()
  current.samplingMode = 'interval'
  current.interval = 777
  current.intervalUnit = 1
  const raw = buildRule(parseRule(), current)
  assert.equal(summarizeRuleRows(parseRule(raw), {}, translate)[3].sentence, '相隔 777 毫秒 才保留下一值')
  assert.deepEqual(summarizeRule(parseRule(raw), { valueType: { type: 'double' } }, translate), summarizeDraft(current, { valueType: { type: 'double' } }, translate))
  current.samplingMode = 'change'
  current.deadband = 150
  current.deadbandType = 'percent'
  assert.equal(summarizeDraft(current, { valueType: { type: 'double' } }, translate)[2].text, '与上次保留值的变化达到 150% 才保留')
})
