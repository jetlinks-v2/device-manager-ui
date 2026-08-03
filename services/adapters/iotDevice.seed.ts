import { DEVICE_LIBRARY } from '@device-manager-ui/services/device-library/adapters/deviceLibrary.seed'
import type { DeviceTemplate } from '@device-manager-ui/services/device-library/types'
import type {
  IotDevice,
  IotDeviceAlarm,
  IotDeviceFaultEvent,
  IotEventLevel,
  IotDeviceLog,
  IotDeviceRelation,
  IotDeviceRisk,
  IotDeviceRule,
  IotDeviceStatus,
  IotTelemetryPoint,
  IotTelemetryStatus,
} from '../../types'

const DEMO_PROJECT_ID = 'doraemon'

const PRODUCT_BY_ID = new Map(DEVICE_LIBRARY.map((item) => [item.id, item]))

const DEVICE_TYPE_LABEL: Record<DeviceTemplate['category'], string> = {
  video: '视频接入',
  meter: '计量仪表',
  sensor: '感知终端',
  industrial: '工业采集',
  integration: '系统接入',
}

interface AreaRef {
  id: string
  name: string
}

const AREA = {
  mallAtrium: { id: 'area-mall-atrium', name: '星环购物中心 · 中央中庭' },
  mallServiceDesk: { id: 'area-mall-service-desk', name: '星环购物中心 · 服务台' },
  mallFirePassage: { id: 'area-mall-fire-passage', name: '星环购物中心 · 消防通道' },
  mallParkingEast: { id: 'area-mall-parking-east', name: '星环购物中心 · 东侧车库' },
  mallLoading: { id: 'area-mall-loading', name: '星环购物中心 · 卸货通道' },
  fuelIsland: { id: 'area-fuel-island-1', name: '晨光能源站 · 1号加油岛' },
  fuelUnloading: { id: 'area-fuel-unloading', name: '晨光能源站 · 卸油区' },
  fuelStore: { id: 'area-fuel-store', name: '晨光能源站 · 便利店' },
  fuelCashier: { id: 'area-fuel-cashier', name: '晨光能源站 · 收银区' },
  fuelDuty: { id: 'area-fuel-duty', name: '晨光能源站 · 值班室' },
  chemControl: { id: 'area-chem-control-room', name: '青岚化工厂 · 中控大厅' },
  chemKettle: { id: 'area-chem-kettle', name: '青岚化工厂 · 反应釜区' },
  chemFeeding: { id: 'area-chem-feeding', name: '青岚化工厂 · 投料间' },
  chemTank: { id: 'area-chem-tank-farm', name: '青岚化工厂 · 储罐区' },
  chemLoading: { id: 'area-chem-loading', name: '青岚化工厂 · 装卸栈台' },
  careLobby: { id: 'area-care-lobby', name: '松龄颐养院 · 接待大厅' },
  careNurse: { id: 'area-care-nurse', name: '松龄颐养院 · 护理站' },
  careActivity: { id: 'area-care-activity', name: '松龄颐养院 · 活动室' },
  careEastWard: { id: 'area-care-east-ward', name: '松龄颐养院 · 东侧住区' },
  careGarden: { id: 'area-care-garden', name: '松龄颐养院 · 康复花园' },
  techOffice: { id: 'area-tech-open-office', name: '云栖科创园 · 开放办公区' },
  techLab: { id: 'area-tech-lab', name: '云栖科创园 · 联合实验室' },
  techMeeting: { id: 'area-tech-meeting', name: '云栖科创园 · 会议区' },
  techServerRoom: { id: 'area-tech-server-room', name: '云栖科创园 · 主机房' },
  techPowerRoom: { id: 'area-tech-ups', name: '云栖科创园 · UPS间' },
  techNorthGate: { id: 'area-tech-north-gate', name: '云栖科创园 · 北门访客区' },
} as const satisfies Record<string, AreaRef>

interface DeviceSeedInput {
  id: string
  name: string
  productKey: string
  area: AreaRef
  location: string
  owner: string
  identifier: string
  accessMode: string
  gatewayName?: string
  status?: IotDeviceStatus
  risk?: IotDeviceRisk
  lastSeen?: string
  summary?: string
  telemetry?: IotTelemetryPoint[]
  alarms?: IotDeviceAlarmSeed[]
  logs?: IotDeviceLog[]
  rules?: IotDeviceRule[]
  relations?: IotDeviceRelation[]
  tags?: string[]
  currentFaultCodes?: IotDeviceFaultSeed[]
  reasons?: string[]
  actions?: string[]
  evidence?: string[]
}

interface IotDeviceAlarmSeed {
  id: string
  level: IotEventLevel
  title: string
  summary: string
  happenedAt: string
  status: '待确认' | '处理中' | '已关闭'
}

interface IotDeviceFaultSeed {
  code: string
  raisedAt: string
}

function product(productKey: string): DeviceTemplate {
  const found = PRODUCT_BY_ID.get(productKey)
  if (!found) throw new Error(`Missing device library product: ${productKey}`)
  return found
}

function point(
  key: string,
  name: string,
  value: string,
  unit: string | undefined,
  status: IotTelemetryStatus,
  hint: string,
  updatedAt = '2 分钟前',
): IotTelemetryPoint {
  return { key, name, value, unit, status, updatedAt, hint }
}

function alarm(id: string, title: string, summary: string, level: IotEventLevel = '重要', happenedAt = '09:24'): IotDeviceAlarmSeed {
  return { id, level, title, summary, happenedAt, status: level === '紧急' ? '处理中' : '待确认' }
}

function log(id: string, title: string, message: string, level: IotDeviceLog['level'] = 'info', happenedAt = '09:20'): IotDeviceLog {
  return { id, level, title, message, happenedAt }
}

function rule(id: string, name: string, trigger: string, action: string, status: IotDeviceRule['status'] = '启用'): IotDeviceRule {
  return { id, name, trigger, action, status }
}

function severityFromLevel(level: IotEventLevel): IotDeviceAlarm['severity'] {
  if (level === '紧急') return 'urgent'
  if (level === '重要') return 'high'
  return 'normal'
}

function statusFromAlarmStatus(status: IotDeviceAlarmSeed['status']): IotDeviceAlarm['status'] {
  if (status === '处理中') return 'in_progress'
  if (status === '已关闭') return 'resolved'
  return 'new'
}

function alarmEvent(input: DeviceSeedInput, item: IotDeviceAlarmSeed): IotDeviceAlarm {
  return {
    id: item.id,
    source: 'iot-event',
    subType: 'alarm',
    occurredAt: item.happenedAt,
    status: statusFromAlarmStatus(item.status),
    severity: severityFromLevel(item.level),
    subjectKind: 'device',
    subjectRef: input.id,
    subjectName: input.name,
    areaRef: input.area.id,
    title: item.title,
    desc: item.summary,
    payload: {
      kind: 'alarm',
      level: item.level,
      summary: item.summary,
    },
  }
}

function faultLevel(input: DeviceSeedInput): IotEventLevel {
  if (input.risk === 'urgent' || input.status === 'alarm') return '紧急'
  if (input.risk === 'watch' || input.status === 'offline' || input.status === 'no-data') return '重要'
  return '提醒'
}

function faultEvent(input: DeviceSeedInput, item: IotDeviceFaultSeed): IotDeviceFaultEvent {
  const level = faultLevel(input)
  const summary = `设备上报活跃故障码 ${item.code}`
  return {
    id: `fault-${input.id}-${item.code}`,
    source: 'iot-event',
    subType: 'fault-code',
    occurredAt: item.raisedAt,
    status: 'new',
    severity: severityFromLevel(level),
    subjectKind: 'device',
    subjectRef: input.id,
    subjectName: input.name,
    areaRef: input.area.id,
    title: '设备故障码上报',
    desc: summary,
    payload: {
      kind: 'alarm',
      level,
      summary,
      faultCode: item.code,
    },
  }
}

function createDevice(input: DeviceSeedInput): IotDevice {
  const template = product(input.productKey)
  const status = input.status ?? 'online'
  const risk = input.risk ?? 'normal'
  const lastSeen = input.lastSeen ?? '2 分钟前'
  const summary = input.summary ?? '设备在线，当前运行稳定。'
  const access = input.accessMode

  return {
    id: input.id,
    projectId: DEMO_PROJECT_ID,
    name: input.name,
    productName: template.name,
    productKey: template.id,
    deviceType: DEVICE_TYPE_LABEL[template.category],
    area: input.area.name,
    areaId: input.area.id,
    location: input.location,
    owner: input.owner,
    status,
    risk,
    lastSeen,
    accessMode: access,
    gatewayName: input.gatewayName,
    identifier: input.identifier,
    summary,
    aiSummary: {
      conclusion: summary,
      reasons: input.reasons ?? ['最近上报稳定', '同区域未出现关联异常'],
      actions: input.actions ?? ['保持当前规则', '纳入班次巡检记录'],
      evidence: input.evidence ?? [`最近上报：${lastSeen}`, `区域：${input.area.name}`],
    },
    telemetry: input.telemetry ?? [],
    alarms: (input.alarms ?? []).map((item) => alarmEvent(input, item)),
    logs: input.logs ?? [log(`${input.id}-log-01`, '状态上报', `${template.name} ${summary}`, status === 'online' ? 'info' : 'warning')],
    rules: input.rules ?? [
      rule(`${input.id}-rule-01`, `${template.name}状态监测`, '设备离线 / 告警 / 关键点位越限', `通知${input.owner}`),
    ],
    relations: [
      { label: '区域节点', value: input.area.name, hint: input.area.id },
      { label: '设备库模板', value: template.name, hint: template.id },
      ...(input.relations ?? []),
    ],
    tags: input.tags ?? [],
    currentFaultCodes: input.currentFaultCodes?.map((item) => faultEvent(input, item)),
  }
}

export function createIotDeviceSeed(): IotDevice[] {
  return [
    createDevice({
      id: 'iot-mall-atrium-air-01',
      name: '中央中庭空气质量传感器 01',
      productKey: 'co2-air-quality-sensor',
      area: AREA.mallAtrium,
      location: '中庭西侧二层栏板',
      owner: '后勤主管',
      identifier: 'AQ-MALL-ATRIUM-01',
      accessMode: 'MQTT / Wi-Fi 直连',
      risk: 'watch',
      summary: '中庭客流高峰时 CO2 接近观察线，建议继续观察通风效果。',
      telemetry: [
        point('co2', 'CO2', '1080', 'ppm', 'warning', '高于舒适度观察线'),
        point('pm25', 'PM2.5', '18', 'μg/m³', 'normal', '空气过滤正常'),
        point('tvoc', 'TVOC', '0.34', 'mg/m³', 'normal', '稳定'),
      ],
      rules: [rule('r-mall-atrium-air', '中庭空气质量提醒', 'CO2 > 1000ppm 持续 20 分钟', '通知后勤主管', '建议调整')],
      alarms: [
        {
          id: 'a-mall-atrium-air-01-history',
          level: '重要',
          title: 'CO2 偏高已处理',
          summary: '活动高峰期间 CO2 短时升高，现场通风调整后已恢复。',
          happenedAt: '昨日 18:20',
          status: '已关闭',
        },
      ],
      tags: ['环境', '商业运营'],
      reasons: ['客流活动期间 CO2 上升明显', '同层温湿度正常，倾向于通风负荷问题'],
      actions: ['复核中庭新风时段', '活动结束后观察 30 分钟回落情况'],
      evidence: ['CO2：1080ppm', '区域：中央中庭'],
    }),
    createDevice({
      id: 'iot-mall-atrium-temp-01',
      name: '中央中庭温湿度传感器 01',
      productKey: 'temperature-humidity-sensor',
      area: AREA.mallAtrium,
      location: '中庭服务连廊',
      owner: '后勤主管',
      identifier: 'TH-MALL-ATRIUM-01',
      accessMode: 'HaiWell MQTT 直连',
      summary: '中庭温湿度稳定，可作为空气质量判断的环境参照。',
      telemetry: [
        point('temperature', '温度', '24.8', '°C', 'normal', '舒适区间'),
        point('humidity', '湿度', '56', '%', 'normal', '舒适区间'),
      ],
      tags: ['环境', '商业运营'],
    }),
    createDevice({
      id: 'iot-mall-service-sos-01',
      name: '服务台紧急按钮 01',
      productKey: 'emergency-button',
      area: AREA.mallServiceDesk,
      location: '服务台内侧',
      owner: '安保中心',
      identifier: 'SOS-MALL-SERVICE-01',
      accessMode: '低功耗网关映射',
      gatewayName: '1F 中庭 Zigbee 网关',
      summary: '服务台求助按钮在线，最近一次演练通过。',
      telemetry: [
        point('pressEvent', '按下事件', '无', undefined, 'normal', '未触发'),
        point('battery', '电池电压', '3.18', 'V', 'normal', '电量正常'),
      ],
      tags: ['安防', '商业运营'],
    }),
    createDevice({
      id: 'iot-mall-fire-smoke-01',
      name: '消防通道无线烟感 01',
      productKey: 'smoke-detector',
      area: AREA.mallFirePassage,
      location: '首层消防通道入口',
      owner: '安保中心',
      identifier: 'SD-MALL-FIRE-01',
      accessMode: 'NB-IoT 直连',
      status: 'alarm',
      risk: 'urgent',
      lastSeen: '4 分钟前',
      summary: '消防通道烟感处于告警中，需要现场确认是否为施工烟尘。',
      telemetry: [
        point('smoke', '烟雾状态', '告警', undefined, 'critical', '持续异常', '4 分钟前'),
        point('battery', '电池电压', '3.12', 'V', 'normal', '电量正常', '4 分钟前'),
      ],
      alarms: [alarm('a-mall-fire-smoke-01', '烟雾告警', '消防通道烟感连续上报告警', '紧急', '14:31')],
      logs: [log('l-mall-fire-smoke-01', '事件上报', '烟雾状态=告警', 'error', '14:31')],
      rules: [rule('r-mall-fire-smoke', '消防通道烟感告警', '烟雾状态=告警', '通知安保中心并进入告警中心')],
      tags: ['消防', '安防'],
      currentFaultCodes: [{ code: 'SD01', raisedAt: '14:31' }],
      reasons: ['烟感连续两次告警', '区域靠近施工围挡，需现场复核'],
      actions: ['安保中心现场确认', '确认施工影响后记录原因并复位'],
      evidence: ['最新上报：4 分钟前', '烟雾状态：告警'],
    }),
    createDevice({
      id: 'iot-mall-fire-door-01',
      name: '消防通道门磁 01',
      productKey: 'door-contact-sensor',
      area: AREA.mallFirePassage,
      location: '疏散门北侧',
      owner: '安保中心',
      identifier: 'DC-MALL-FIRE-01',
      accessMode: '低功耗网关映射',
      gatewayName: '1F 中庭 Zigbee 网关',
      summary: '消防通道门磁在线，门状态关闭。',
      telemetry: [
        point('openState', '开合状态', '关闭', undefined, 'normal', '状态正常'),
        point('battery', '电池电压', '3.04', 'V', 'normal', '电量正常'),
      ],
      tags: ['消防', '安防'],
    }),
    createDevice({
      id: 'iot-mall-parking-co-01',
      name: '东侧车库 CO 探测器 01',
      productKey: 'carbon-monoxide-sensor',
      area: AREA.mallParkingEast,
      location: '车库入口匝道',
      owner: '物业值班',
      identifier: 'CO-MALL-PARK-E-01',
      accessMode: 'RS485 / Modbus 采集',
      gatewayName: 'B1 环境采集器',
      risk: 'watch',
      summary: '车库入口晚高峰 CO 接近观察线，新风联动已开启。',
      telemetry: [
        point('co', 'CO 浓度', '31', 'ppm', 'warning', '高峰期接近观察线'),
        point('alarmFlag', '报警状态', '预警', undefined, 'warning', '未进入严重报警'),
      ],
      rules: [rule('r-mall-parking-co', '车库 CO 联动通风', 'CO > 30ppm 持续 5 分钟', '通知物业并开启通风', '建议调整')],
      tags: ['环境', '车库'],
    }),
    createDevice({
      id: 'iot-mall-parking-water-01',
      name: '东侧车库排水沟水浸 01',
      productKey: 'water-leak-sensor',
      area: AREA.mallParkingEast,
      location: 'B1 东侧排水沟',
      owner: '物业值班',
      identifier: 'WL-MALL-PARK-E-01',
      accessMode: '低功耗网关映射',
      gatewayName: 'B1 环境采集器',
      status: 'no-data',
      risk: 'urgent',
      lastSeen: '2 小时 12 分钟前',
      summary: '防汛点位长时间无数据，且处于车库排水沟关键位置。',
      telemetry: [
        point('water', '水浸状态', '未知', undefined, 'stale', '超过 60 分钟未刷新', '2 小时 12 分钟前'),
        point('battery', '电池电压', '2.74', 'V', 'warning', '低于建议值', '2 小时 12 分钟前'),
      ],
      alarms: [alarm('a-mall-parking-water-01', '防汛点位无数据', '水浸传感器超过 120 分钟未上报', '紧急', '13:04')],
      rules: [rule('r-mall-parking-water', '车库水浸无数据提醒', '60 分钟无数据 或 水浸=有水', '通知物业值班')],
      tags: ['防汛', '车库'],
      reasons: ['水浸点位超过业务容忍时间未上报', '电池上次电压低于建议值'],
      actions: ['物业值班到排水沟现场复核', '恢复前保留人工巡查'],
      evidence: ['最后上报：2 小时 12 分钟前', '电池电压：2.74V'],
    }),
    createDevice({
      id: 'iot-mall-loading-camera-01',
      name: '卸货通道网络摄像机 01',
      productKey: 'network-camera',
      area: AREA.mallLoading,
      location: '卸货通道东侧',
      owner: '安保中心',
      identifier: 'VC-MALL-LOAD-01',
      accessMode: 'GB28181 设备注册',
      summary: '摄像机在线，实时码流正常。',
      telemetry: [
        point('liveStream', '实时码流', '正常', undefined, 'normal', '主码流可取'),
        point('onlineState', '在线状态', '在线', undefined, 'normal', '心跳正常'),
      ],
      tags: ['视频接入', '后勤'],
    }),
    createDevice({
      id: 'iot-fuel-island-gas-01',
      name: '1号加油岛可燃气体探测器 01',
      productKey: 'gas-lel-detector',
      area: AREA.fuelIsland,
      location: '1号岛加油机侧',
      owner: '安环值守',
      identifier: 'GAS-FUEL-ISLAND-01',
      accessMode: '4G / MQTT 直连',
      status: 'alarm',
      risk: 'urgent',
      lastSeen: '1 分钟前',
      summary: '加油岛可燃气体进入报警线，需按油气安全流程现场确认。',
      telemetry: [
        point('gas', '可燃气体', '23', '%LEL', 'critical', '超过报警线', '1 分钟前'),
        point('alarmFlag', '报警状态', '报警', undefined, 'critical', '严重告警', '1 分钟前'),
      ],
      alarms: [alarm('a-fuel-island-gas-01', '可燃气体超限', '1号加油岛 %LEL 超过报警线', '紧急', '15:08')],
      rules: [rule('r-fuel-island-gas', '加油岛油气报警', '可燃气体 > 20%LEL', '通知安环值守并暂停临近作业')],
      tags: ['油气安全', '消防'],
      currentFaultCodes: [{ code: 'G01', raisedAt: '15:08' }],
      reasons: ['浓度超过 20%LEL', '加油岛为重点作业区域'],
      actions: ['现场确认泄漏与通风状态', '临时暂停临近加油作业', '确认无泄漏后复位'],
      evidence: ['可燃气体：23%LEL', '区域：1号加油岛'],
    }),
    createDevice({
      id: 'iot-fuel-island-ground-01',
      name: '1号加油岛静电接地监测器 01',
      productKey: 'static-grounding-monitor',
      area: AREA.fuelIsland,
      location: '1号岛卸油接地点',
      owner: '安环值守',
      identifier: 'SG-FUEL-ISLAND-01',
      accessMode: 'RS485 / Modbus 采集',
      summary: '静电接地状态正常。',
      telemetry: [
        point('groundingStatus', '接地状态', '已接地', undefined, 'normal', '接地夹状态正常'),
        point('resistance', '接地电阻', '2.1', 'Ω', 'normal', '低于现场阈值'),
      ],
      tags: ['油气安全', '危化'],
    }),
    createDevice({
      id: 'iot-fuel-unload-ground-01',
      name: '卸油区静电接地监测器 01',
      productKey: 'static-grounding-monitor',
      area: AREA.fuelUnloading,
      location: '卸油口东侧',
      owner: '安环值守',
      identifier: 'SG-FUEL-UNLOAD-01',
      accessMode: 'RS485 / Modbus 采集',
      risk: 'watch',
      summary: '卸油区接地电阻接近观察线，需要复核接地夹状态。',
      telemetry: [
        point('groundingStatus', '接地状态', '夹持异常', undefined, 'warning', '需现场复核'),
        point('resistance', '接地电阻', '9.6', 'Ω', 'warning', '接近现场阈值'),
      ],
      tags: ['油气安全', '危化'],
    }),
    createDevice({
      id: 'iot-fuel-duty-smoke-01',
      name: '值班室无线烟感 01',
      productKey: 'smoke-detector',
      area: AREA.fuelDuty,
      location: '值班室顶棚',
      owner: '安保中心',
      identifier: 'SD-FUEL-DUTY-01',
      accessMode: 'NB-IoT 直连',
      summary: '烟感在线，未发现异常。',
      telemetry: [
        point('smoke', '烟雾状态', '正常', undefined, 'normal', '状态正常'),
        point('battery', '电池电压', '3.20', 'V', 'normal', '电量正常'),
      ],
      tags: ['消防', '油气安全'],
    }),
    createDevice({
      id: 'iot-chem-feeding-toxic-01',
      name: '投料间 VOC / 有毒气体探测器 01',
      productKey: 'voc-toxic-gas-detector',
      area: AREA.chemFeeding,
      location: '投料间北侧操作位',
      owner: '安环值守',
      identifier: 'VOC-CHEM-FEED-01',
      accessMode: 'RS485 / Modbus 采集',
      status: 'alarm',
      risk: 'urgent',
      lastSeen: '2 分钟前',
      summary: '投料间 VOC 浓度超出安全范围，需要按危化流程确认通风和人员安全。',
      telemetry: [
        point('voc', 'VOC', '34', 'ppm', 'critical', '超过模板安全范围'),
        point('oxygen', '氧含量', '20.7', '%VOL', 'normal', '氧含量正常'),
        point('alarmFlag', '报警状态', '报警', undefined, 'critical', '气体报警中'),
      ],
      alarms: [alarm('a-chem-feeding-toxic-01', 'VOC 浓度超限', '投料间 VOC 超过安全范围', '紧急', '11:26')],
      rules: [rule('r-chem-feeding-toxic', '投料间气体报警', 'VOC > 20ppm 或 H2S 越限', '通知安环值守和工艺班组')],
      tags: ['危化', '环境'],
      currentFaultCodes: [{ code: 'T01', raisedAt: '11:26' }],
    }),
    createDevice({
      id: 'iot-chem-kettle-pressure-01',
      name: '反应釜区压力变送器 01',
      productKey: 'pressure-transmitter',
      area: AREA.chemKettle,
      location: 'R-101 进料管线',
      owner: '工艺班组',
      identifier: 'PR-CHEM-KETTLE-01',
      accessMode: 'RS485 / Modbus 采集',
      risk: 'watch',
      summary: '压力值持续高于工艺观察线，建议工艺班组复核阀门状态。',
      telemetry: [
        point('pressure', '压力', '0.92', 'MPa', 'warning', '高于观察线'),
        point('temperature', '介质温度', '48.4', '°C', 'normal', '温度正常'),
        point('alarmFlag', '报警状态', '预警', undefined, 'warning', '压力预警'),
      ],
      rules: [rule('r-chem-pressure', '反应釜压力观察', '压力 > 0.85MPa 持续 10 分钟', '通知工艺班组', '建议调整')],
      tags: ['危化', '工业采集'],
    }),
    createDevice({
      id: 'iot-chem-kettle-vibration-01',
      name: '反应釜区振动传感器 01',
      productKey: 'vibration-sensor',
      area: AREA.chemKettle,
      location: 'R-101 搅拌电机底座',
      owner: '工程维修',
      identifier: 'VB-CHEM-KETTLE-01',
      accessMode: 'MQTT 直连',
      summary: '振动趋势稳定。',
      telemetry: [
        point('vibration', '振动速度', '1.7', 'mm/s', 'normal', '低于观察线'),
        point('acceleration', '加速度', '0.34', 'g', 'normal', '趋势稳定'),
      ],
      tags: ['工业采集'],
    }),
    createDevice({
      id: 'iot-chem-tank-level-01',
      name: '储罐区液位传感器 01',
      productKey: 'level-sensor',
      area: AREA.chemTank,
      location: 'T-201 储罐顶部',
      owner: '工艺班组',
      identifier: 'LV-CHEM-TANK-01',
      accessMode: 'RS485 / Modbus 采集',
      summary: '储罐液位处于安全区间。',
      telemetry: [
        point('level', '液位高度', '5.8', 'm', 'normal', '安全范围'),
        point('percent', '液位百分比', '61', '%', 'normal', '安全范围'),
      ],
      tags: ['危化', '工业采集'],
    }),
    createDevice({
      id: 'iot-chem-loading-io-01',
      name: '装卸栈台 IO 继电器控制器 01',
      productKey: 'io-relay-controller',
      area: AREA.chemLoading,
      location: '装卸栈台联动箱',
      owner: '安环值守',
      identifier: 'IO-CHEM-LOAD-01',
      accessMode: 'RS485 / Modbus 采集',
      status: 'offline',
      risk: 'urgent',
      lastSeen: '3 天前',
      summary: '装卸栈台联动控制器离线，已纳入维护清单。',
      telemetry: [
        point('diStatus', '输入状态', '未知', undefined, 'stale', '设备离线', '3 天前'),
        point('doStatus', '输出状态', '未知', undefined, 'stale', '设备离线', '3 天前'),
      ],
      tags: ['危化', '工业采集', '维护中'],
      reasons: ['连续离线超过 72 小时', '装卸区联动箱近期检修中'],
      actions: ['工程维修现场更换通讯模块', '恢复后执行一次安全输出测试'],
    }),
    createDevice({
      id: 'iot-chem-loading-camera-01',
      name: '装卸栈台网络摄像机 01',
      productKey: 'network-camera',
      area: AREA.chemLoading,
      location: '装卸栈台西侧立杆',
      owner: '安保中心',
      identifier: 'VC-CHEM-LOAD-01',
      accessMode: 'GB28181 设备注册',
      summary: '摄像机在线，云台控制正常。',
      telemetry: [
        point('liveStream', '实时码流', '正常', undefined, 'normal', '主码流可取'),
        point('onlineState', '在线状态', '在线', undefined, 'normal', '心跳正常'),
      ],
      tags: ['视频接入', '危化'],
    }),
    createDevice({
      id: 'iot-chem-control-nvr-01',
      name: '中控大厅 NVR 01',
      productKey: 'nvr-recorder',
      area: AREA.chemControl,
      location: '中控大厅弱电柜',
      owner: '弱电工程',
      identifier: 'NVR-CHEM-CTRL-01',
      accessMode: 'GB28181 平台级联',
      risk: 'watch',
      summary: 'NVR 在线，1 块硬盘进入观察状态。',
      telemetry: [
        point('onlineState', '在线状态', '在线', undefined, 'normal', '心跳正常'),
        point('channelCatalog', '通道目录', '42 路', undefined, 'normal', '目录同步正常'),
        point('storageState', '存储状态', '硬盘观察', undefined, 'warning', '硬盘 SMART 异常'),
      ],
      rules: [rule('r-chem-nvr-storage', 'NVR 存储异常提醒', '硬盘异常 或 通道离线', '通知弱电工程')],
      tags: ['视频接入', '危化'],
    }),
    createDevice({
      id: 'iot-care-east-presence-01',
      name: '东侧住区毫米波存在传感器 01',
      productKey: 'presence-radar-sensor',
      area: AREA.careEastWard,
      location: '3F 东侧 308 房',
      owner: '护理站',
      identifier: 'PRD-CARE-EAST-01',
      accessMode: 'MQTT 直连',
      risk: 'watch',
      summary: '房间内长时间存在但活动状态偏低，需按照照护流程复核。',
      telemetry: [
        point('presence', '存在状态', '有人', undefined, 'normal', '持续存在'),
        point('motion', '活动状态', '静止', undefined, 'warning', '长时间无活动'),
        point('battery', '电池电压', '3.05', 'V', 'normal', '电量正常'),
      ],
      tags: ['康养', '安防'],
      reasons: ['存在状态持续但活动状态长期不变', '住区为夜间重点照护区域'],
      actions: ['护理站先电话确认', '必要时安排护理员到房间查看'],
    }),
    createDevice({
      id: 'iot-care-nurse-sos-01',
      name: '护理站紧急按钮 01',
      productKey: 'emergency-button',
      area: AREA.careNurse,
      location: '护理站台面下方',
      owner: '护理站',
      identifier: 'SOS-CARE-NURSE-01',
      accessMode: 'Zigbee 网关',
      gatewayName: '康养楼 1F Zigbee 网关',
      summary: '紧急按钮在线，最近演练通过。',
      telemetry: [
        point('pressEvent', '按下事件', '无', undefined, 'normal', '未触发'),
        point('resetState', '复位状态', '已复位', undefined, 'normal', '状态正常'),
      ],
      tags: ['康养', '安防'],
    }),
    createDevice({
      id: 'iot-care-activity-air-01',
      name: '活动室空气质量传感器 01',
      productKey: 'co2-air-quality-sensor',
      area: AREA.careActivity,
      location: '活动室南墙',
      owner: '护理站',
      identifier: 'AQ-CARE-ACT-01',
      accessMode: 'MQTT / Wi-Fi 直连',
      summary: '活动室空气质量稳定。',
      telemetry: [
        point('co2', 'CO2', '710', 'ppm', 'normal', '舒适范围'),
        point('pm25', 'PM2.5', '12', 'μg/m³', 'normal', '正常'),
      ],
      tags: ['康养', '环境'],
    }),
    createDevice({
      id: 'iot-care-ward-door-01',
      name: '东侧住区门磁 01',
      productKey: 'door-contact-sensor',
      area: AREA.careEastWard,
      location: '东侧走廊安全门',
      owner: '护理站',
      identifier: 'DC-CARE-EAST-01',
      accessMode: '低功耗网关映射',
      gatewayName: '康养楼 3F Zigbee 网关',
      summary: '门磁在线，夜间开合记录正常。',
      telemetry: [
        point('openState', '开合状态', '关闭', undefined, 'normal', '状态正常'),
        point('battery', '电池电压', '3.02', 'V', 'normal', '电量正常'),
      ],
      tags: ['康养', '安防'],
    }),
    createDevice({
      id: 'iot-care-garden-flow-01',
      name: '康复花园灌溉流量计 01',
      productKey: 'water-flow-meter',
      area: AREA.careGarden,
      location: '康复花园灌溉主管',
      owner: '后勤主管',
      identifier: 'WF-CARE-GARDEN-01',
      accessMode: 'RS485 / Modbus 采集',
      risk: 'watch',
      summary: '花园夜间仍有持续流量，建议确认灌溉阀门和计量倍率。',
      telemetry: [
        point('flow', '瞬时流量', '18.6', 'm³/h', 'warning', '夜间高于常规值'),
        point('totalFlow', '累计流量', '4268', 'm³', 'normal', '累计值连续'),
        point('commStatus', '通讯状态', '弱信号', undefined, 'warning', '采集链路偶发超时'),
      ],
      rules: [rule('r-care-garden-flow', '康复花园夜间用水提醒', '22:00 后瞬时流量 > 10m³/h 持续 20 分钟', '通知后勤主管', '建议调整')],
      tags: ['康养', '环境', '计量'],
      reasons: ['夜间持续流量高于常规灌溉时段', '通讯状态出现弱信号，需要区分真实用水和采集异常'],
      actions: ['后勤主管确认灌溉阀门状态', '核对流量计倍率和采集地址'],
      evidence: ['瞬时流量：18.6m³/h', '通讯状态：弱信号'],
    }),
    createDevice({
      id: 'iot-tech-lab-voc-01',
      name: '联合实验室 VOC 探测器 01',
      productKey: 'voc-toxic-gas-detector',
      area: AREA.techLab,
      location: '样机测试台北侧',
      owner: '安环值守',
      identifier: 'VOC-TECH-LAB-01',
      accessMode: 'RS485 / Modbus 采集',
      risk: 'watch',
      summary: '实验室 TVOC 略高，建议确认测试材料和通风。',
      telemetry: [
        point('voc', 'VOC', '18', 'ppm', 'warning', '接近观察线'),
        point('oxygen', '氧含量', '20.9', '%VOL', 'normal', '氧含量正常'),
      ],
      tags: ['危化', '环境'],
    }),
    createDevice({
      id: 'iot-tech-meeting-air-01',
      name: '会议区空气质量传感器 01',
      productKey: 'co2-air-quality-sensor',
      area: AREA.techMeeting,
      location: '大会议室入口',
      owner: '后勤主管',
      identifier: 'AQ-TECH-MEET-01',
      accessMode: 'MQTT / Wi-Fi 直连',
      summary: '会议区空气质量稳定。',
      telemetry: [
        point('co2', 'CO2', '820', 'ppm', 'normal', '正常'),
        point('pm25', 'PM2.5', '10', 'μg/m³', 'normal', '正常'),
      ],
      tags: ['环境', '办公'],
    }),
    createDevice({
      id: 'iot-tech-server-temp-01',
      name: '主机房温湿度传感器 01',
      productKey: 'temperature-humidity-sensor',
      area: AREA.techServerRoom,
      location: '冷通道 A 列',
      owner: '弱电工程',
      identifier: 'TH-TECH-IDC-01',
      accessMode: 'HaiWell MQTT 直连',
      risk: 'watch',
      summary: '主机房冷通道温度偏高，需要检查局部送风。',
      telemetry: [
        point('temperature', '温度', '28.4', '°C', 'warning', '高于机房建议上限'),
        point('humidity', '湿度', '49', '%', 'normal', '正常'),
      ],
      tags: ['数据中心', '环境'],
    }),
    createDevice({
      id: 'iot-tech-server-water-01',
      name: '主机房地板下水浸 01',
      productKey: 'water-leak-sensor',
      area: AREA.techServerRoom,
      location: '冷通道 A 列地板下',
      owner: '弱电工程',
      identifier: 'WL-TECH-IDC-01',
      accessMode: '低功耗网关映射',
      gatewayName: '数据中心环境网关',
      status: 'alarm',
      risk: 'urgent',
      lastSeen: '1 分钟前',
      summary: '主机房地板下水浸触发，需要立即现场确认。',
      telemetry: [
        point('water', '水浸状态', '有水', undefined, 'critical', '探头触发'),
        point('battery', '电池电压', '3.08', 'V', 'normal', '电量正常'),
      ],
      alarms: [alarm('a-tech-server-water-01', '主机房水浸告警', '冷通道 A 列地板下水浸触发', '紧急', '16:12')],
      tags: ['数据中心', '防汛'],
      currentFaultCodes: [{ code: 'WL01', raisedAt: '16:12' }],
      actions: ['弱电工程立即现场确认', '确认水源并保护附近供电回路'],
    }),
    createDevice({
      id: 'iot-tech-power-meter-01',
      name: '供电间三相智能电表 01',
      productKey: 'smart-energy-meter',
      area: AREA.techPowerRoom,
      location: '供电支撑空间配电柜 P1',
      owner: '工程维修',
      identifier: 'EM-TECH-POWER-01',
      accessMode: 'RS485 / Modbus 采集',
      summary: '三相电参采集正常。',
      telemetry: [
        point('voltage', '电压', '221', 'V', 'normal', '电压稳定'),
        point('current', '电流', '68', 'A', 'normal', '负载正常'),
        point('activePower', '有功功率', '39.5', 'kW', 'normal', '负载正常'),
        point('energy', '累计电能', '28416', 'kWh', 'normal', '采集正常'),
      ],
      tags: ['数据中心', '能耗'],
    }),
    createDevice({
      id: 'iot-tech-power-smoke-01',
      name: '供电间无线烟感 01',
      productKey: 'smoke-detector',
      area: AREA.techPowerRoom,
      location: '供电支撑空间顶棚',
      owner: '安保中心',
      identifier: 'SD-TECH-POWER-01',
      accessMode: 'NB-IoT 直连',
      summary: '烟感在线，未发现异常。',
      telemetry: [
        point('smoke', '烟雾状态', '正常', undefined, 'normal', '状态正常'),
        point('battery', '电池电压', '3.19', 'V', 'normal', '电量正常'),
      ],
      tags: ['数据中心', '消防'],
    }),
    createDevice({
      id: 'iot-tech-north-access-01',
      name: '北门访客区门禁控制器 01',
      productKey: 'access-controller',
      area: AREA.techNorthGate,
      location: '访客闸机控制箱',
      owner: '安保中心',
      identifier: 'AC-TECH-GATE-N-01',
      accessMode: '门禁事件 API 接入',
      risk: 'watch',
      summary: '北门门禁出现门未关事件，需要安保复核门体状态。',
      telemetry: [
        point('accessEvent', '通行事件', '正常通行', undefined, 'normal', '事件同步正常'),
        point('doorState', '门状态', '长开', undefined, 'warning', '超过策略时间'),
        point('lockState', '门锁状态', '解锁', undefined, 'warning', '需复核'),
      ],
      tags: ['通行安防', '安防'],
    }),
    createDevice({
      id: 'iot-tech-north-camera-01',
      name: '北门访客区网络摄像机 01',
      productKey: 'network-camera',
      area: AREA.techNorthGate,
      location: '北门岗亭上方',
      owner: '安保中心',
      identifier: 'VC-TECH-GATE-N-01',
      accessMode: 'ONVIF / RTSP 接入',
      status: 'offline',
      risk: 'watch',
      lastSeen: '38 分钟前',
      summary: '北门摄像机离线，影响访客通行复核。',
      telemetry: [
        point('liveStream', '实时码流', '不可取', undefined, 'stale', '取流失败', '38 分钟前'),
        point('onlineState', '在线状态', '离线', undefined, 'stale', '设备离线', '38 分钟前'),
      ],
      tags: ['视频接入', '通行安防'],
    }),
  ]
}

