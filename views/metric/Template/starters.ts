import type { MetricConfig, MetricTemplate, MetricTemplateInput, MetricTemplateStarter } from '@jetlinks-web-core/components'
import { structureMetricTemplate } from '@jetlinks-web-core/components'
import { createCommunicationStarter } from './communicationStarter'
import { createFireStarters } from './fireStarters'
export { starterMessages } from './starterMessages'

type Translate = (key: string) => string
const number = { type: 'double', scale: 8 }
const array = { type: 'array', elementType: number }
const start = Date.UTC(2026, 10, 1)

/** 场景只提供普通配置与观测事实，不包含前端计算或专用运行分支。 */
export function createMetricStarters(t: Translate): MetricTemplateStarter[] {
  const states = (names: string[]) => ({ type:'enum', valueType:{ type:'int' }, elements:names.map((name,value) => ({ value,text:t(`state_${name}`) })) })
  const input = (id: string, unit?: string, extra = {}): MetricTemplateInput => ({ id, name: t(id), valueType: number, unit, ...extra })
  const output = (metricId: string, unit?: string) => ({ metricId, label: t(metricId), unit, persist: true, publish: true })
  const parameter = (id: string, defaultValue: unknown, unit?: string, editable = true) => ({ id, name: t(id), valueType: { ...number, ...(unit ? { unit } : {}) }, expands: { editable, defaultValue } })
  const formula = (id: string, dependsOn: string[], expression: string, extra = {}) => ({ id, type: 'composite', dependsOn, expression, ...extra })
  const base = (id: string, inputs: MetricTemplateInput[], definitions: Record<string, unknown>[], outputs: MetricTemplate['outputs']): MetricTemplate => ({
    id, version: '1', name: t(`${id}.name`), enabled: true, inputDefinitions: inputs,
    definitions: definitions.map(item => ({ name: t(String(item.id)), ...item })), outputs,
    parameterDefinitions: [], parameters: {}, options: { description: t(`${id}.description`), notes: t(`${id}.notes`) },
  })
  const point = (id: string, value: unknown, minute: number) => ({ thingType: 'device', thingId: `example-${id}`, metricId: id, value,
    eventTime: start + minute * 60_000, ingestTime: start + minute * 60_000, processTime: start + minute * 60_000, quality: { valid: true } })
  const frame = (minute: number, values: Record<string, unknown>) => Object.entries(values).map(([id, value]) => point(id, value, minute))
  const groups: Record<string, string> = { window: 'basic', meter: 'energy', cooling: 'energy', health: 'maintenance', runtime: 'maintenance', fire: 'fire', intensity: 'energy', comprehensive: 'energy', water: 'energy', bearing: 'maintenance', filter: 'maintenance', cold: 'environment', ventilation: 'environment', fireWater: 'fire',
    equipmentStates: 'maintenance', equipmentDay: 'maintenance', equipmentWeek: 'maintenance', fleetSummary: 'maintenance', fleetConnections:'maintenance', online:'maintenance', attendance: 'basic', orderCompletion: 'basic', productionMix: 'basic' }
  const make = (template: MetricTemplate, icon: string, samples: Record<string, unknown>[], endAt?: number): MetricTemplateStarter => {
    const structured=structureMetricTemplate(template)
    if(structured.unsupported.length)throw new Error(structured.unsupported.join(', '))
    template=structured.template
    const configuration: MetricConfig = { ownerType: 'simulation', ownerId: 'example', slot: 'example', targetType: 'simulation', targetId: 'example',
      templateId: template.id, templateVersion: template.version, state: 'disabled', revision: 0, parameters: {},
      inputMappings: Object.fromEntries(template.inputDefinitions.map(item => [item.id, { kind: 'property', thingType: 'device', thingId: `example-${item.id}`, id: item.id }])) }
    const observations = samples.map(sample => ({ ...sample, unit: template.inputDefinitions.find(item => item.id === sample.metricId)?.unit }))
    return { id: template.id, name: template.name, description: t(`${template.id}.description`), groupId: groups[template.id], icon, template, simulation: { configuration, samples: observations, ...(endAt !== undefined ? { endAt } : {}) } }
  }
  const history = (id: string, unit: string) => input(id, unit, { source: { lookback: 'PT2H', maxPoints: 128 }, minSamples: 2, maxGap: 'PT31M' })
  const increase = (id: string, source: string, unit: string, negativeDelta = 'reject') => ({ id, type: 'composite', inputs: [{ id: 'reading', metricId: source }], calculator: {
    provider: 'measurement', providerVersion: '1', inputTypes: { reading: array }, outputType: number, outputUnit: unit,
    parameters: { operation: 'increase', negativeDelta, unit },
  } })
  // 比较计算器实际返回的区间，不用时间偏差近似替代统计边界；缺少输入仍由通用质量链处理。
  const sameInterval = (...ids: string[]) => [`metricValues['${ids[0]}'].getInputTimeStart() > 0`, ...ids.slice(1).flatMap(id => ['getInputTimeStart()', 'getInputTimeEnd()'].map(key => `metricValues['${id}'].${key} == metricValues['${ids[0]}'].${key}`))].join(' && ')
  const timed = (id: string, dependsOn: string[], enterExpression: string, exitExpression: string, dwell: string, recovery: string) => ({ id, dependsOn,
    temporalCondition: { enterExpression, exitExpression, dwell, recovery, maxNoData: 'PT2M' },
    window: { mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT1M' },
  })
  const window = base('window', [input('temperature', '°C')], [{ id: 'average', type: 'feature', sourceMetric: 'temperature', aggregation: 'avg',
    window: { mode: 'time', size: 'PT15M', timeMode: 'event', emitPolicy: 'onEvent', maxEntries: 128 } }], [output('average', '°C')])
  const meter = base('meter', [input('reading', 'kWh', { source: { lookback: 'PT1H', maxPoints: 128 }, minSamples: 2, maxGap: 'PT30M' })], [{
    id: 'usage', inputs: [{ id: 'reading', metricId: 'reading' }], calculator: { provider: 'measurement', providerVersion: '1',
      inputTypes: { reading: array }, outputType: number, outputUnit: 'kWh', parameters: { operation: 'increase', negativeDelta: 'reject' } },
  }], [output('usage', 'kWh')])
  const cooling = base('cooling', [input('flow', 'm³/h'), input('supplyTemperature', '°C'), input('returnTemperature', '°C'), input('power', 'kW'),
    input('mode', undefined, { valueType: { type: 'string' } })].map(item => ({ ...item, maxAge: 'PT30S' })), [
    formula('thermalPower', ['flow', 'supplyTemperature', 'returnTemperature', 'mode'], 'flow * (returnTemperature - supplyTemperature) * params.factor', { applicabilityExpression: "mode == 'steady'", maxInputSkew: 'PT5S' }),
    formula('cop', ['thermalPower', 'power'], 'thermalPower / power', { applicabilityExpression: 'power > 0', maxInputSkew: 'PT5S' }),
  ], [output('thermalPower', 'kW'), output('cop')])
  cooling.parameterDefinitions = [parameter('factor', 1.163)]
  const health = base('health', [input('temperature', '°C'), input('vibration', 'mm/s')].map(item => ({ ...item, maxAge: 'PT5M' })), [
    formula('healthScore', ['temperature', 'vibration'], '100 - (temperature > params.temperatureLimit ? 40 : 0) - (vibration > params.vibrationLimit ? 60 : 0)'),
  ], [output('healthScore')])
  health.parameterDefinitions = [parameter('temperatureLimit', 80), parameter('vibrationLimit', 7.1)]
  const state = base('runtime', [input('operating', undefined, { valueType: states(['stopped', 'running', 'standby', 'fault', 'maintenance']), source: { lookback: 'PT2H', maxPoints: 256 }, maxAge: 'PT2H' })], [{
    id: 'running', dependsOn: ['operating'],
    inputs: [{ id:'operating', metricId:'operating' }], expression:'operating', stateTracking:{ maxNoData:'PT20M' },
    options:{ stateLabels:['stopped', 'running', 'standby', 'fault', 'maintenance'].map((name,value) => ({ value, name:t(`state_${name}`) })) },
    window: { mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT1M' },
  }, ...['stopped', 'running', 'standby', 'fault', 'maintenance'].map((name,value) => formula(`${name}Seconds`, ['running'],
    `running == ${value} ? metricValues['running'].getState().getDuration() : 0`, {
      inputs:[{ id:'running', metricId:'running' }],
      window:{ mode:'none', timeMode:'processing', emitPolicy:'onSchedule', emitInterval:'PT1M' },
    })), {
    id: 'statistics', type: 'composite', inputs: [{ id: 'state', metricId: 'operating' }],
    window: { mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT1M' },
    calculator: { provider: 'state', providerVersion: '1', inputTypes: { state: { type: 'array', elementType: { type: 'int' } } },
      outputType: { type: 'object', properties: ['activeDuration', 'inactiveDuration', 'unknownDuration', 'activeCount', 'inactiveCount', 'coverage'].map(id => ({ id, name: t(id), valueType: number })) },
      parameters: { duration: 'PT1H', maxHold: 'PT20M', activeValue: 1, inactiveValue: 0 } },
  }, formula('activeSeconds', ['statistics'], "statistics['activeDuration']"),
  formula('unknownSeconds', ['statistics'], "statistics['unknownDuration']"),
  formula('coveragePercent', ['statistics'], "statistics['coverage'] * 100"),
  formula('startCount', ['statistics'], "statistics['activeCount']"), formula('stopCount', ['statistics'], "statistics['inactiveCount']")],
  [{ ...output('running'), valueType: 'int' }, ...['stopped', 'running', 'standby', 'fault', 'maintenance'].map(name => output(`${name}Seconds`, 's')), output('activeSeconds', 's'), output('startCount'), output('stopCount'), output('unknownSeconds', 's'), output('coveragePercent', '%')])
  const fire = base('fire', [input('smoke'), input('temperature', '°C')].map(item => ({ ...item, maxAge: 'PT10M' })), [{
    id: 'confirmed', dependsOn: ['smoke', 'temperature'],
    temporalCondition: { enterExpression: 'smoke >= params.smokeLimit && temperature >= params.temperatureLimit',
      exitExpression: 'smoke < params.smokeLimit || temperature < params.temperatureLimit', dwell: 'PT3M', recovery: 'PT2M', maxNoData: 'PT10M' },
    window: { mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT1M' },
  }], [output('confirmed')])
  fire.parameterDefinitions = [parameter('smokeLimit', 2), parameter('temperatureLimit', 60)]
  const intensity = base('intensity', [history('electricityReading', 'kWh'), history('productionReading', 't')], [
    increase('electricityUsage', 'electricityReading', 'kWh'), increase('productionUsage', 'productionReading', 't'),
    formula('energyIntensity', ['electricityUsage', 'productionUsage'], 'electricityUsage / productionUsage', { applicabilityExpression: `productionUsage > 0 && ${sameInterval('electricityUsage', 'productionUsage')}` }),
  ], [output('energyIntensity', 'kWh/t'), output('electricityUsage', 'kWh'), output('productionUsage', 't')])
  const comprehensive = base('comprehensive', [history('electricityReading', 'kWh'), history('gasReading', 'Nm³')], [
    increase('electricityUsage', 'electricityReading', 'kWh'), increase('gasUsage', 'gasReading', 'Nm³'),
    formula('comprehensiveEnergy', ['electricityUsage', 'gasUsage'], 'electricityUsage * params.electricFactor + gasUsage * params.gasFactor', { applicabilityExpression: sameInterval('electricityUsage', 'gasUsage') }),
  ], [output('comprehensiveEnergy', 'kgce'), output('electricityUsage', 'kWh'), output('gasUsage', 'Nm³')])
  comprehensive.parameterDefinitions = [parameter('electricFactor', 0.1, 'kgce/kWh', false), parameter('gasFactor', 1, 'kgce/Nm³', false)]
  const water = base('water', [history('mainReading', 'm³'), history('branchAReading', 'm³'), history('branchBReading', 'm³'), history('storageVolume', 'm³')], [
    increase('mainUsage', 'mainReading', 'm³'), increase('branchAUsage', 'branchAReading', 'm³'), increase('branchBUsage', 'branchBReading', 'm³'), increase('storageDelta', 'storageVolume', 'm³', 'signed'),
    formula('waterDifference', ['mainUsage', 'branchAUsage', 'branchBUsage', 'storageDelta'], 'mainUsage - branchAUsage - branchBUsage - storageDelta', { applicabilityExpression: sameInterval('mainUsage', 'branchAUsage', 'branchBUsage', 'storageDelta') }),
    formula('waterDifferencePercent', ['waterDifference', 'mainUsage'], 'waterDifference / mainUsage * 100', { applicabilityExpression: 'mainUsage > 0' }),
  ], [output('waterDifference', 'm³'), output('waterDifferencePercent', '%')])
  const modeInput = () => input('mode', undefined, { valueType: { type: 'string' }, maxAge: 'PT2M' })
  const bearing = base('bearing', [input('bearingTemperature', '°C'), input('ambientTemperature', '°C'), modeInput()].map(item => ({ ...item, maxAge: 'PT2M' })), [
    formula('temperatureRise', ['bearingTemperature', 'ambientTemperature', 'mode'], 'bearingTemperature - ambientTemperature', { applicabilityExpression: "mode == 'steady'", maxInputSkew: 'PT30S' }),
    formula('bearingAttention', ['temperatureRise'], 'temperatureRise > params.riseLimit'),
  ], [output('temperatureRise', '°C'), output('bearingAttention')])
  bearing.parameterDefinitions = [parameter('riseLimit', 50, '°C')]
  const filter = base('filter', [input('inletPressure', 'Pa'), input('outletPressure', 'Pa'), input('airFlow', 'm³/h'), modeInput()].map(item => ({ ...item, maxAge: 'PT2M' })), [
    formula('pressureDrop', ['inletPressure', 'outletPressure', 'airFlow', 'mode'], 'inletPressure - outletPressure', { applicabilityExpression: "mode == 'steady' && airFlow >= params.minimumFlow && airFlow <= params.maximumFlow", maxInputSkew: 'PT30S' }),
    formula('filterAttention', ['pressureDrop'], 'pressureDrop > params.pressureDropLimit'),
  ], [output('pressureDrop', 'Pa'), output('filterAttention')])
  filter.parameterDefinitions = [parameter('pressureDropLimit', 200, 'Pa'), parameter('minimumFlow', 1000, 'm³/h', false), parameter('maximumFlow', 2500, 'm³/h', false)]
  const cold = base('cold', [input('temperature', '°C', { maxAge: 'PT2M' })], [
    timed('coldExcursion', ['temperature'], 'temperature < params.lowerTemperature || temperature > params.upperTemperature', 'temperature >= params.lowerTemperature && temperature <= params.upperTemperature', 'PT5M', 'PT2M'),
  ], [output('coldExcursion')])
  cold.parameterDefinitions = [parameter('lowerTemperature', 2, '°C'), parameter('upperTemperature', 8, '°C')]
  const ventilation = base('ventilation', [input('co2', 'ppm', { maxAge: 'PT2M' })], [
    { id: 'co2Average', type: 'feature', sourceMetric: 'co2', aggregation: 'avg', window: { mode: 'time', size: 'PT1H', timeMode: 'event', emitPolicy: 'onEvent', maxEntries: 256 } },
    timed('ventilationNeeded', ['co2'], 'co2 > params.co2Limit', 'co2 <= params.co2Limit', 'PT3M', 'PT1M'),
  ], [output('ventilationNeeded'), output('co2Average', 'ppm')])
  ventilation.parameterDefinitions = [parameter('co2Limit', 900, 'ppm')]
  const fireWater = base('fireWater', [input('waterPressure', 'MPa', { maxAge: 'PT2M' }), input('waterLevel', 'm', { maxAge: 'PT2M' })], [
    formula('lowPressure', ['waterPressure'], 'waterPressure < params.minimumPressure'),
    formula('lowWater', ['waterLevel'], 'waterLevel < params.minimumLevel'),
  ], [output('lowPressure'), output('lowWater')])
  fireWater.parameterDefinitions = [parameter('minimumPressure', 0.35, 'MPa'), parameter('minimumLevel', 2, 'm')]
  const schedule = () => ({ mode: 'none', timeMode: 'processing', emitPolicy: 'onSchedule', emitInterval: 'PT5M' })
  // 工况编码由模板定义；维修、大修、故障、保养不合并，也不据此猜测是否通电。
  const equipmentStates = ['shutdown', 'running', 'standby', 'repair', 'overhaul', 'fault', 'service']
  const equipmentState = base('equipmentStates', [input('operating', undefined, { valueType: states(equipmentStates), maxAge: 'PT20M' })], [
    formula('equipmentState', ['operating'], 'operating', { stateTracking: { maxNoData: 'PT20M' }, window: schedule(),
      options: { stateLabels: equipmentStates.map((name, value) => ({ value, name: t(`state_${name}`) })) } }),
    ...equipmentStates.map((name, value) => formula(`${name}Seconds`, ['equipmentState'],
      `equipmentState == ${value} ? metricValues['equipmentState'].getState().getDuration() : 0`, { window: schedule() })),
  ], [{ ...output('equipmentState'), valueType: 'int' }, ...equipmentStates.map(name => output(`${name}Seconds`, 's'))])
  const calendarEquipment = (weekly: boolean) => {
    const periodSeconds = weekly ? 604800 : 86400
    const template = base(weekly ? 'equipmentWeek' : 'equipmentDay', ['workingFlag', 'energizedFlag'].map(id => input(id, undefined, {
      valueType: { type: 'boolean' }, source: { lookback: weekly ? 'P7D' : 'PT25H', maxPoints: 2048 },
    })), [
      // 业务固定UTC+8，无夏令时。以评估时刻计算本地日界／周一，不依赖JVM当前时间。
      formula('periodFrom', ['workingFlag'], `sample.getProcessTime() - (sample.getProcessTime() + params.utcOffsetSeconds * 1000L${weekly ? ' + 259200000L' : ''}) % ${periodSeconds * 1000}L`, { window: schedule() }),
      ...['working', 'energized'].map(name => ({ id: `${name}Statistics`, type: 'composite', window: schedule(),
        inputs: [{ id: 'state', metricId: `${name}Flag` }, { id: 'from', metricId: 'periodFrom' }],
        calculator: { provider: 'state', providerVersion: '1', inputTypes: { state: { type: 'array', elementType: { type: 'boolean' } }, from: number },
          outputType: { type: 'object', properties: ['activeDuration', 'inactiveDuration', 'unknownDuration', 'coverage'].map(id => ({ id, name: t(id), valueType: number })) },
          parameters: { maxHold: 'PT20M', activeValue: true, inactiveValue: false } },
      })),
      ...['working', 'energized'].flatMap(name => [
        formula(`${name}PeriodSeconds`, [`${name}Statistics`], `${name}Statistics['activeDuration']`, { window: schedule() }),
        formula(`${name}CoveragePercent`, [`${name}Statistics`], `${name}Statistics['coverage'] * 100`, { window: schedule() }),
        formula(`${name}UnknownSeconds`, [`${name}Statistics`], `${name}Statistics['unknownDuration']`, { window: schedule() }),
      ]),
      formula('equipmentCapacityPercent', ['workingStatistics'], `workingStatistics['activeDuration'] / ${periodSeconds}.0 * 100`, {
        applicabilityExpression: "workingStatistics['coverage'] == 1", window: schedule(),
      }),
      formula('equipmentUtilizationPercent', ['workingStatistics', 'energizedStatistics'], "workingStatistics['activeDuration'] / energizedStatistics['activeDuration'] * 100", {
        applicabilityExpression: "workingStatistics['coverage'] == 1 && energizedStatistics['coverage'] == 1 && energizedStatistics['activeDuration'] > 0", window: schedule(),
      }),
    ], [output('periodFrom', 'ms'), output('workingPeriodSeconds', 's'), output('energizedPeriodSeconds', 's'), output('equipmentCapacityPercent', '%'), output('equipmentUtilizationPercent', '%'),
      output('workingCoveragePercent', '%'), output('energizedCoveragePercent', '%'), output('workingUnknownSeconds', 's'), output('energizedUnknownSeconds', 's')])
    template.parameterDefinitions = [parameter('utcOffsetSeconds', 28800, 's', false)]
    return template
  }
  const fleet = base('fleetSummary', ['equipmentCount', 'faultDeviceCount', 'startedDeviceCount', 'runningDeviceCount', 'workTotalSeconds', 'powerTotalSeconds'].map(id => input(id, id.endsWith('Seconds') ? 's' : undefined, { maxAge:'PT10M' })), [
    formula('equipmentSoundPercent', ['equipmentCount', 'faultDeviceCount'], '(equipmentCount - faultDeviceCount) * 100.0 / equipmentCount', { applicabilityExpression: 'equipmentCount > 0', maxInputSkew: 'PT5S' }),
    formula('equipmentStartedPercent', ['equipmentCount', 'startedDeviceCount'], 'startedDeviceCount * 100.0 / equipmentCount', { applicabilityExpression: 'equipmentCount > 0', maxInputSkew: 'PT5S' }),
    formula('equipmentLoadPercent', ['equipmentCount', 'runningDeviceCount'], 'runningDeviceCount * 100.0 / equipmentCount', { applicabilityExpression: 'equipmentCount > 0', maxInputSkew: 'PT5S' }),
    formula('fleetCapacityPercent', ['equipmentCount', 'workTotalSeconds'], 'workTotalSeconds * 100.0 / (equipmentCount * 1.0 * params.periodSeconds)', { applicabilityExpression: 'equipmentCount > 0 && params.periodSeconds > 0', maxInputSkew: 'PT5S' }),
    formula('fleetUtilizationPercent', ['equipmentCount', 'powerTotalSeconds'], 'powerTotalSeconds * 100.0 / (equipmentCount * 1.0 * params.periodSeconds)', { applicabilityExpression: 'equipmentCount > 0 && params.periodSeconds > 0', maxInputSkew: 'PT5S' }),
    formula('fleetWorkInPowerPercent', ['workTotalSeconds', 'powerTotalSeconds'], 'workTotalSeconds * 100.0 / powerTotalSeconds', { applicabilityExpression: 'powerTotalSeconds > 0', maxInputSkew: 'PT5S' }),
  ], ['equipmentSoundPercent', 'equipmentStartedPercent', 'equipmentLoadPercent', 'fleetCapacityPercent', 'fleetUtilizationPercent', 'fleetWorkInPowerPercent'].map(id => output(id, '%')))
  fleet.parameterDefinitions = [parameter('periodSeconds', 86400, 's')]
  fleet.definitions = fleet.definitions.map(item => ({ ...item, window:schedule() }))
  // 5分钟快照允许一个周期的调度余量，避免两次正常刷新之间被标为过期。
  const connections = base('fleetConnections', ['deviceCount', 'onlineDeviceCount', 'offlineDeviceCount'].map(id => input(id, undefined, { maxAge:'PT10M' })), [
    ...['deviceCount', 'onlineDeviceCount', 'offlineDeviceCount'].map(id => formula(`${id}Result`, [id], id, { window:schedule() })),
    formula('scopeOnlinePercent', ['deviceCount', 'onlineDeviceCount'], 'onlineDeviceCount * 100.0 / deviceCount', { applicabilityExpression:'deviceCount > 0', window:schedule() }),
  ], [...['deviceCount', 'onlineDeviceCount', 'offlineDeviceCount'].map(id => output(`${id}Result`)), output('scopeOnlinePercent', '%')])
  const connectionExample = make(connections, 'ClusterOutlined', [0, 5, 10].flatMap((minute, index) => frame(minute, { deviceCount:10, onlineDeviceCount:8 - index, offlineDeviceCount:1 + index })), start + 10 * 60_000)
  connectionExample.simulation!.configuration.inputMappings = Object.fromEntries(connections.inputDefinitions.map(item => [item.id, { kind:'builtin', thingType:'deviceGroup', thingId:'example-line', id:item.id }]))
  connectionExample.simulation!.samples = connectionExample.simulation!.samples.map(sample => ({ ...sample, thingType:'deviceGroup', thingId:'example-line', sourceKind:'builtin' }))
  const attendance = base('attendance', [input('expectedHeadcount'), input('presentHeadcount')], [
    formula('attendancePercent', ['expectedHeadcount', 'presentHeadcount'], 'presentHeadcount * 100.0 / expectedHeadcount', { applicabilityExpression: 'expectedHeadcount > 0', maxInputSkew: 'PT5S' }),
    formula('absentHeadcount', ['expectedHeadcount', 'presentHeadcount'], 'expectedHeadcount - presentHeadcount', { applicabilityExpression: 'presentHeadcount <= expectedHeadcount', maxInputSkew: 'PT5S' }),
  ], [output('attendancePercent', '%'), output('absentHeadcount')])
  const orders = base('orderCompletion', [input('plannedQuantity', 'pcs'), input('completedQuantity', 'pcs')], [
    formula('orderCompletionPercent', ['plannedQuantity', 'completedQuantity'], 'completedQuantity * 100.0 / plannedQuantity', { applicabilityExpression: 'plannedQuantity > 0', maxInputSkew: 'PT5S' }),
  ], [output('orderCompletionPercent', '%')])
  const mix = base('productionMix', ['componentQuantity', 'standardQuantity', 'blankQuantity'].map(id => input(id, 'pcs')), [
    formula('mixTotalQuantity', ['componentQuantity', 'standardQuantity', 'blankQuantity'], 'componentQuantity + standardQuantity + blankQuantity', { maxInputSkew: 'PT5S' }),
    ...['component', 'standard', 'blank'].map(name => formula(`${name}Percent`, [`${name}Quantity`, 'mixTotalQuantity'], `${name}Quantity * 100.0 / mixTotalQuantity`, { applicabilityExpression: 'mixTotalQuantity > 0', maxInputSkew: 'PT5S' })),
  ], [output('mixTotalQuantity', 'pcs'), ...['component', 'standard', 'blank'].map(name => output(`${name}Percent`, '%'))])
  // 周一零点前一条观测提供边界事实；10分钟心跳小于20分钟有效期，明确覆盖8小时。
  const monday = 16 * 60
  const equipmentSamples = [-10, ...Array.from({ length: 49 }, (_, index) => index * 10)].flatMap(minute => frame(monday + minute, {
    workingFlag: minute >= 0 && minute < 240, energizedFlag: minute >= 0 && minute < 360,
  }))
  const online = base('online', [input('connectionState', undefined, { valueType:states(['offline','online']), source:{ lookback:'PT2H', maxPoints:256 } })], [
    formula('connection', ['connectionState'], 'connectionState', { inputs:[{ id:'connectionState', metricId:'connectionState' }], stateTracking:{ maxNoData:'PT20M' },
      window:{ ...schedule(), emitInterval:'PT1M' }, options:{ stateLabels:[{ value:0, name:t('state_offline'), icon:'color:#ff4d4f' }, { value:1, name:t('state_online'), icon:'color:#52c41a' }] } }),
    ...['offline', 'online'].map((name, value) => formula(`${name}Seconds`, ['connection'], `connection == ${value} ? metricValues['connection'].getState().getDuration() : 0`, { window:{ ...schedule(), emitInterval:'PT1M' } })),
    { id:'connectionStatistics', type:'composite', inputs:[{ id:'state', metricId:'connectionState' }], window:{ ...schedule(), emitInterval:'PT1M' },
      calculator:{ provider:'state', providerVersion:'1', inputTypes:{ state:{ type:'array', elementType:{ type:'int' } } },
        outputType:{ type:'object', properties:['activeDuration', 'inactiveDuration', 'unknownDuration', 'coverage'].map(id => ({ id, name:t(id), valueType:number })) },
        parameters:{ duration:'PT1H', maxHold:'PT20M', activeValue:1, inactiveValue:0 } } },
    formula('onlineWindowSeconds', ['connectionStatistics'], "connectionStatistics['activeDuration']"),
    formula('offlineWindowSeconds', ['connectionStatistics'], "connectionStatistics['inactiveDuration']"),
    formula('unknownSeconds', ['connectionStatistics'], "connectionStatistics['unknownDuration']"),
    formula('coveragePercent', ['connectionStatistics'], "connectionStatistics['coverage'] * 100"),
  ], [{ ...output('connection'), valueType:'int' }, output('onlineSeconds', 's'), output('offlineSeconds', 's'), output('onlineWindowSeconds', 's'), output('offlineWindowSeconds', 's'), output('unknownSeconds', 's'), output('coveragePercent', '%')])
  online.options = { ...online.options, presentation:{ ...online.options?.presentation, settings:{ ...online.options?.presentation?.settings, summaryOutputs:['onlineWindowSeconds', 'offlineWindowSeconds'] } } }
  const onlineExample = make(online, 'WifiOutlined', ([[0, 1], [150, 0], [180, 1]] as const).map(([minute, value]) => ({
    ...point('connectionState', value, minute), quality:{ valid:true, attributes:{ stateSince:start + minute * 60_000 } },
  })), start + 240 * 60_000)
  return [
    make(window, 'BarChartOutlined', [point('temperature', 22, 0), point('temperature', 24, 5), point('temperature', 26, 10), point('temperature', 28, 20)]),
    make(meter, 'ThunderboltOutlined', [point('reading', 100, 0), point('reading', 104, 15), point('reading', 110, 30)]),
    make(cooling, 'ApartmentOutlined', [point('flow', 10, 0), point('supplyTemperature', 7, 0), point('returnTemperature', 12, 0), point('power', 10, 0), point('mode', 'steady', 0)]),
    make(health, 'HeartOutlined', [point('temperature', 65, 0), point('vibration', 4.2, 0), point('temperature', 85, 1), point('vibration', 8, 2)]),
    make(state, 'ClockCircleOutlined', [point('operating', 0, 0), point('operating', 1, 5), point('operating', 2, 15), point('operating', 3, 25), point('operating', 4, 35), point('operating', 1, 45), point('operating', 1, 60)]),
    make(fire, 'SafetyOutlined', [point('smoke', 3, 0), point('temperature', 70, 0), point('temperature', 30, 6)], start + 9 * 60_000),
    make(intensity, 'ThunderboltOutlined', [0, 30, 60].flatMap((minute, index) => frame(minute, { electricityReading: 1000 + index * 60, productionReading: 200 + index * 20 }))),
    make(comprehensive, 'CalculatorOutlined', [0, 30, 60].flatMap((minute, index) => frame(minute, { electricityReading: 1000 + index * 50, gasReading: 10 + index * 10 }))),
    make(water, 'ExperimentOutlined', [0, 30, 60].flatMap((minute, index) => frame(minute, { mainReading: 1000 + index * 50, branchAReading: 100 + index * 17.5, branchBReading: 200 + index * 22.5, storageVolume: 30 + index * 2.5 }))),
    make(bearing, 'DashboardOutlined', [frame(0, { bearingTemperature: 65, ambientTemperature: 25, mode: 'steady' }), frame(1, { bearingTemperature: 85, ambientTemperature: 25, mode: 'steady' })].flat()),
    make(filter, 'FilterOutlined', [frame(0, { inletPressure: 500, outletPressure: 420, airFlow: 2000, mode: 'steady' }), frame(1, { inletPressure: 500, outletPressure: 260, airFlow: 2000, mode: 'steady' })].flat()),
    make(cold, 'AlertOutlined', [5, 9, 9, 9, 9, 9, 9, 5, 5, 5].map((value, minute) => point('temperature', value, minute)), start + 9 * 60_000),
    make(ventilation, 'CloudOutlined', [700, 1100, 1100, 1100, 1100, 700, 700].map((value, minute) => point('co2', value, minute)), start + 6 * 60_000),
    make(fireWater, 'SafetyCertificateOutlined', [frame(0, { waterPressure: 0.4, waterLevel: 2.4 }), frame(1, { waterPressure: 0.28, waterLevel: 2.4 })].flat()),
    make(equipmentState, 'DashboardOutlined', [...equipmentStates.map((_, value) => point('operating', value, monday + value * 10)), point('operating', 0, monday + 70)], start + (monday + 75) * 60_000),
    ...[false, true].map(weekly => make(calendarEquipment(weekly), 'ClockCircleOutlined', equipmentSamples.map(sample => ({ ...sample })), start + (monday + 480) * 60_000)),
    make(fleet, 'ClusterOutlined', frame(0, { equipmentCount: 2, faultDeviceCount: 1, startedDeviceCount: 2, runningDeviceCount: 1, workTotalSeconds: 18000, powerTotalSeconds: 43200 }), start + 5 * 60_000),
    make(attendance, 'TeamOutlined', frame(0, { expectedHeadcount: 100, presentHeadcount: 92 })),
    make(orders, 'CheckCircleOutlined', frame(0, { plannedQuantity: 100, completedQuantity: 80 })),
    make(mix, 'PieChartOutlined', frame(0, { componentQuantity: 60, standardQuantity: 30, blankQuantity: 10 })),
    connectionExample,
    onlineExample,
    createCommunicationStarter(t),
    ...createFireStarters(t),
  ]
}
