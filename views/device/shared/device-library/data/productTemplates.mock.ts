import {
  IOT2_DEVICE_TYPE_CATEGORY_META,
  IOT2_DEVICE_TYPE_INDUSTRY_META,
  IOT2_DEVICE_TYPE_PROTOCOL_META,
  IOT2_DEVICE_TYPE_STATUS_META,
} from '../hooks/useIot2DeviceTypeMeta'
import type {
  Iot2DeviceTypeCategory,
  Iot2DeviceTypeFlowTarget,
  Iot2DeviceTypeIndustry,
  Iot2DeviceTypeProtocol,
  Iot2DeviceTypeThingModelItem,
  Iot2ProductTemplate,
  Iot2ProductTemplateFilterOptions,
  Iot2ProductTemplatePageResult,
  Iot2ProductTemplateProvider,
  Iot2ProductTemplateQuery,
  Iot2ProductTemplateStatus,
  Iot2TemplateParameterField,
  Iot2TemplateParameterOption,
  Iot2TemplateParameterValues,
} from '@device-manager-ui/views/device/shared/device-library/services/iot2.types'

export const IOT2_PRODUCT_TEMPLATE_DEFAULT_QUERY: Iot2ProductTemplateQuery = {
  projectId: '',
  keyword: '',
  industry: 'all',
  brand: 'all',
  protocol: 'all',
  category: 'all',
  provider: 'all',
  status: 'published',
  page: 1,
  pageSize: 20,
  sortBy: 'recommended',
  sortOrder: 'desc',
}

const providerMeta: Record<Iot2ProductTemplateProvider, { label: string }> = {
  official: { label: '官方' },
  custom: { label: '用户自建' },
  'third-party': { label: '第三方' },
}

const providerKeys: Iot2ProductTemplateProvider[] = ['official', 'custom', 'third-party']

function thing(
  kind: 'properties' | 'events' | 'services',
  name: string,
  identifier: string,
  dataType: string,
  groupName: string,
  patch: Partial<Iot2DeviceTypeThingModelItem> = {},
): Iot2DeviceTypeThingModelItem {
  return {
    id: `tpl-${kind}-${identifier}`,
    kind,
    name,
    identifier,
    dataType,
    groupName,
    accessMode: kind === 'properties' ? 'read' : undefined,
    reported: kind === 'properties',
    level: kind === 'events' ? 'alarm' : undefined,
    callMode: kind === 'services' ? 'async' : undefined,
    description: '由产品模板预置，创建后可在设备类型详情页继续调整。',
    ...patch,
  }
}

function standardModel(extra: Iot2DeviceTypeThingModelItem[] = []) {
  return {
    properties: [
      thing('properties', '运行状态', 'status', 'enum', '基础状态', { valueRange: 'normal / warning / fault' }),
      thing('properties', '信号强度', 'signalStrength', 'number', '通信质量', { unit: 'dBm', valueRange: '-120--40' }),
      thing('properties', '固件版本', 'firmwareVersion', 'string', '设备维护'),
      ...extra.filter((item) => item.kind === 'properties'),
    ],
    events: [
      thing('events', '离线事件', 'offline', 'event', '连接状态', { level: 'alarm' }),
      thing('events', '故障码上报', 'faultCode', 'event', '故障诊断', { level: 'fault' }),
      ...extra.filter((item) => item.kind === 'events'),
    ],
    services: [
      thing('services', '同步配置', 'syncConfig', 'service', '维护指令', { callMode: 'async', inputCount: 2, outputCount: 1 }),
      ...extra.filter((item) => item.kind === 'services'),
    ],
  }
}

function commonDocs(name: string, protocol: Iot2DeviceTypeProtocol, brand: string) {
  return [
    `# ${name} 接入说明`,
    '',
    `## 适用范围`,
    `适用于 ${brand} 的标准 ${protocol} 设备接入。模板已内置认证方式、默认 Topic / 地址、物模型和告警规则。`,
    '',
    `## 接入前准备`,
    '- 确认设备接入协议版本与模板参数一致。',
    '- 设备出厂证书或密钥需由平台生成或由厂商预置。',
    '- 首次联调建议先创建 1 台测试设备，并观察在线状态和属性上报。',
    '',
    `## 调试建议`,
    '如果设备上线后 3 分钟内没有属性上报，请检查网络、时间同步和认证密钥来源。',
  ].join('\n')
}

function endpoint(protocol: Iot2DeviceTypeProtocol, key: string) {
  if (protocol === 'HTTP') return `https://api.project-iot2.local/${key}`
  if (protocol === 'Modbus') return `modbus-gateway.project-iot2.local/${key}`
  if (protocol === 'GB28181') return 'sip.project-iot2.local:5060'
  if (protocol === 'OPC UA') return `opc.tcp://edge.project-iot2.local/${key}`
  return `${protocol.toLowerCase().replace(/\s+/g, '-')}.project-iot2.local`
}

function baseTemplate(input: {
  id: string
  name: string
  icon: string
  description: string
  industry: Iot2DeviceTypeIndustry
  brand: string
  model: string
  protocol: Iot2DeviceTypeProtocol
  category: Iot2DeviceTypeCategory
  provider?: Iot2ProductTemplateProvider
  status?: Iot2ProductTemplateStatus
  version: string
  tags: string[]
  usageCount: number
  popularity: number
  maintainer: string
  updatedAt: string
  authMode: string
  dataFormat: string
  codecMode: string
  codecDescription: string
  thingModel: Iot2ProductTemplate['thingModel']
  parameterSchema: Iot2TemplateParameterField[]
  dataFlows?: Array<{ name: string; target: Iot2DeviceTypeFlowTarget; filter: string }>
  alarmRules?: Iot2ProductTemplate['defaultAlarmRules']
  document?: string
}): Iot2ProductTemplate {
  const {
    authMode,
    dataFlows,
    alarmRules,
    document,
    ...base
  } = input
  return {
    ...base,
    provider: input.provider ?? 'official',
    status: input.status ?? 'published',
    accessPreset: {
      endpoint: endpoint(input.protocol, input.id),
      topicPrefix: input.protocol === 'HTTP'
        ? `/api/iot2/${input.id}/properties`
        : input.protocol === 'Modbus'
          ? `modbus://${input.id}/registers`
          : `/iot2/${input.id}/+/properties`,
      protocolConfig: [
        { key: 'timeout', label: '采集超时', value: input.protocol === 'Modbus' ? '3 秒' : '10 秒' },
        { key: 'heartbeat', label: '默认心跳', value: input.category === 'network' ? '30 秒' : '5 分钟' },
      ],
    },
    authPreset: {
      mode: authMode,
      keyRule: authMode === 'X.509 证书' ? '证书由平台签发，设备侧烧录证书链。' : '设备密钥由平台生成，可批量导出给厂商烧录。',
    },
    defaultDataFlows: dataFlows ?? [
      { name: '属性上报写入消息队列', target: 'Kafka', filter: 'properties.*' },
    ],
    defaultAlarmRules: alarmRules ?? [
      { name: '设备离线超过心跳阈值', severity: 'major', condition: 'lastReportAt > heartbeatTimeout' },
      { name: '故障码上报', severity: 'major', condition: 'event.faultCode exists' },
    ],
    document: document ?? commonDocs(input.name, input.protocol, input.brand),
  }
}

const protocolVersionOptions: Record<Iot2DeviceTypeProtocol, Iot2TemplateParameterOption[]> = {
  MQTT: [
    { key: 'mqtt-3.1.1', label: 'MQTT 3.1.1' },
    { key: 'mqtt-5.0', label: 'MQTT 5.0' },
  ],
  CoAP: [
    { key: 'coap-rfc7252', label: 'CoAP RFC 7252' },
  ],
  HTTP: [
    { key: 'http-1.1', label: 'HTTP/1.1' },
    { key: 'http-2', label: 'HTTP/2' },
  ],
  Modbus: [
    { key: 'modbus-rtu', label: 'Modbus RTU' },
    { key: 'modbus-tcp', label: 'Modbus TCP' },
  ],
  'OPC UA': [
    { key: 'opcua-1.04', label: 'OPC UA 1.04' },
    { key: 'opcua-1.05', label: 'OPC UA 1.05' },
  ],
  GB28181: [
    { key: 'gb28181-2016', label: 'GB/T 28181-2016' },
    { key: 'gb28181-2022', label: 'GB/T 28181-2022' },
  ],
  Custom: [
    { key: 'custom-v1', label: '私有协议 v1' },
    { key: 'custom-v2', label: '私有协议 v2' },
  ],
}

const protocolVersionField = (protocol: Iot2DeviceTypeProtocol): Iot2TemplateParameterField => ({
  key: 'protocolVersion',
  label: '协议版本',
  type: 'select',
  groupKey: 'protocol',
  groupLabel: '协议参数',
  required: true,
  defaultValue: protocolVersionOptions[protocol][0]?.key,
  options: protocolVersionOptions[protocol],
  tooltip: '选择设备实际对接的协议版本，模板会按该版本套用 Topic / 路径、报文和解析规则。',
})

export const IOT2_PRODUCT_TEMPLATE_SEEDS: Iot2ProductTemplate[] = [
  baseTemplate({
    id: 'tpl-fire-smoke-mqtt',
    name: '消防无线烟感 MQTT 标准模板',
    icon: 'FireOutlined',
    description: '适合商铺、楼宇公共区的无线烟感，预置电量、烟雾浓度、故障码和离线告警。',
    industry: 'fire',
    brand: '星安消防',
    model: 'SA-SM 系列',
    protocol: 'MQTT',
    category: 'direct',
    version: 'v3.2.0',
    tags: ['消防', '电池设备', '官方推荐'],
    usageCount: 126,
    popularity: 98,
    maintainer: '平台模板组',
    updatedAt: '2026-04-26T08:20:00.000Z',
    authMode: '一机一密',
    dataFormat: 'JSON',
    codecMode: '内置解析',
    codecDescription: '标准 JSON 属性上报，无需自定义脚本。',
    thingModel: standardModel([
      thing('properties', '烟雾浓度', 'smokeDensity', 'number', '消防状态', { unit: 'ppm', valueRange: '0-1000' }),
      thing('properties', '电量', 'batteryLevel', 'number', '基础状态', { unit: '%', valueRange: '0-100' }),
      thing('events', '烟雾告警', 'smokeAlarm', 'event', '消防状态', { level: 'fault' }),
      thing('services', '消音复位', 'muteAndReset', 'service', '维护指令', { callMode: 'sync' }),
    ]),
    parameterSchema: [
      protocolVersionField('MQTT'),
      { key: 'installScene', label: '部署场景', type: 'radio', groupKey: 'basic', groupLabel: '初始化参数', required: true, defaultValue: 'indoor', options: [
        { key: 'indoor', label: '室内' },
        { key: 'corridor', label: '走廊' },
        { key: 'basement', label: '地下空间' },
      ] },
    ],
  }),
  baseTemplate({
    id: 'tpl-commercial-water-modbus',
    name: '商业空间智能水表 Modbus 模板',
    icon: 'BgColorsOutlined',
    description: '适用于 RS485 总线水表，预置累计流量、瞬时流量、阀门状态和抄表服务。',
    industry: 'commercial-space',
    brand: '江河仪表',
    model: 'JH-WM V2',
    protocol: 'Modbus',
    category: 'direct',
    version: 'v2.5.1',
    tags: ['水务', 'RS485', '抄表'],
    usageCount: 88,
    popularity: 92,
    maintainer: '平台模板组',
    updatedAt: '2026-04-18T05:40:00.000Z',
    authMode: '动态注册',
    dataFormat: '二进制',
    codecMode: 'Modbus 寄存器映射',
    codecDescription: '模板内置 40001-40120 寄存器映射。',
    thingModel: standardModel([
      thing('properties', '累计流量', 'totalFlow', 'number', '计量数据', { unit: 'm3' }),
      thing('properties', '瞬时流量', 'instantFlow', 'number', '计量数据', { unit: 'm3/h' }),
      thing('properties', '阀门状态', 'valveStatus', 'enum', '控制状态'),
      thing('services', '远程抄表', 'readMeter', 'service', '维护指令', { callMode: 'sync' }),
    ]),
    parameterSchema: [
      protocolVersionField('Modbus'),
      { key: 'meterVariant', label: '表具口径', type: 'select', groupKey: 'hardware', groupLabel: '硬件参数', defaultValue: 'dn25', options: [
        { key: 'dn15', label: 'DN15' },
        { key: 'dn25', label: 'DN25' },
        { key: 'dn50', label: 'DN50' },
      ] },
    ],
  }),
  baseTemplate({
    id: 'tpl-gb28181-camera',
    name: 'GB28181 标准摄像头模板',
    icon: 'VideoCameraOutlined',
    description: '用于网络摄像头接入，预置 SIP 域、通道编码、注册保活和在线状态事件。',
    industry: 'commercial-space',
    brand: '通用视频',
    model: 'GB28181-2016',
    protocol: 'GB28181',
    category: 'network',
    version: 'v1.4.0',
    tags: ['视频', '网络设备', '标准协议'],
    usageCount: 73,
    popularity: 86,
    maintainer: '平台模板组',
    updatedAt: '2026-04-10T02:10:00.000Z',
    authMode: '平台证书',
    dataFormat: 'GB28181',
    codecMode: '标准通道解析',
    codecDescription: '使用 GB28181 标准信令解析，无需用户上传脚本。',
    thingModel: standardModel([
      thing('properties', '通道状态', 'channelStatus', 'enum', '视频状态'),
      thing('properties', '码流地址', 'streamUrl', 'string', '视频状态'),
      thing('events', '注册失败', 'registerFailed', 'event', '接入状态', { level: 'alarm' }),
      thing('services', '请求快照', 'captureSnapshot', 'service', '视频服务', { callMode: 'sync' }),
    ]),
    parameterSchema: [
      protocolVersionField('GB28181'),
      { key: 'sipDomain', label: 'SIP 域', type: 'text', groupKey: 'sip', groupLabel: 'SIP 参数', required: true, defaultValue: '3402000000', validation: { pattern: '^\\d{10}$', message: 'SIP 域需要 10 位数字。' } },
      { key: 'channelPrefix', label: '通道编码前缀', type: 'text', groupKey: 'sip', groupLabel: 'SIP 参数', required: true, defaultValue: '3402000000132' },
    ],
  }),
  baseTemplate({
    id: 'tpl-smart-park-gateway-mqtt',
    name: '园区边缘网关 MQTT 模板',
    icon: 'ApartmentOutlined',
    description: '适合园区子设备汇聚网关，预置子设备上线、协议转换和批量配置服务。',
    industry: 'smart-park',
    brand: '云启边缘',
    model: 'YQ-GW Pro',
    protocol: 'MQTT',
    category: 'gateway',
    version: 'v2.1.0',
    tags: ['网关', '子设备接入', '边缘'],
    usageCount: 64,
    popularity: 89,
    maintainer: '平台模板组',
    updatedAt: '2026-04-16T06:25:00.000Z',
    authMode: 'X.509 证书',
    dataFormat: 'JSON',
    codecMode: '脚本解析',
    codecDescription: '内置网关子设备透传解析脚本，可在详情页继续调试。',
    thingModel: standardModel([
      thing('properties', '子设备数量', 'childDeviceCount', 'number', '网关状态'),
      thing('properties', 'CPU 使用率', 'cpuUsage', 'number', '网关状态', { unit: '%' }),
      thing('events', '子设备离线', 'childOffline', 'event', '子设备状态', { level: 'alarm' }),
      thing('services', '同步子设备配置', 'syncChildConfig', 'service', '网关服务', { callMode: 'async' }),
    ]),
    parameterSchema: [
      protocolVersionField('MQTT'),
      { key: 'childProtocol', label: '子设备协议', type: 'checkbox-group', groupKey: 'child', groupLabel: '子设备参数', defaultValue: ['Modbus'], options: [
        { key: 'Modbus', label: 'Modbus' },
        { key: 'BLE', label: 'BLE' },
        { key: 'ZigBee', label: 'ZigBee' },
      ] },
    ],
  }),
  baseTemplate({
    id: 'tpl-logistics-temp-http',
    name: '冷链温湿度 HTTP 模板',
    icon: 'DashboardOutlined',
    description: '冷链库、仓储空间温湿度采集模板，支持温度越界和传感器故障事件。',
    industry: 'logistics',
    brand: '冷云科技',
    model: 'LY-TX 系列',
    protocol: 'HTTP',
    category: 'direct',
    provider: 'third-party',
    version: 'v2.0.3',
    tags: ['冷链', '温湿度', '第三方'],
    usageCount: 51,
    popularity: 81,
    maintainer: '冷云科技',
    updatedAt: '2026-03-28T07:10:00.000Z',
    authMode: '一机一密',
    dataFormat: 'JSON',
    codecMode: '内置解析',
    codecDescription: 'HTTP JSON 上报，平台直接按字段映射物模型。',
    thingModel: standardModel([
      thing('properties', '温度', 'temperature', 'number', '环境数据', { unit: '℃' }),
      thing('properties', '湿度', 'humidity', 'number', '环境数据', { unit: '%' }),
      thing('events', '温度越界', 'temperatureExceeded', 'event', '环境告警', { level: 'alarm' }),
    ]),
    parameterSchema: [
      protocolVersionField('HTTP'),
      { key: 'reportInterval', label: '上报间隔', type: 'number', groupKey: 'comm', groupLabel: '通信参数', defaultValue: 300, unit: '秒', validation: { min: 30, max: 3600 } },
    ],
  }),
  baseTemplate({
    id: 'tpl-energy-meter-modbus',
    name: '三相智能电表 Modbus 模板',
    icon: 'DashboardOutlined',
    description: '商业楼宇和园区电力计量模板，预置电压、电流、功率、电能和倍率配置。',
    industry: 'energy',
    brand: '衡能电气',
    model: 'HN-EM3',
    protocol: 'Modbus',
    category: 'direct',
    version: 'v4.3.0',
    tags: ['能耗', '三相电表', '抄表'],
    usageCount: 107,
    popularity: 95,
    maintainer: '平台模板组',
    updatedAt: '2026-04-20T09:00:00.000Z',
    authMode: '动态注册',
    dataFormat: '二进制',
    codecMode: 'Modbus 寄存器映射',
    codecDescription: '内置三相电表寄存器映射和倍率计算。',
    thingModel: standardModel([
      thing('properties', 'A 相电压', 'voltageA', 'number', '电参量', { unit: 'V' }),
      thing('properties', '总有功功率', 'activePowerTotal', 'number', '电参量', { unit: 'kW' }),
      thing('properties', '正向有功电能', 'energyForward', 'number', '计量数据', { unit: 'kWh' }),
      thing('events', '电压越限', 'voltageExceeded', 'event', '电力告警', { level: 'alarm' }),
    ]),
    parameterSchema: [
      protocolVersionField('Modbus'),
      { key: 'ctRatio', label: '互感器倍率', type: 'number', groupKey: 'metering', groupLabel: '计量参数', required: true, defaultValue: 100, validation: { min: 1, max: 5000 } },
    ],
  }),
  baseTemplate({
    id: 'tpl-park-door-sub-device',
    name: '园区门磁子设备模板',
    icon: 'LoginOutlined',
    description: '子设备门磁模板，通常挂载到边缘网关下，预置开关状态、防拆和低电量事件。',
    industry: 'smart-park',
    brand: '园感',
    model: 'YG-DC',
    protocol: 'MQTT',
    category: 'sub-device',
    provider: 'custom',
    version: 'v1.8.0',
    tags: ['门禁', '子设备', '低功耗'],
    usageCount: 34,
    popularity: 72,
    maintainer: '当前租户',
    updatedAt: '2026-03-12T06:30:00.000Z',
    authMode: '一型一密',
    dataFormat: 'JSON',
    codecMode: '内置解析',
    codecDescription: '网关透传 JSON，子设备不直接认证。',
    thingModel: standardModel([
      thing('properties', '门状态', 'doorStatus', 'enum', '门禁状态'),
      thing('properties', '电量', 'batteryLevel', 'number', '基础状态', { unit: '%' }),
      thing('events', '防拆告警', 'tamperAlarm', 'event', '门禁告警', { level: 'fault' }),
    ]),
    parameterSchema: [
      protocolVersionField('MQTT'),
      { key: 'bindGatewayRequired', label: '发布后必须绑定网关', type: 'note', groupKey: 'notice', groupLabel: '使用说明', description: '该模板用于子设备，创建设备实例时需要选择所属网关。' },
      { key: 'magnetType', label: '门磁安装方式', type: 'radio', groupKey: 'basic', groupLabel: '初始化参数', defaultValue: 'surface', options: [
        { key: 'surface', label: '明装' },
        { key: 'embedded', label: '暗装' },
      ] },
    ],
  }),
  baseTemplate({
    id: 'tpl-commercial-air-http',
    name: '商业空间空气质量 HTTP 模板',
    icon: 'CloudOutlined',
    description: '适合空气质量监测设备，预置 PM2.5、CO2、TVOC 和环境状态。',
    industry: 'commercial-space',
    brand: '通用品牌',
    model: 'AQ-HTTP',
    protocol: 'HTTP',
    category: 'direct',
    version: 'v1.1.0',
    tags: ['空气质量', '简单模板'],
    usageCount: 29,
    popularity: 68,
    maintainer: '平台模板组',
    updatedAt: '2026-02-21T03:10:00.000Z',
    authMode: '一机一密',
    dataFormat: 'JSON',
    codecMode: '内置解析',
    codecDescription: '标准 HTTP JSON 上报，仅需确认协议版本。',
    thingModel: standardModel([
      thing('properties', 'PM2.5', 'pm25', 'number', '环境数据', { unit: 'μg/m3' }),
      thing('properties', 'CO2', 'co2', 'number', '环境数据', { unit: 'ppm' }),
      thing('properties', 'TVOC', 'tvoc', 'number', '环境数据'),
    ]),
    parameterSchema: [
      protocolVersionField('HTTP'),
    ],
  }),
  baseTemplate({
    id: 'tpl-industrial-opcua-edge',
    name: '工业 OPC UA 采集节点模板',
    icon: 'ToolOutlined',
    description: '面向工业现场 OPC UA 数据采集节点，预置点位同步、连接状态和边缘缓存配置。',
    industry: 'general',
    brand: '工智边缘',
    model: 'GZ-OPC',
    protocol: 'OPC UA',
    category: 'gateway',
    provider: 'third-party',
    version: 'v1.0.5',
    tags: ['工业', 'OPC UA', '边缘采集'],
    usageCount: 18,
    popularity: 61,
    maintainer: '工智边缘',
    updatedAt: '2026-02-08T08:00:00.000Z',
    authMode: 'X.509 证书',
    dataFormat: '自定义编解码',
    codecMode: '脚本解析',
    codecDescription: '节点路径和数据类型由模板参数初始化后生成。',
    thingModel: standardModel([
      thing('properties', '采集点位数', 'pointCount', 'number', '采集状态'),
      thing('events', 'OPC UA 连接异常', 'opcConnectionFailed', 'event', '接入状态', { level: 'fault' }),
    ]),
    parameterSchema: [
      protocolVersionField('OPC UA'),
      { key: 'securityPolicy', label: '安全策略', type: 'select', groupKey: 'opc', groupLabel: 'OPC UA 参数', defaultValue: 'Basic256Sha256', options: [
        { key: 'None', label: 'None' },
        { key: 'Basic256Sha256', label: 'Basic256Sha256' },
      ] },
    ],
  }),
  baseTemplate({
    id: 'tpl-custom-lora-sensor',
    name: 'LoRa 私有协议传感器模板',
    icon: 'RadarChartOutlined',
    description: '面向私有 LoRa 传感器，模板预置脚本解析和频段参数。',
    industry: 'smart-park',
    brand: '森联',
    model: 'SL-LR',
    protocol: 'Custom',
    category: 'direct',
    status: 'draft',
    version: 'v0.8.0',
    tags: ['LoRa', '私有协议', '脚本解析'],
    usageCount: 15,
    popularity: 58,
    maintainer: '平台模板组',
    updatedAt: '2026-01-25T04:50:00.000Z',
    authMode: '一机一密',
    dataFormat: '自定义编解码',
    codecMode: '脚本解析',
    codecDescription: '脚本按字节帧解析温度、电量和告警位。',
    thingModel: standardModel([
      thing('properties', '传感值', 'sensorValue', 'number', '业务数据'),
      thing('events', '帧校验失败', 'crcFailed', 'event', '接入状态', { level: 'alarm' }),
    ]),
    parameterSchema: [
      protocolVersionField('Custom'),
      { key: 'frequencyBand', label: '通信频段', type: 'select', groupKey: 'comm', groupLabel: '通信参数', required: true, defaultValue: 'cn470', options: [
        { key: 'cn470', label: 'CN470' },
        { key: 'eu868', label: 'EU868' },
        { key: 'as923', label: 'AS923' },
      ] },
    ],
  }),
]

function cloneTemplate(item: Iot2ProductTemplate): Iot2ProductTemplate {
  return JSON.parse(JSON.stringify(item)) as Iot2ProductTemplate
}

function toTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function matchesText(item: Iot2ProductTemplate, keyword: string) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return [
    item.name,
    item.id,
    item.brand,
    item.model,
    item.description,
    item.protocol,
    ...item.tags,
  ].join(' ').toLowerCase().includes(text)
}

function matchesQuery(item: Iot2ProductTemplate, query: Iot2ProductTemplateQuery) {
  if (!matchesText(item, query.keyword)) return false
  if (query.industry !== 'all' && item.industry !== query.industry) return false
  if (query.brand !== 'all' && item.brand !== query.brand) return false
  if (query.protocol !== 'all' && item.protocol !== query.protocol) return false
  if (query.category !== 'all' && item.category !== query.category) return false
  if (query.provider !== 'all' && item.provider !== query.provider) return false
  if (query.status !== 'all' && item.status !== query.status) return false
  return true
}

function sortItems(items: Iot2ProductTemplate[], query: Iot2ProductTemplateQuery) {
  const direction = query.sortOrder === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    if (query.sortBy === 'name') return a.name.localeCompare(b.name, 'zh-CN') * direction
    if (query.sortBy === 'usageCount') return (a.usageCount - b.usageCount) * direction
    if (query.sortBy === 'updatedAt') return (toTime(a.updatedAt) - toTime(b.updatedAt)) * direction
    return (a.popularity - b.popularity || a.usageCount - b.usageCount) * direction
  })
}

function optionCounts<T extends string>(
  items: Iot2ProductTemplate[],
  keys: readonly T[],
  keyOf: (item: Iot2ProductTemplate) => T,
  labelOf: (key: T) => string,
) {
  return [
    { key: 'all', label: '全部', count: items.length },
    ...keys.map((key) => ({
      key,
      label: labelOf(key),
      count: items.filter((item) => keyOf(item) === key).length,
    })),
  ]
}

export function buildIot2ProductTemplateFilterOptions(items = IOT2_PRODUCT_TEMPLATE_SEEDS): Iot2ProductTemplateFilterOptions {
  const brands = Array.from(new Set(items.map((item) => item.brand))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return {
    industries: optionCounts(
      items,
      Object.keys(IOT2_DEVICE_TYPE_INDUSTRY_META) as Iot2DeviceTypeIndustry[],
      (item) => item.industry,
      (key) => IOT2_DEVICE_TYPE_INDUSTRY_META[key].label,
    ),
    brands: [
      { key: 'all', label: '全部', count: items.length },
      ...brands.map((brand) => ({ key: brand, label: brand, count: items.filter((item) => item.brand === brand).length })),
    ],
    protocols: optionCounts(
      items,
      Object.keys(IOT2_DEVICE_TYPE_PROTOCOL_META) as Iot2DeviceTypeProtocol[],
      (item) => item.protocol,
      (key) => IOT2_DEVICE_TYPE_PROTOCOL_META[key].label,
    ),
    categories: optionCounts(
      items,
      Object.keys(IOT2_DEVICE_TYPE_CATEGORY_META) as Iot2DeviceTypeCategory[],
      (item) => item.category,
      (key) => IOT2_DEVICE_TYPE_CATEGORY_META[key].label,
    ),
    providers: optionCounts(items, providerKeys, (item) => item.provider, (key) => providerMeta[key].label),
    statuses: [
      { key: 'all', label: '全部', count: items.length, tone: 'default' },
      ...(['published', 'draft', 'disabled'] as Iot2ProductTemplateStatus[]).map((key) => ({
        key,
        label: IOT2_DEVICE_TYPE_STATUS_META[key].label,
        tone: IOT2_DEVICE_TYPE_STATUS_META[key].tone ?? 'default',
        count: items.filter((item) => item.status === key).length,
      })),
    ],
  }
}

export function buildIot2ProductTemplateListResult(
  query: Iot2ProductTemplateQuery,
  source = IOT2_PRODUCT_TEMPLATE_SEEDS,
): Iot2ProductTemplatePageResult {
  const filtered = sortItems(source.filter((item) => matchesQuery(item, query)), query)
  const pageSize = Math.max(20, query.pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(Math.max(1, query.page), totalPages)
  const start = (page - 1) * pageSize
  return {
    projectId: query.projectId,
    updatedAt: new Date().toISOString(),
    query: { ...query, page, pageSize },
    items: filtered.slice(start, start + pageSize).map(cloneTemplate),
    total: filtered.length,
    page,
    pageSize,
    filterOptions: buildIot2ProductTemplateFilterOptions(source),
  }
}

export function findIot2ProductTemplate(templateId: string, source = IOT2_PRODUCT_TEMPLATE_SEEDS) {
  const found = source.find((item) => item.id === templateId)
  return found ? cloneTemplate(found) : null
}

const hardwareOptions: Record<string, Iot2TemplateParameterOption[]> = {
  'tpl-fire-smoke-mqtt:hardwareModel': [
    { key: 'sa-sm-a1', label: 'SA-SM-A1', description: '标准无线烟感' },
    { key: 'sa-sm-b2', label: 'SA-SM-B2', description: '高灵敏度版本' },
  ],
  'tpl-energy-meter-modbus:hardwareModel:hn-em3': [
    { key: 'hn-em3-3p4w', label: 'HN-EM3 三相四线' },
    { key: 'hn-em3-3p3w', label: 'HN-EM3 三相三线' },
  ],
  'tpl-energy-meter-modbus:hardwareModel:hn-em5': [
    { key: 'hn-em5-ct', label: 'HN-EM5 互感器接入' },
    { key: 'hn-em5-direct', label: 'HN-EM5 直入式' },
  ],
  'tpl-commercial-water-modbus:registerMap': [
    { key: 'jh-v2-standard', label: 'JH V2 标准映射' },
    { key: 'jh-v2-valve', label: 'JH V2 阀控映射' },
  ],
}

export function buildIot2TemplateParameterOptions(
  templateId: string,
  fieldKey: string,
  values: Iot2TemplateParameterValues,
): Iot2TemplateParameterOption[] {
  if (templateId === 'tpl-energy-meter-modbus' && fieldKey === 'hardwareModel') {
    const series = String(values.brandSeries || 'hn-em3')
    return hardwareOptions[`${templateId}:${fieldKey}:${series}`] ?? []
  }
  return hardwareOptions[`${templateId}:${fieldKey}`] ?? []
}

