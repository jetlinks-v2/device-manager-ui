import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compactCvMetrics,
  compactMBeanAttributes,
  compactMonitorMetricAttributes,
  compactReviewMetrics,
  dropJvmRuntimeNoise,
  isReviewAbnormalTask,
  readAiMetricsFromMBeanData,
  toCompactAiSide,
} from '../views/device/list/agent/deviceDetailEdgeAi.summary.ts'
import { EDGE_DIAGNOSIS_TOOL_IDS, isEdgeDiagnosisToolId } from '../views/device/list/agent/deviceDetailEdge.shared.ts'
import { createDeviceDetailEdgeTools } from '../views/device/list/agent/deviceDetailEdge.tools.ts'
import { createDeviceDetailAgentTools } from '../views/device/list/agent/deviceDetailAgent.tools.ts'
import { createDeviceDetailAgentWorkflows } from '../views/device/list/agent/deviceDetailAgent.workflows.ts'

const detailService = new Proxy({}, {
  get: () => async () => ({}),
}) as any

const createReviewTasks = (count: number) => Array.from({ length: count }, (_, index) => ({
  threadId: `thread-${String(index).padStart(3, '0')}`,
  reviewSourceId: `src-${index}`,
  status: index < 8 ? 'failed' : 'completed',
  reviewStatus: index < 3 ? 'llm_failed' : 'ok',
  partialFailure: index === 4,
  routedSkill: 'parking_review',
  hit: index === 50 ? 0 : 1,
  resultSummary: `summary-${index}-${'x'.repeat(200)}`,
  samples: [{ t: index, v: index }],
}))

test('100 review tasks compact to histograms and at most 5 abnormal samples', () => {
  const tasks = createReviewTasks(100)
  const compact = compactReviewMetrics({
    collectedAt: '2026-09-15T00:00:00Z',
    samples: Array.from({ length: 30 }, (_, index) => ({ t: index, pending: index })),
    statistics: {
      backlogCount: 12,
      runningCount: 2,
      activeCount: 3,
      completedCount: 80,
      failedCount: 8,
      queueStatus: 'overloaded',
      duration: { averageMs: 40, p95Ms: 90, sampleCount: 20 },
      byTask: [{ failedCount: 99 }],
    },
    queues: {
      parking_review: {
        pending: 9,
        running: 2,
        workers: 4,
        overloaded: true,
        rejectedTotal: 3,
        maxBacklog: 16,
        lastRejectReason: `queue-full-${'y'.repeat(200)}`,
      },
    },
    taskQuery: { limit: 100, count: 100, scanned: 100, reviewCount: 100 },
    tasks,
  })

  assert.ok(compact)
  assert.equal(compact.abnormal.length, 5)
  assert.equal(compact.byStatus.failed, 8)
  assert.equal(compact.byStatus.completed, 92)
  assert.equal(compact.byReviewStatus.llm_failed, 3)
  assert.equal(compact.statistics.failedCount, 8)
  assert.equal(compact.queues.parking_review.pending, 9)
  assert.ok(String(compact.queues.parking_review.lastRejectReason).endsWith('...'))
  assert.ok(String(compact.abnormal[0]?.resultSummary).length <= 163)
  assert.equal(isReviewAbnormalTask(tasks[50]), false)

  const json = JSON.stringify(compact)
  assert.doesNotMatch(json, /"samples"\s*:/)
  assert.doesNotMatch(json, /"tasks"\s*:/)
  assert.doesNotMatch(json, /"byTask"\s*:/)
  const echoed = tasks.filter(task => json.includes(`"threadId":"${task.threadId}"`))
  assert.ok(echoed.length <= 5)
  assert.equal(json.includes('thread-050'), false)
  assert.equal(json.includes('thread-099'), false)
})

test('CV compact output drops samples and reviewTaskBindings', () => {
  const compact = compactCvMetrics({
    collectedAt: '2026-09-15T00:00:00Z',
    samples: Array.from({ length: 9 }, (_, index) => ({ t: index, fps: index })),
    reviewTaskBindings: [{ task_key: 'cam-1' }, { task_key: 'cam-2' }],
    notFound: Array.from({ length: 8 }, (_, index) => `missing-${index}`),
    tasks: [
      {
        task_key: 'cam-ok',
        status: 'running',
        running_time: 12,
        inference_total: 100,
        hit_total: 8,
        slot_reject_total: 0,
        latency_p95: 30,
        diagnostics: { status: 'ok' },
      },
      {
        task_key: 'cam-fault',
        status: 'failed',
        running_time: 4,
        inference_total: 3,
        hit_total: 0,
        slot_reject_total: 2,
        diagnostics: {
          status: 'failed',
          status_reason: 'decoder',
          last_error_stage: 'infer',
          last_error_message: `boom-${'z'.repeat(200)}`,
          task_fault_node: 'n1',
          task_fault_reason: 'oom',
        },
      },
    ],
  })

  assert.ok(compact)
  assert.equal(compact.taskCount, 2)
  assert.equal(compact.notFoundCount, 8)
  assert.deepEqual(compact.notFoundIds, ['missing-0', 'missing-1', 'missing-2', 'missing-3', 'missing-4'])
  assert.equal(compact.highlights.length, 1)
  assert.equal(compact.highlights[0]?.taskKey, 'cam-fault')
  assert.ok(String(compact.highlights[0]?.diagnostics?.lastErrorMessage).endsWith('...'))

  const json = JSON.stringify(compact)
  assert.doesNotMatch(json, /"samples"\s*:/)
  assert.doesNotMatch(json, /"reviewTaskBindings"\s*:/)
  assert.doesNotMatch(json, /"tasks"\s*:/)
})

test('missing AI MBean side stays ok=false and does not fake zero tasks', () => {
  const missing = toCompactAiSide(undefined, { message: 'mbean missing' })
  assert.equal(missing.ok, false)
  if (missing.ok) throw new Error('expected missing side')
  assert.equal(missing.error.message, 'mbean missing')
  assert.equal('taskCount' in missing, false)
  assert.equal('abnormal' in missing, false)
  assert.equal(compactReviewMetrics(undefined), undefined)
  assert.equal(compactCvMetrics(null), undefined)
})

test('MonitorMetric attributes and JVM runtime noise stay compacted', () => {
  const attributes = compactMonitorMetricAttributes('AgentRuntimeReview', {
    Metrics: {
      samples: [{ t: 1 }],
      tasks: createReviewTasks(20),
      statistics: { failedCount: 8 },
    },
  })
  const json = JSON.stringify(attributes)
  assert.equal(attributes.Metrics?.abnormal.length, 5)
  assert.doesNotMatch(json, /"samples"\s*:/)
  assert.doesNotMatch(json, /"tasks"\s*:/)

  const runtime = dropJvmRuntimeNoise('Runtime', 'java.lang:type=Runtime', {
    ClassPath: '/secret/app.jar',
    SystemProperties: { user: 'edge' },
    InputArguments: ['-Xmx'],
    Uptime: 12,
  })
  assert.deepEqual(runtime, { Uptime: 12 })

  const monitor = compactMBeanAttributes('MonitorMetric', 'ZLMediaAiTask', {
    Metrics: {
      samples: [{ t: 1 }],
      reviewTaskBindings: [{ id: 'bind-1' }],
      tasks: [{ task_key: 'cam-1', status: 'failed' }],
    },
  })
  const monitorJson = JSON.stringify(monitor)
  assert.doesNotMatch(monitorJson, /"samples"\s*:/)
  assert.doesNotMatch(monitorJson, /"reviewTaskBindings"\s*:/)

  const nested = readAiMetricsFromMBeanData({
    'org.jetlinks': {
      MonitorMetric: {
        AgentRuntimeReview: {
          Metrics: {
            samples: [{ t: 1 }],
            tasks: createReviewTasks(12),
            statistics: { failedCount: 8 },
          },
        },
      },
    },
  })
  const nestedCompact = compactReviewMetrics(nested)
  assert.equal(nestedCompact?.abnormal.length, 5)
  assert.doesNotMatch(JSON.stringify(nestedCompact), /"tasks"\s*:/)
  assert.equal(readAiMetricsFromMBeanData({ Uptime: 12, ClassPath: '/secret' }), undefined)
})

test('edge_ai_runtime_summary is mounted with the existing provider gate', () => {
  assert.ok(EDGE_DIAGNOSIS_TOOL_IDS.includes('edge_ai_runtime_summary'))
  const tools = createDeviceDetailEdgeTools(detailService)
  assert.equal(tools.some(tool => tool.id === 'edge_ai_runtime_summary'), true)
  const compiled = tools.find(tool => tool.id === 'edge_ai_runtime_summary')?._meta?.clientToolDefinition
  assert.equal(compiled?.effect, 'READ')
  assert.ok(Number(compiled?.outputCount) > 0)

  assert.equal(
    createDeviceDetailAgentTools(detailService, { accessProvider: 'mqtt' })
      .some(tool => tool.id === 'edge_ai_runtime_summary'),
    false,
  )
  assert.equal(
    createDeviceDetailAgentTools(detailService, { accessProvider: 'agent-device-gateway' })
      .some(tool => tool.id === 'edge_ai_runtime_summary'),
    true,
  )

  const guides = createDeviceDetailAgentWorkflows(true)
  const aiGuide = guides.find(item => item.id === 'edge-ai-runtime-diagnosis')
  assert.ok(aiGuide)
  for (const step of aiGuide?.steps || []) {
    if (typeof step === 'string') continue
    assert.ok(step.capability)
    assert.equal(step.tools, undefined)
  }

  for (const id of EDGE_DIAGNOSIS_TOOL_IDS) {
    assert.equal(isEdgeDiagnosisToolId(id), true, id)
  }
  assert.equal(isEdgeDiagnosisToolId('edge_ai_runtime_summary'), true)
  assert.equal(isEdgeDiagnosisToolId('device_open_tab'), false)
})
