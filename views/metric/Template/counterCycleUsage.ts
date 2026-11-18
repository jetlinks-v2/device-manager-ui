import type { MetricTemplateStarter } from '@jetlinks-web-core/components'

/** 周期是普通本体来源；序列处理和试算均由 measurement 计算器完成。 */
export const counterCycleUsage: MetricTemplateStarter = {
  id: 'counter-cycle-usage',
  name: '累计表用量（支持换表）',
  description: '电、水、气等累计读数，按仪表或计数周期分段统计。',
  groupId: 'energy',
  icon: 'DashboardOutlined',
  providerName: '通用 IoT 模板',
  providerNameI18n: { zh: '通用 IoT 模板', en: 'General IoT templates' },
  groupName: '计量与能耗',
  groupNameI18n: { zh: '计量与能耗', en: 'Metering and energy' },
  template: {
    id: 'iot-counter-cycle-usage', version: '1', name: '累计表用量（支持换表）', enabled: true,
    inputDefinitions: [
      {
        id: 'reading', name: '累计读数', valueType: { type: 'double', scale: 8 }, unit: 'm3',
        source: { lookback: 'PT1H', maxPoints: 512 }, minSamples: 2, maxGap: 'PT30M',
      },
      {
        id: 'cycle', name: '仪表／计数周期标识', valueType: { type: 'string' },
        source: { lookback: 'PT1H', maxPoints: 512 }, minSamples: 1,
      },
    ],
    definitions: [{
      id: 'usage', name: '已观测用量', type: 'composite',
      inputs: [{ id: 'reading', metricId: 'reading' }, { id: 'cycle', metricId: 'cycle' }],
      calculator: {
        provider: 'measurement', providerVersion: '1',
        inputTypes: {
          reading: { type: 'array', elementType: { type: 'double', scale: 8 } },
          cycle: { type: 'array', elementType: { type: 'string' } },
        },
        outputType: { type: 'double', scale: 8 }, outputUnit: 'm3',
        parameters: {
          operation: 'increase', contextInput: 'cycle', identityChange: 'rebase',
          negativeDelta: 'reject', negativeTolerance: 0.05, maxRate: 0, multiplier: 1,
        },
      },
    }],
    outputs: [{ metricId: 'usage', label: '已观测用量', unit: 'm3', persist: true, publish: true }],
    parameterDefinitions: [], parameters: {},
    options: {
      category: 'energy', icon: 'DashboardOutlined',
      description: '电、水、气等累计读数，按仪表或计数周期分段统计。',
      notes: 'm3、0.05回退容差和30分钟间隔仅为水表示例，使用前按来源修改。换表时更新周期标识，新表首值仅作起点；换表缺口不计入，结果标记为估算并降低覆盖率。小幅回退保持高水位，恢复时不重复累计。最大速率单位为读数单位/秒，0表示不限制；倍率用于显式校准。普通累计表无周期来源时请选择“累计表区间用量”。',
      i18nMessages: {
        name: { zh: '累计表用量（支持换表）', en: 'Counter usage with meter replacement' },
        description: {
          zh: '电、水、气等累计读数，按仪表或计数周期分段统计。',
          en: 'Accumulate electricity, water, gas or other counters within declared meter cycles.',
        },
        notes: {
          zh: 'm3、0.05回退容差和30分钟间隔仅为水表示例，使用前按来源修改。换表时更新周期标识，新表首值仅作起点；换表缺口不计入，结果标记为估算并降低覆盖率。小幅回退保持高水位，恢复时不重复累计。最大速率单位为读数单位/秒，0表示不限制；倍率用于显式校准。普通累计表无周期来源时请选择“累计表区间用量”。',
          en: 'm3, a 0.05 decrease tolerance and a 30-minute gap are editable water-meter examples. Change the cycle identity on replacement. The first new reading is a baseline; replacement gaps are excluded and reduce coverage with estimated quality. Small decreases keep the high-water mark to avoid counting recovery twice. Maximum rate uses reading units/s; 0 is unlimited. Multiplier applies an explicit calibration. Without cycle observations, use Counter interval usage.',
        },
        'input.reading.name': { zh: '累计读数', en: 'Cumulative reading' },
        'input.cycle.name': { zh: '仪表／计数周期标识', en: 'Meter / counter cycle identity' },
        'rule.usage.name': { zh: '已观测用量', en: 'Observed usage' },
        'output.usage.label': { zh: '已观测用量', en: 'Observed usage' },
      },
      authoring: { references: [
        {
          kind: 'reference', name: 'OpenTelemetry cumulative streams: resets and gaps',
          url: 'https://opentelemetry.io/docs/specs/otel/metrics/data-model/#resets-and-gaps',
        },
        {
          kind: 'reference', name: 'Home Assistant: total and total_increasing',
          url: 'https://developers.home-assistant.io/docs/core/entity/sensor/#long-term-statistics',
        },
      ] },
    },
  },
  simulation: {
    configuration: {
      ownerType: 'simulation', ownerId: 'example', slot: 'example', targetType: 'simulation', targetId: 'example',
      templateId: 'iot-counter-cycle-usage', templateVersion: '1', state: 'disabled', revision: 0, parameters: {},
      inputMappings: {
        reading: { kind: 'property', thingType: 'device', thingId: 'example-meter', id: 'reading' },
        cycle: { kind: 'property', thingType: 'device', thingId: 'example-meter', id: 'cycle' },
      },
    },
    samples: [
      { metricId: 'cycle', value: 'meter-A', eventTime: 1793491200000 },
      { metricId: 'reading', value: 1000, eventTime: 1793491200000, unit: 'm3' },
      { metricId: 'reading', value: 1010, eventTime: 1793491800000, unit: 'm3' },
      { metricId: 'reading', value: 1009.98, eventTime: 1793492100000, unit: 'm3' },
      { metricId: 'reading', value: 1012, eventTime: 1793492400000, unit: 'm3' },
      { metricId: 'cycle', value: 'meter-B', eventTime: 1793493000000 },
      { metricId: 'reading', value: 500, eventTime: 1793493000000, unit: 'm3' },
      { metricId: 'reading', value: 503, eventTime: 1793493600000, unit: 'm3' },
      { metricId: 'reading', value: 505, eventTime: 1793494200000, unit: 'm3' },
    ].map(sample => ({
      ...sample, thingType: 'device', thingId: 'example-meter', ingestTime: sample.eventTime,
      processTime: sample.eventTime, quality: { valid: true },
    })),
  },
}
