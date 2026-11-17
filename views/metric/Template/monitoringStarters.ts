import type { MetricTemplate, MetricTemplateStarter } from '@jetlinks-web-core/components'
import { operatingModeType, operatingModeMessages, operatingModeNotes } from './operatingMode'

const array = (type: string) => ({ type: 'array', elementType: { type } })
const ref = (id: string, path: string[] = []) => ({ type: 'reference', id, path })
const number = (value: number) => ({ type: 'literal', valueType: 'double', value: String(value) })
const binary = (operator: string, left: object, right: object) => ({ type: 'binary', operator, left, right })
const tree = (root: object) => ({ version: 1, root })
const history = { lookback: 'PT15M', maxPoints: 64 }

/** Editable examples composed from generic algorithms; bindings remain ordinary object sources. */
function starter(kind: 'drift' | 'relation' | 'flat'): MetricTemplateStarter {
  const labels = {
    drift: ['fixed-reference-drift', '固定基准漂移', 'Fixed-reference drift', 'RiseOutlined'],
    relation: ['paired-signal-observation', '测点关系观察', 'Paired signal observation', 'NodeIndexOutlined'],
    flat: ['sensor-flat-observation', '传感器疑似卡死', 'Possible stuck sensor', 'MinusOutlined'],
  }[kind]
  const [id, name, english, icon] = labels
  const description = kind === 'drift' ? '按标定基准观察持续偏移。' : kind === 'relation' ? '查看两路测点关系与有效配对数。' : '应当变化时，确认测点是否持续不变。'
  const descriptionEn = kind === 'drift' ? 'Observe sustained shifts from a calibrated reference.' : kind === 'relation' ? 'Inspect the relation between two signals and their paired sample count.' : 'Check for sustained flat readings when change is expected.'
  const notes = (kind === 'drift'
    ? '基准均值20、标准差2、允许偏移0.5和累计量阈值5仅为示例，必须标定；按窗口及工况重新起算，不是无限历史监控。'
    : kind === 'relation' ? '按100毫秒容差顺序配对；算例两路有固定偏移但仍完全相关，不能据此判为无误差。需要检查偏差时，另用公式减去已标定关系。'
      : '需绑定“预期有变化”业务事实；稳定过程不能判为故障。至少8点，示例绝对容差0.01，持续1分钟后仅提示复核；静默属于无数据。') + (kind !== 'flat' ? operatingModeNotes.zh : '')
  const notesEn = (kind === 'drift'
    ? 'Calibrate example mean 20, deviation 2, allowance 0.5 and limit 5. Restart at window/context boundaries; this is not infinite-history monitoring.'
    : kind === 'relation' ? 'Match in time order within 100 ms. The example has a fixed offset but perfect correlation, which does not prove accuracy. Use a formula against a calibrated relation to inspect residuals.'
      : 'Bind the expected-change business fact. Stable processes are not faults. Require eight points and calibrate example absolute tolerance 0.01; confirm for one minute. Silence is unavailable data.') + (kind !== 'flat' ? ' ' + operatingModeNotes.en : '')
  const messages: Record<string, { zh: string; en: string }> = {
    name: { zh: name, en: english }, description: { zh: description, en: descriptionEn }, notes: { zh: notes, en: notesEn },
  }
  const input = (id: string, zh: string, en: string, type: string, historical = true, periodic = true) => {
    messages[`input.${id}.name`] = { zh, en }
    // Context values describe a state until its next change, rather than periodic telemetry.
    return { id, name: zh, valueType: type === 'enum' ? operatingModeType : { type }, ...(periodic ? { maxAge: 'PT2M' } : {}), ...(historical ? { source: history, minSamples: type === 'double' ? 8 : 1 } : {}) }
  }
  const template: MetricTemplate = {
    id: `iot-${id}`, version: '1', name, enabled: true,
    inputDefinitions: [input('reading', '观测值', 'Observed value', 'double', kind !== 'flat')],
    definitions: [], outputs: [], parameterDefinitions: [], parameters: {},
    options: { description, notes, i18nMessages: messages },
  }
  const output = (metricId: string, zh: string, en: string, type = 'double') => {
    messages[`rule.${metricId}.name`] = { zh, en }; messages[`output.${metricId}.label`] = { zh, en }
    template.outputs.push({ metricId, label: zh, valueType: type, persist: true, publish: true })
    return zh
  }
  const context = { id: 'context', metricId: 'mode' }
  const contextType = { type: 'array', elementType: operatingModeType }
  if (kind === 'drift') {
    template.inputDefinitions.push(input('mode', '运行工况', 'Operating mode', 'enum', true, false))
    template.definitions.push({ id: 'drift', name: output('drift', '当前累计偏移', 'Current cumulative shift'), type: 'composite',
      inputs: [{ id: 'signal', metricId: 'reading' }, context], calculator: { provider: 'signal', providerVersion: '1',
        inputTypes: { signal: array('double'), context: contextType }, outputType: { type: 'double' },
        parameters: { operation: 'cusum', referenceMean: 20, referenceDeviation: 2, allowance: .5, contextInput: 'context', maxGap: 'PT2M', maxPoints: 64 } } },
      { id: 'persistentDrift', name: output('persistentDrift', '持续偏移', 'Sustained shift', 'boolean'), dependsOn: ['drift'],
        temporalCondition: { dwell: 'PT1M', recovery: 'PT1M', maxNoData: 'PT2M',
          enterTree: tree(binary('ge', ref('drift'), number(5))), exitTree: tree(binary('le', ref('drift'), number(2))) } })
  } else if (kind === 'relation') {
    template.inputDefinitions.push(input('reference', '参考测点', 'Reference signal', 'double'), input('mode', '运行工况', 'Operating mode', 'enum', true, false))
    messages['rule.relation.name'] = { zh: '测点关系', en: 'Signal relation' }
    template.definitions.push({ id: 'relation', name: '测点关系', type: 'composite',
      inputs: [{ id: 'signal', metricId: 'reading' }, { id: 'reference', metricId: 'reference' }, context],
      calculator: { provider: 'signal', providerVersion: '1', inputTypes: { signal: array('double'), reference: array('double'), context: contextType },
        outputType: { type: 'object', properties: [{ id: 'correlation', valueType: { type: 'double' } }, { id: 'pairs', valueType: { type: 'int' } }] },
        parameters: { operation: 'correlation', alignmentTolerance: 'PT0.1S', contextInput: 'context', maxGap: 'PT2M', maxPoints: 64 } } },
      { id: 'correlation', name: output('correlation', '相关系数', 'Correlation'), dependsOn: ['relation'], expressionTree: tree(ref('relation', ['correlation'])) },
      { id: 'pairs', name: output('pairs', '有效配对数', 'Matched pairs', 'int'), dependsOn: ['relation'], expressionTree: tree(ref('relation', ['pairs'])) })
  } else {
    template.inputDefinitions.push(input('expectedChange', '预期有变化', 'Change expected', 'boolean', false))
    const window = { mode: 'time', size: 'PT5M', timeMode: 'event', emitPolicy: 'onEvent', maxEntries: 64 }
    messages['rule.sampleCount.name'] = { zh: '有效样本数', en: 'Sample count' }
    template.definitions.push({ id: 'spread', name: output('spread', '近期极差', 'Recent range'), type: 'feature', sourceMetric: 'reading', aggregation: 'range',
      window },
      { id: 'sampleCount', name: '有效样本数', type: 'feature', sourceMetric: 'reading', aggregation: 'count', window },
      { id: 'possibleStuck', name: output('possibleStuck', '疑似卡死', 'Possibly stuck', 'boolean'), dependsOn: ['spread', 'sampleCount', 'expectedChange'],
        temporalCondition: { dwell: 'PT1M', recovery: 'PT15S', maxNoData: 'PT2M',
          enterTree: tree({ type: 'logical', operator: 'and', operands: [ref('expectedChange'), binary('ge', ref('sampleCount'), number(8)), binary('le', ref('spread'), number(.01))] }),
          exitTree: tree({ type: 'logical', operator: 'or', operands: [binary('gt', ref('spread'), number(.02)),
            binary('eq', ref('expectedChange'), { type: 'literal', valueType: 'boolean', value: false })] }) } })
  }
  if (kind !== 'flat') {
    Object.assign(messages, operatingModeMessages('input.mode'))
    for (const rule of template.definitions) if (rule.calculator) Object.assign(messages, operatingModeMessages(`rule.${rule.id}.input.context.element`))
  }
  const origin = 1_794_800_000_000
  const samples: Array<{ metricId: string; value: number | boolean; eventTime: number }> = Array.from({ length: 21 }, (_, index) => {
    const time = origin + index * 15_000
    const value = kind === 'flat' ? index < 16 ? 20 : 20 + index - 15 : 20 + index * .5
    return [{ metricId: 'reading', value, eventTime: time },
      ...(kind === 'relation' ? [{ metricId: 'reference', value: value * 2 + 10, eventTime: time }] : []),
      ...(kind === 'flat' ? [{ metricId: 'expectedChange', value: true, eventTime: time }] : [])]
  }).flat()
  if (kind !== 'flat') samples.unshift({ metricId: 'mode', value: 1, eventTime: origin })
  return { id, name, description, groupId: 'condition', icon, template,
    providerName: '通用 IoT 模板', providerNameI18n: { zh: '通用 IoT 模板', en: 'General IoT templates' },
    groupName: '条件与观察', groupNameI18n: { zh: '条件与观察', en: 'Conditions and observations' },
    simulation: { configuration: { ownerType: 'simulation', ownerId: 'example', slot: 'example', targetType: 'simulation', targetId: 'example',
      templateId: template.id, templateVersion: '1', state: 'disabled', revision: 0, parameters: {},
      inputMappings: Object.fromEntries(template.inputDefinitions.map(input => [input.id, { kind: 'property', thingType: 'sensor', thingId: 'example-sensor', id: input.id }])) },
      samples: samples.map(sample => ({ ...sample, thingType: 'sensor', thingId: 'example-sensor', ingestTime: sample.eventTime, processTime: sample.eventTime, quality: { valid: true } })) } }
}

export const monitoringStarters = [starter('drift'), starter('relation'), starter('flat')]
