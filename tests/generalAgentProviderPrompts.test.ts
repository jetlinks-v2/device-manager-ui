import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('device landing prompts stay directly executable while detail remains a runtime example', () => {
  const provider = readFileSync(
    'agentCapabilities/deviceAnalysis/generalAgentProvider.ts',
    'utf8',
  )
  const landingExamples = provider.slice(
    provider.indexOf('const getDeviceLandingPromptExamples'),
    provider.indexOf('export const iotDeviceAnalysisGeneralAgentProvider'),
  )
  const detailCapability = provider.slice(
    provider.indexOf("id: 'device:instance-detail'"),
    provider.indexOf('...(overviewMenu'),
  )

  assert.match(landingExamples, /IotGeneralAgent\.prompts\.overview/)
  assert.match(landingExamples, /IotGeneralAgent\.prompts\.offline/)
  assert.match(provider, /metadata: \{ promptExamples: getDeviceLandingPromptExamples\(\) \}/)
  assert.doesNotMatch(detailCapability, /promptExamples/)
  assert.match(
    provider,
    /getPromptExamples:[\s\S]*?getDeviceLandingPromptExamples\(\)[\s\S]*?IotGeneralAgent\.prompts\.property[\s\S]*?IotGeneralAgent\.prompts\.openDetail/,
  )
})

test('device runtime analysis keeps its ordered core evidence required', () => {
  const provider = readFileSync(
    'agentCapabilities/deviceAnalysis/generalAgentProvider.ts',
    'utf8',
  )
  const workflow = provider.slice(
    provider.indexOf("id: 'device-runtime-analysis'"),
    provider.indexOf("id: 'device-property-analysis'"),
  )
  const steps = Array.from(
    workflow.matchAll(/{ capability: '([^']+)', evidence: '([^']+)', required: (true|false) }/g),
    ([, capability, evidence, required]) => ({
      capability,
      evidence,
      required: required === 'true',
    }),
  )

  assert.deepEqual(steps, [
    { capability: 'asset.device.state.aggregate', evidence: 'device-state-summary', required: true },
    { capability: 'asset.device.online-rate.aggregate', evidence: 'device-online-rate-series', required: true },
    { capability: 'asset.device.message.aggregate', evidence: 'device-message-series', required: true },
  ])
})

test('device prompt copy is localized and does not ask the assistant to choose an arbitrary device', () => {
  const zh = JSON.parse(readFileSync('locales/lang/zh.json', 'utf8'))
  const en = JSON.parse(readFileSync('locales/lang/en.json', 'utf8'))

  assert.equal(zh['IotGeneralAgent.prompts.offline'], '最近有哪些设备离线了？')
  assert.equal(zh['IotGeneralAgent.prompts.openDetail'], '我想查看设备详情。')
  assert.doesNotMatch(zh['IotGeneralAgent.prompts.openDetail'], /查找一台设备|打开详情并继续分析/)
  for (const key of [
    'IotGeneralAgent.prompts.overview',
    'IotGeneralAgent.prompts.offline',
    'IotGeneralAgent.prompts.property',
    'IotGeneralAgent.prompts.openDetail',
  ]) {
    assert.equal(typeof zh[key], 'string', key)
    assert.equal(typeof en[key], 'string', key)
  }
})
