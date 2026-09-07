import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRequest, defaultForm, toForm, toMultiTriggerForm } from '../views/scene-linkage/utils.ts'

export const aiSceneFixture = {
  id: 'ai-scene-person-detection',
  name: '人员识别场景',
  children: [
    { value: 'PersonDetection', text: '人员检测' },
    { value: 'VehicleDetection', text: '车辆检测' },
  ],
}

export const aiAggregateTaskFixture = {
  id: 'ai-aggregate-task-001',
  name: '园区入口复判任务',
  sceneId: aiSceneFixture.id,
  taskTargets: [
    { value: 'PersonDetection', text: '人员检测' },
  ],
}

export const aiVideoScopeFixture = {
  id: 'ai-video-scope-001',
  aggregateTaskId: aiAggregateTaskFixture.id,
  deviceId: 'media-device-gate-1',
  channelId: 'media-channel-gate-1',
  sourceName: '园区入口摄像头',
}

export const assertAiEventRule = (rule: Record<string, any>, condition: Record<string, any>) => {
  assert.equal(rule.trigger?.type, 'ai-event')
  assert.deepEqual(rule.branches?.[0]?.when, [condition])
}

test('serializes an AI event range and its single recognition condition into branch when', () => {
  const form = defaultForm()
  form.triggerKind = 'ai-event'
  form.aiEvent = {
    sceneId: aiSceneFixture.id,
    sceneName: aiSceneFixture.name,
    taskTarget: 'PersonDetection',
    taskTargetName: '人员检测',
    mediaTargets: [{
      deviceId: aiVideoScopeFixture.deviceId,
      channelId: aiVideoScopeFixture.channelId,
      name: aiVideoScopeFixture.sourceName,
    }],
    condition: { column: 'hitResults', termType: 'eq', value: 1 },
  }

  const rule = buildRequest(form)

  assertAiEventRule(rule, { column: 'hitResults', termType: 'eq', value: 1 })
  assert.deepEqual(rule.trigger.configuration, {
    sceneId: aiSceneFixture.id,
    taskTarget: 'PersonDetection',
    mediaTargets: [{
      deviceId: aiVideoScopeFixture.deviceId,
      channelId: aiVideoScopeFixture.channelId,
    }],
  })
})

test('keeps branch when empty when an AI-event rule has no result condition', () => {
  const form = defaultForm()
  form.triggerKind = 'ai-event'
  form.aiEvent = {
    sceneId: aiSceneFixture.id,
    taskTarget: 'PersonDetection',
    mediaTargets: [],
  }

  const rule = buildRequest(form)

  assert.deepEqual(rule.branches?.[0]?.when, [])
  assert.equal(toForm(rule).aiEvent.condition, undefined)
})

test('round-trips AI-event conditions including explicit empty-value semantics', () => {
  const conditions = [
    { column: 'maxTargetScore', termType: 'lt', value: 60 },
    { column: 'results', termType: 'like', value: '禁止通行' },
    { column: 'numberResults', termType: 'gte', value: 3 },
    { column: 'targetCount', termType: 'gte', value: 2 },
    { column: 'hitResults', termType: 'isnull', value: undefined },
    { column: 'results', termType: 'isnull', value: undefined },
  ] as const

  conditions.forEach((condition) => {
    const form = defaultForm()
    form.triggerKind = 'ai-event'
    form.aiEvent = {
      sceneId: aiSceneFixture.id,
      taskTarget: 'PersonDetection',
      mediaTargets: [],
      condition: { ...condition },
    }

    const rule = buildRequest(form)
    assertAiEventRule(rule, condition)
    assert.deepEqual(toForm(rule).aiEvent.condition, condition)
  })
})

test('round-trips visual AI alarm selection without persisting editor-only sourceKind', () => {
  const form = defaultForm()
  form.triggerKind = 'alarm'
  form.alarm = {
    sourceKind: 'visual-ai',
    targetType: 'aiTaskMediaTarget',
    alarmConfigId: aiAggregateTaskFixture.id,
    modes: ['relieve'],
    options: {
      sceneId: aiSceneFixture.id,
      sceneName: aiSceneFixture.name,
      taskTarget: 'PersonDetection',
      taskTargetName: '人员检测',
      alarmConfigName: aiAggregateTaskFixture.name,
    },
  }

  const rule = buildRequest(form)
  const restored = toForm(rule)

  assert.equal(rule.trigger.configuration.sourceKind, undefined)
  assert.equal(rule.trigger.configuration.bizId, undefined)
  assert.deepEqual(rule.branches[0].when, [{
    column: 'bizId',
    termType: 'eq',
    value: `${aiSceneFixture.id}-PersonDetection`,
  }])
  assert.equal(restored.alarm.sourceKind, 'visual-ai')
  assert.equal(restored.alarm.options?.taskTarget, 'PersonDetection')
})

test('keeps AI-event leaves independent in a multi-trigger rule without a dedicated shake limit', () => {
  const form = defaultForm()
  form.triggerKind = 'ai-event'
  form.aiEvent = {
    sceneId: aiSceneFixture.id,
    taskTarget: 'PersonDetection',
    mediaTargets: [],
  }
  const timer = toMultiTriggerForm(form)
  timer.triggerKind = 'interval'
  timer.interval = 15
  timer.intervalUnit = 'minutes'
  form.multiTriggers = [toMultiTriggerForm(form), timer]

  const rule = buildRequest(form)

  assert.equal(rule.trigger.type, 'multi')
  assert.equal(rule.trigger.multi.triggers[0].trigger.type, 'ai-event')
  assert.equal(rule.trigger.multi.triggers[1].trigger.type, 'timer')
  assert.equal(rule.branches[0].shakeLimit.enabled, false)
  assert.equal(Object.prototype.hasOwnProperty.call(rule.trigger.multi.triggers[0].trigger.configuration, 'shakeLimit'), false)
  assert.deepEqual(rule.trigger.multi.triggers[0].terms, [])
})
