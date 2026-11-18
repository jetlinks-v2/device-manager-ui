import type { MetricTemplateStarter } from '@jetlinks-web-core/components'

/** 求和批次数值，不能用事件条数计故障，也不能把不同阶段相加为总失败率。 */
const phases = [
  ['receive', '接收处理失败', 'Receive processing failures'],
  ['send', '发送处理失败', 'Send processing failures'],
  ['storage', '平台存储失败', 'Platform storage failures'],
  ['reply', '指令失败回复', 'Failed command replies'],
] as const
const origin = 1_794_800_000_000
const source = (phase: string) => ({ provider: 'ontology', sourceType: `operationFailure_${phase}`, configuration: { valuePath: 'count' } })
const name = '设备处理失败观测', description = '分别查看接收、发送、存储和指令回复的已观测失败次数。'
const notes = '来源选择设备的处理失败事件及其中的 count 字段。每阶段独立求和，事件可能属于同一次操作；采集存在容量限制，无事件不代表零故障。近5分钟按批次最后观测时间统计，重启前未保留的观测不补零。'
export const operationFailureStarter: MetricTemplateStarter = {
  id: 'operation-failures', name, description, groupId: 'connectivity', icon: 'WarningOutlined',
  providerName: '通用 IoT 模板', providerNameI18n: { zh: '通用 IoT 模板', en: 'General IoT templates' },
  groupName: '连接与通信', groupNameI18n: { zh: '连接与通信', en: 'Connectivity' },
  template: {
    id: 'iot-operation-failures', version: '1', name, thingType: 'device', enabled: true,
    inputDefinitions: phases.map(([phase, label]) => ({ id: phase, name: label, valueType: { type: 'long' } })),
    parameterDefinitions: [], parameters: {},
    definitions: phases.map(([phase, label]) => ({ id: `${phase}Count`, name: label, type: 'feature', sourceMetric: phase,
      aggregation: 'sum', window: { mode: 'time', size: 'PT5M', timeMode: 'event', emitPolicy: 'onEvent', maxEntries: 512 } })),
    outputs: phases.map(([phase, label]) => ({ metricId: `${phase}Count`, label, valueType: 'long', metricKind: 'numeric', persist: true, publish: true })),
    options: { description, notes, i18nMessages: {
      name: { zh: name, en: 'Device operation failure observations' },
      description: { zh: description, en: 'Observed failures for receive, send, storage and command replies, counted separately.' },
      notes: { zh: notes, en: 'Select count from the device operation failure events. Sum each stage separately; stages may describe the same operation. Collection is bounded and absent events do not prove zero failures. The five-minute window uses the last observation time of each batch; missing observations before restart are not filled with zero.' },
      ...Object.fromEntries(phases.flatMap(([phase, zh, en]) => [
        [`input.${phase}.name`, { zh, en }], [`rule.${phase}Count.name`, { zh, en }], [`output.${phase}Count.label`, { zh, en }],
      ])),
    } },
  },
  simulation: {
    configuration: { ownerType: 'device', ownerId: 'example-device', targetType: 'device', targetId: 'example-device',
      templateId: 'iot-operation-failures', templateVersion: '1', slot: 'operation-failures', scope: 'single', state: 'enabled',
      parameters: {}, inputMappings: Object.fromEntries(phases.map(([phase]) => [phase, { kind: 'provider', id: phase,
        providerSource: source(phase) }])) },
    samples: phases.flatMap(([phase]) => [3, 5].map((value, index) => ({ thingType: 'device', thingId: 'example-device', metricId: phase,
      value, sourceKind: 'provider', providerSource: source(phase), eventTime: origin + index * 60_000, ingestTime: origin + index * 60_000,
      processTime: origin + index * 60_000, quality: { valid: true } }))), endAt: origin + 60_000,
  },
}
