import type { MetricTemplate, MetricTemplateStarter } from '@jetlinks-web-core/components'
import { operatingModeType, operatingModeMessages, operatingModeNotes } from './operatingMode'

const reference = (id: string, path: string[] = []) => ({ type: 'reference', id, path })
const literal = (value: number) => ({ type: 'literal', valueType: 'double', value: String(value) })
const compare = (operator: string, left: object, right: object) => ({ type: 'binary', operator, left, right })
const tree = (root: object) => ({ version: 1, root })
const array = (type: string) => ({ type: 'array', elementType: { type } })

/** 仅组合已声明的通用计算器与结构化公式；工况也是普通对象来源。 */
function calculator(id: string, name: string, operation: string, parameters: Record<string, unknown> = {}) {
  return {
    id, name, type: 'composite',
    inputs: [{ id: 'signal', metricId: 'reading' }, { id: 'context', metricId: 'mode' }],
    calculator: {
      provider: 'signal', providerVersion: '1', inputTypes: { signal: array('double'), context: { type: 'array', elementType: operatingModeType } },
      outputType: operation === 'linearTrend' ? { type: 'object', properties: [
        { id: 'slope', name: '变化速率（每秒）', valueType: { type: 'double' } },
        { id: 'valueAtCutoff', name: '当前拟合值', valueType: { type: 'double' } },
        { id: 'rSquared', name: '拟合程度（R²）', valueType: { type: 'double' } },
      ] } : { type: 'double' },
      ...(operation === 'timeToThreshold' ? { outputUnit: 's' } : {}),
      parameters: { operation, contextInput: 'context', maxPoints: 64, maxGap: 'PT2M', ...parameters },
    },
  }
}

function starter(trend: boolean): MetricTemplateStarter {
  const id = trend ? 'trend-threshold-observation' : 'condition-deviation-observation'
  const name = trend ? '趋势与越限观察' : '工况内偏离观察'
  const englishName = trend ? 'Trend and threshold observation' : 'Deviation within an operating mode'
  const description = trend ? '查看变化速率和拟合情况，满足条件时预估越限时间。' : '按当前工况建立近期基线，确认持续偏离和恢复。'
  const englishDescription = trend ? 'Inspect rate and fit quality, then estimate threshold crossing when the fit is sufficient.'
    : 'Build a recent baseline in the current mode and confirm sustained deviation and recovery.'
  const notes = (trend
    ? '示例上限80、R²门槛0.8、外推1小时，请按测点标定。至少8点，最近2分钟须有数据；工况变化后重新积累。越限预估不是剩余寿命。'
    : '示例偏离阈值3.5、恢复阈值2、确认及恢复各1分钟，请按工况标定。至少8点，最近2分钟须有数据；常量基线或数据缺失时不判为正常。滚动基线会吸收长期变化。') + operatingModeNotes.zh
  const englishNotes = (trend
    ? 'Calibrate the example threshold 80, R² gate 0.8 and one-hour horizon. Require eight observations and fresh data within two minutes; restart the baseline on mode changes. Crossing time is not remaining useful life.'
    : 'Calibrate example deviation 3.5, recovery 2 and one-minute entry/recovery. Require eight observations and fresh data within two minutes. Constant baselines or unavailable data cannot imply normal operation. Rolling baselines absorb long-term changes.') + ' ' + operatingModeNotes.en
  const labels: Record<string, [string, string]> = trend
    ? { trend: ['实际时间趋势', 'Trend over actual time'], crossing: ['线性越限秒数', 'Linear crossing time'], reviewedCrossing: ['越限预估', 'Reviewed crossing estimate'] }
    : { deviation: ['近期偏离', 'Recent deviation'], persistentDeviation: ['持续偏离', 'Sustained deviation'] }
  const messages: Record<string, { zh: string; en: string }> = {
    name: { zh: name, en: englishName }, description: { zh: description, en: englishDescription }, notes: { zh: notes, en: englishNotes },
    'input.reading.name': { zh: '观测值', en: 'Observed value' },
    'input.mode.name': { zh: '运行工况', en: 'Operating mode' },
    ...operatingModeMessages('input.mode'),
  }
  for (const [key, [zh, en]] of Object.entries(labels)) {
    messages[`rule.${key}.name`] = { zh, en }
    messages[`output.${key}.label`] = { zh, en }
  }
  if (trend) {
    for (const [field, zh, en] of [['slope', '变化速率（每秒）', 'Rate of change per second'],
      ['valueAtCutoff', '当前拟合值', 'Fitted current value'], ['rSquared', '拟合程度（R²）', 'Fit quality (R²)']]) {
      messages[`rule.trend.output.field.${field}.name`] = { zh, en }
    }
  }
  const template: MetricTemplate = {
    id: `iot-${id}`, version: '1', name, enabled: true,
    inputDefinitions: [
      { id: 'reading', name: '观测值', valueType: { type: 'double' }, maxAge: 'PT2M',
        source: { lookback: 'PT15M', maxPoints: 64 }, minSamples: 8, maxGap: 'PT2M' },
      { id: 'mode', name: '运行工况', valueType: operatingModeType,
        source: { lookback: 'PT15M', maxPoints: 64 }, minSamples: 1 },
    ],
    parameterDefinitions: [], parameters: {}, definitions: [], outputs: [],
    options: { description, notes, i18nMessages: messages, authoring: { references: [{ kind: 'reference',
      name: trend ? 'NIST: Linear least squares regression' : 'NIST: Detection of outliers',
      url: trend ? 'https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm'
        : 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm' }] } },
  }
  if (trend) {
    template.definitions = [calculator('trend', labels.trend[0], 'linearTrend'),
      calculator('crossing', labels.crossing[0], 'timeToThreshold', { threshold: 80, direction: 'rising', maxHorizon: 'PT1H' }),
      { id: 'reviewedCrossing', name: labels.reviewedCrossing[0], dependsOn: ['trend', 'crossing'],
        expressionTree: tree({ type: 'conditional', condition: compare('ge', reference('trend', ['rSquared']), literal(.8)),
          whenTrue: reference('crossing'), whenFalse: { type: 'literal', valueType: 'null' } }) }]
    template.outputs = [{ metricId: 'trend', label: labels.trend[0], persist: true, publish: true },
      { metricId: 'reviewedCrossing', label: labels.reviewedCrossing[0], unit: 's', valueType: 'double', persist: true, publish: true }]
  } else {
    template.definitions = [calculator('deviation', labels.deviation[0], 'robustZScore'),
      { id: 'persistentDeviation', name: labels.persistentDeviation[0], dependsOn: ['deviation'],
        temporalCondition: { dwell: 'PT1M', recovery: 'PT1M', maxNoData: 'PT2M',
          enterTree: tree({ type: 'logical', operator: 'or', operands: [compare('gt', reference('deviation'), literal(3.5)), compare('lt', reference('deviation'), literal(-3.5))] }),
          exitTree: tree({ type: 'logical', operator: 'and', operands: [compare('le', reference('deviation'), literal(2)), compare('ge', reference('deviation'), literal(-2))] }) } }]
    template.outputs = [{ metricId: 'deviation', label: labels.deviation[0], valueType: 'double', persist: true, publish: true },
      { metricId: 'persistentDeviation', label: labels.persistentDeviation[0], valueType: 'boolean', persist: true, publish: true }]
  }
  for (const rule of template.definitions) if (rule.calculator) Object.assign(messages, operatingModeMessages(`rule.${rule.id}.input.context.element`))
  const origin = 1_794_800_000_000
  const values = trend ? [20, 22, 24, 26, 28, 30, 32, 34, 36, 38] : [20, 21, 19, 20, 21, 19, 20, 21, 40, 41, 20, 21]
  return {
    id, name, description, groupId: 'condition', icon: trend ? 'LineChartOutlined' : 'FundOutlined',
    providerName: '通用 IoT 模板', providerNameI18n: { zh: '通用 IoT 模板', en: 'General IoT templates' },
    groupName: '条件与观察', groupNameI18n: { zh: '条件与观察', en: 'Conditions and observations' }, template,
    simulation: {
      configuration: { ownerType: 'simulation', ownerId: 'example', slot: 'example', targetType: 'simulation', targetId: 'example',
        templateId: template.id, templateVersion: '1', state: 'disabled', revision: 0, parameters: {}, inputMappings: {
          reading: { kind: 'property', thingType: 'sensor', thingId: 'example-sensor', id: 'reading' },
          mode: { kind: 'property', thingType: 'sensor', thingId: 'example-sensor', id: 'mode' },
        } },
      samples: [{ metricId: 'mode', value: 1, eventTime: origin },
        ...values.map((value, index) => ({ metricId: 'reading', value, eventTime: origin + index * 60_000 }))]
        .map(sample => ({ ...sample, thingType: 'sensor', thingId: 'example-sensor', ingestTime: sample.eventTime,
          processTime: sample.eventTime, quality: { valid: true } })),
    },
  }
}

export const healthObservationStarters = [starter(false), starter(true)]
