import type { MetricTemplateStarter } from '@rule-engine-manager-ui/metric'
import { scenario } from './starterScenario'
type Sample = { metricId: string; value: number; offsetSeconds: number }
const array = { type: 'array', elementType: { type: 'double' } }
const ref = (id: string) => ({ type: 'reference', id, path: [] })
const literal = (value: number) => ({ type: 'literal', valueType: 'double', value: String(value) })
const compare = (operator: string, id: string, value: number) => ({ type: 'binary', operator, left: ref(id), right: literal(value) })
const tree = (root: object) => ({ version: 1, root })
const window = (size: string, maxEntries = 128) => ({ mode: 'time', size, maxEntries, timeMode: 'event', emitPolicy: 'onEvent' })
const history = { source: { lookback: 'PT5M', maxPoints: 128 }, minSamples: 2, maxGap: 'PT30S', maxAge: 'PT30S' }
const samples = (metricId: string, values: number[], step = 15): Sample[] => values.map((value, index) => ({ metricId, value, offsetSeconds: index * step }))
const calculator = (provider: string, operation: string, input: string, unit?: string, parameters: Record<string, unknown> = {}) => ({
  type: 'composite', inputs: [{ id: provider === 'measurement' ? 'reading' : 'signal', metricId: input }],
  calculator: { provider, providerVersion: '1', inputTypes: { [provider === 'measurement' ? 'reading' : 'signal']: array },
    outputType: { type: 'double', scale: 8 }, ...(unit ? { outputUnit: unit } : {}), parameters: { operation, ...parameters } },
})


export const processStarters: MetricTemplateStarter[] = [
  scenario({
    id: 'power-energy', name: ['功率累计电量', 'Energy from power'], group: 'energy', icon: 'ThunderboltOutlined',
    description: ['将有功功率按实际时间积分，查看近期用电量。', 'Integrate active power over actual time to observe recent energy use.'],
    notes: ['示例功率为kW，输出kWh；前值保持，仅累计已覆盖区间，不外推整小时。每15秒采样，超过30秒缺口不给出完整用量；最多128点。也可用于流量累计，须同步修改输入、输出单位及时间基准。有电表累计读数时优先使用累计读数模板。',
      'Example units are kW and kWh. Hold the previous value over observed intervals; do not extrapolate a full hour. Samples arrive every 15 seconds; gaps over 30 seconds prevent a complete total. Cap at 128 points. For flow integration, change both units and the time basis. Prefer a counter template when meter totals are available.'],
    inputs: [{ id: 'power', name: ['有功功率', 'Active power'], unit: 'kW', valueType: { type: 'double' }, ...history }],
    rules: [{ id: 'energy', name: ['近期电量', 'Recent energy'], ...calculator('measurement', 'integral', 'power', 'kWh', { integration: 'left', timeUnit: 'PT1H', multiplier: 1 }) }],
    outputs: [{ metricId: 'energy', name: ['近期电量', 'Recent energy'], unit: 'kWh', valueType: 'double' }],
    samples: samples('power', [6, 6, 12, 12, 6]),
    reference: { name: 'OpenEnergyMonitor: Measuring power and energy', url: 'https://docs.openenergymonitor.org/electricity-monitoring/ac-power-theory/introduction.html' },
  }),
  scenario({
    id: 'time-weighted-temperature', name: ['不等间隔温度均值', 'Time-weighted temperature'], group: 'statistics', icon: 'FieldTimeOutlined',
    description: ['按每个温度值持续的时间，计算近期平均温度。', 'Weight each temperature by its duration to calculate a recent average.'],
    notes: ['适合变化上报或采样间隔不均的温度、液位等测点；按前值保持估计，保持超过30秒后的区间不参与均值。不是样本等权平均；无数据不补零。5分钟窗口最多128点，应按上报频率调整容量。',
      'For change-driven or irregular readings such as temperature or level. Use previous-value holding and exclude intervals beyond the 30-second hold limit. This is not an equally weighted sample mean. Missing values are not zero. The five-minute window holds at most 128 points; adjust capacity to cadence.'],
    inputs: [{ id: 'temperature', name: ['温度', 'Temperature'], unit: '°C', valueType: { type: 'double' }, maxAge: 'PT30S' }],
    rules: [{ id: 'weighted', name: ['时间加权温度', 'Time-weighted temperature'], type: 'feature', sourceMetric: 'temperature',
      timeAggregation: 'timeWeightedMean', window: { ...window('PT5M'), maxGap: 'PT30S' } }],
    outputs: [{ metricId: 'weighted', name: ['时间加权温度', 'Time-weighted temperature'], unit: '°C', valueType: 'double' }],
    samples: [{ metricId: 'temperature', value: 20, offsetSeconds: 0 }, { metricId: 'temperature', value: 30, offsetSeconds: 10 },
      { metricId: 'temperature', value: 40, offsetSeconds: 40 }],
    reference: { name: 'Timescale: Time-weighted averages', url: 'https://docs.timescale.com/use-timescale/latest/hyperfunctions/time-weighted-averages/' },
  }),
  scenario({
    id: 'pressure-variation', name: ['压力稳定性', 'Pressure stability'], group: 'statistics', icon: 'AreaChartOutlined',
    description: ['同时查看近期平均压力、波动大小和有效样本数。', 'Inspect recent mean pressure, variation and sample count together.'],
    notes: ['示例单位kPa、窗口5分钟；标准差按窗口内有效样本的总体标准差计算，单位与压力相同。少量样本和低标准差不代表设备健康，也不替代压力上下限检查。最多128点，缺样不补零；工况变化时应分开比较。',
      'Example unit kPa, five-minute window. Population standard deviation uses valid window samples and retains the pressure unit. Few samples or low deviation do not prove health or replace pressure limits. Cap at 128 points; do not fill missing data with zero. Compare operating modes separately.'],
    inputs: [{ id: 'pressure', name: ['压力', 'Pressure'], unit: 'kPa', valueType: { type: 'double' }, maxAge: 'PT30S' }],
    rules: [{ id: 'deviation', name: ['压力标准差', 'Pressure standard deviation'], type: 'feature', sourceMetric: 'pressure', aggregation: 'dev', window: window('PT5M') },
      { id: 'average', name: ['平均压力', 'Mean pressure'], type: 'feature', sourceMetric: 'pressure', aggregation: 'avg', window: window('PT5M') },
      { id: 'sampleCount', name: ['有效样本数', 'Valid sample count'], type: 'feature', sourceMetric: 'pressure', aggregation: 'count', window: window('PT5M') }],
    outputs: [{ metricId: 'deviation', name: ['压力标准差', 'Pressure standard deviation'], unit: 'kPa', valueType: 'double' },
      { metricId: 'average', name: ['平均压力', 'Mean pressure'], unit: 'kPa', valueType: 'double' },
      { metricId: 'sampleCount', name: ['有效样本数', 'Valid sample count'], valueType: 'long' }],
    samples: samples('pressure', [98, 100, 102, 100]),
    reference: { name: 'NIST: Measures of scale', url: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm' },
  }),
  scenario({
    id: 'response-latency', name: ['响应延迟 P95', 'Response latency P95'], group: 'connectivity', icon: 'DashboardOutlined',
    description: ['查看大多数请求的响应延迟，并保留最慢响应作对照。', 'Inspect tail response latency alongside the slowest response.'],
    notes: ['绑定已测得的响应耗时，不能用响应时间戳代替。示例单位ms，最近5分钟最多128点；P95采用R7插值。样本少时仅供观察，不能将各窗口或各设备的P95再次平均作为整体P95。超时请求须由来源明确记录，缺失响应不当作零延迟。',
      'Bind measured response duration, not a response timestamp. Example unit ms; at most 128 observations from five minutes. P95 uses R7 interpolation. Small samples are observational. Do not average per-window or per-device P95 values into a global P95. The source must explicitly record timeouts; absent responses are not zero latency.'],
    inputs: [{ id: 'latency', name: ['响应耗时', 'Response duration'], unit: 'ms', valueType: { type: 'double' },
      source: { lookback: 'PT5M', maxPoints: 128 }, minSamples: 2, maxAge: 'PT2M' }],
    rules: [{ id: 'p95', name: ['响应延迟 P95', 'Response latency P95'], ...calculator('signal', 'percentile', 'latency', 'ms', { percentile: 95, maxPoints: 128 }) },
      { id: 'slowest', name: ['最慢响应', 'Slowest response'], type: 'feature', sourceMetric: 'latency', aggregation: 'max', window: window('PT5M') }],
    outputs: [{ metricId: 'p95', name: ['响应延迟 P95', 'Response latency P95'], unit: 'ms', valueType: 'double' },
      { metricId: 'slowest', name: ['最慢响应', 'Slowest response'], unit: 'ms', valueType: 'double' }],
    samples: samples('latency', [20, 25, 30, 35, 200]),
    reference: { name: 'NIST: Percentiles', url: 'https://www.itl.nist.gov/div898/handbook/prc/section2/prc262.htm' },
  }),
  scenario({
    id: 'vibration-amplitude', name: ['振动幅值与尖峰', 'Vibration amplitude and peaks'], group: 'condition', icon: 'ShakeOutlined',
    description: ['观察振动原始采样的有效值及相对尖峰。', 'Observe RMS amplitude and relative peaks of vibration samples.'],
    notes: ['示例输入为已去除重力和直流分量的单轴加速度原始采样，单位m/s²；不能绑定传感器已经计算的RMS再当作波形。最近1秒最多128点，每秒计算一次；示例100Hz采样、间隔上限20ms，不适合直接接入高频振动原始流。RMS和峰值因子是时域观察，不能据此诊断轴承故障或套用振动速度标准。全零波形的峰值因子无定义。',
      'Bind raw single-axis acceleration after removing gravity and DC, in m/s²; do not treat sensor-computed RMS as a waveform. Retain at most 128 points from one second and calculate once per second. Example cadence 100 Hz, maximum gap 20 ms; do not connect high-frequency raw vibration streams directly. RMS and crest factor are time-domain observations, not bearing diagnosis or velocity-based severity limits. Crest factor is undefined for an all-zero waveform.'],
    inputs: [{ id: 'acceleration', name: ['加速度原始采样', 'Raw acceleration samples'], unit: 'm/s²', valueType: { type: 'double' },
      source: { lookback: 'PT1S', maxPoints: 128 }, minSamples: 8, maxGap: 'PT0.02S', maxAge: 'PT0.1S' }],
    rules: [{ id: 'rms', name: ['振动有效值', 'Vibration RMS'], ...calculator('signal', 'rms', 'acceleration', 'm/s²', { maxGap: 'PT0.02S', maxPoints: 128 }),
      window: { mode: 'none', emitPolicy: 'onSchedule', emitInterval: 'PT1S' } },
      { id: 'crest', name: ['峰值因子', 'Crest factor'], ...calculator('signal', 'crestFactor', 'acceleration', undefined, { maxGap: 'PT0.02S', maxPoints: 128 }),
        window: { mode: 'none', emitPolicy: 'onSchedule', emitInterval: 'PT1S' } }],
    outputs: [{ metricId: 'rms', name: ['振动有效值', 'Vibration RMS'], unit: 'm/s²', valueType: 'double' },
      { metricId: 'crest', name: ['峰值因子', 'Crest factor'], valueType: 'double' }],
    samples: [{ metricId: 'acceleration', value: 0, offsetSeconds: 0 },
      ...samples('acceleration', Array.from({ length: 101 }, (_, index) => index === 80 ? 5 : [0, 1, 0, -1][index % 4]), .01)
        .map(sample => ({ ...sample, offsetSeconds: sample.offsetSeconds + 59 }))],
    reference: { name: 'NI: Vibration measurement guide', url: 'https://www.ni.com/en/shop/data-acquisition/sensor-fundamentals/measuring-vibration-with-accelerometers.html' },
  }),
  scenario({
    id: 'rapid-temperature-rise', name: ['持续快速升温', 'Sustained rapid temperature rise'], group: 'condition', icon: 'RiseOutlined',
    description: ['按实际采样时间计算升温速率，持续过快时提示复核。', 'Calculate temperature rise over actual time and confirm sustained rapid heating.'],
    notes: ['按最近1分钟拟合速率，单位°C/min；至少3点。示例超过3°C/min持续1分钟成立，低于1°C/min持续30秒恢复，缺数2分钟停止判断；阈值须按工况标定。不是绝对温度越限或安全保护，最多128点，不能用采样序号代替时间。',
      'Fit the last minute against actual time, in °C/min; require three points. Example entry: above 3°C/min for one minute; recovery: below 1°C/min for 30 seconds; stop judging after two minutes without data. Calibrate thresholds to operating conditions. This is not an absolute-temperature limit or safety interlock. Cap at 128 points.'],
    inputs: [{ id: 'temperature', name: ['温度', 'Temperature'], unit: '°C', valueType: { type: 'double' }, maxAge: 'PT30S' }],
    rules: [{ id: 'riseRate', name: ['升温速率', 'Temperature rise rate'], type: 'feature', sourceMetric: 'temperature',
      timeAggregation: 'timeSlope', window: { ...window('PT1M'), timeUnit: 'PT1M' } },
      { id: 'sampleCount', name: ['有效样本数', 'Valid sample count'], type: 'feature', sourceMetric: 'temperature', aggregation: 'count', window: window('PT1M') },
      { id: 'rapidRise', name: ['持续快速升温', 'Sustained rapid rise'], dependsOn: ['riseRate', 'sampleCount'], temporalCondition: {
        dwell: 'PT1M', recovery: 'PT30S', maxNoData: 'PT2M',
        enterTree: tree({ type: 'logical', operator: 'and', operands: [compare('ge', 'sampleCount', 3), compare('gt', 'riseRate', 3)] }),
        exitTree: tree(compare('lt', 'riseRate', 1)),
      } }],
    outputs: [{ metricId: 'riseRate', name: ['升温速率', 'Temperature rise rate'], valueType: 'double' },
      { metricId: 'rapidRise', name: ['持续快速升温', 'Sustained rapid rise'], valueType: 'boolean' }],
    samples: samples('temperature', Array.from({ length: 26 }, (_, index) => 20 + Math.min(index, 12))),
    reference: { name: 'NIST: Linear least squares regression', url: 'https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd141.htm' },
  }),
]
