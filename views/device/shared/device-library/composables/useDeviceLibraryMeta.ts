import type {
  DeviceAccessMode,
  DeviceCategory,
  DeviceDataKind,
  DeviceIndustry,
  DeviceMaintainSource,
  DeviceScenario,
} from '@device-manager-ui/views/device/shared/device-library/services/types'
import { DEVICE_ACCESS_META } from '@device-manager-ui/views/device/shared/device-library/services/deviceLibraryAccessMeta'
import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export { DEVICE_ACCESS_META } from '@device-manager-ui/views/device/shared/device-library/services/deviceLibraryAccessMeta'

export const DEVICE_CATEGORY_META: Record<DeviceCategory, { label: string; icon: string }> = {
  video: { get label() { return t('IotDeviceLibrary.category.video') }, icon: 'VideoCameraOutlined' },
  meter: { get label() { return t('IotDeviceLibrary.category.meter') }, icon: 'DashboardOutlined' },
  sensor: { get label() { return t('IotDeviceLibrary.category.sensor') }, icon: 'DashboardOutlined' },
  industrial: { get label() { return t('IotDeviceLibrary.category.industrial') }, icon: 'HddOutlined' },
  integration: { get label() { return t('IotDeviceLibrary.category.integration') }, icon: 'DisconnectOutlined' },
}

export const DEVICE_CATEGORY_OPTIONS = [
  { key: 'all', get label() { return t('IotDeviceLibrary.category.all') } },
  { key: 'video', get label() { return DEVICE_CATEGORY_META.video.label } },
  { key: 'meter', get label() { return DEVICE_CATEGORY_META.meter.label } },
  { key: 'sensor', get label() { return DEVICE_CATEGORY_META.sensor.label } },
  { key: 'industrial', get label() { return DEVICE_CATEGORY_META.industrial.label } },
  { key: 'integration', get label() { return DEVICE_CATEGORY_META.integration.label } },
] as const

export const DEVICE_SCENARIO_META: Record<DeviceScenario, { label: string; icon: string }> = {
  'video-inspection': { get label() { return t('IotDeviceLibrary.scenario.videoInspection') }, icon: 'ScanOutlined' },
  'energy-metering': { get label() { return t('IotDeviceLibrary.scenario.energyMetering') }, icon: 'DashboardOutlined' },
  environment: { get label() { return t('IotDeviceLibrary.scenario.environment') }, icon: 'LineChartOutlined' },
  'industrial-collect': { get label() { return t('IotDeviceLibrary.scenario.industrialCollect') }, icon: 'HddOutlined' },
  'system-sync': { get label() { return t('IotDeviceLibrary.scenario.systemSync') }, icon: 'BranchesOutlined' },
  'commercial-ops': { get label() { return t('IotDeviceLibrary.scenario.commercialOps') }, icon: 'ShoppingOutlined' },
  'fire-safety': { get label() { return t('IotDeviceLibrary.scenario.fireSafety') }, icon: 'FireOutlined' },
  'fuel-safety': { get label() { return t('IotDeviceLibrary.scenario.fuelSafety') }, icon: 'FireOutlined' },
  'chemical-safety': { get label() { return t('IotDeviceLibrary.scenario.chemicalSafety') }, icon: 'ExperimentOutlined' },
  'care-assist': { get label() { return t('IotDeviceLibrary.scenario.careAssist') }, icon: 'HeartOutlined' },
  'access-control': { get label() { return t('IotDeviceLibrary.scenario.accessControl') }, icon: 'LoginOutlined' },
  'data-center': { get label() { return t('IotDeviceLibrary.scenario.dataCenter') }, icon: 'CloudServerOutlined' },
}

export const DEVICE_SCENARIO_OPTIONS = [
  { key: 'all', get label() { return t('IotDeviceLibrary.scenario.all') } },
  { key: 'video-inspection', get label() { return DEVICE_SCENARIO_META['video-inspection'].label } },
  { key: 'energy-metering', get label() { return DEVICE_SCENARIO_META['energy-metering'].label } },
  { key: 'environment', get label() { return DEVICE_SCENARIO_META.environment.label } },
  { key: 'industrial-collect', get label() { return DEVICE_SCENARIO_META['industrial-collect'].label } },
  { key: 'system-sync', get label() { return DEVICE_SCENARIO_META['system-sync'].label } },
  { key: 'commercial-ops', get label() { return DEVICE_SCENARIO_META['commercial-ops'].label } },
  { key: 'fire-safety', get label() { return DEVICE_SCENARIO_META['fire-safety'].label } },
  { key: 'fuel-safety', get label() { return DEVICE_SCENARIO_META['fuel-safety'].label } },
  { key: 'chemical-safety', get label() { return DEVICE_SCENARIO_META['chemical-safety'].label } },
  { key: 'care-assist', get label() { return DEVICE_SCENARIO_META['care-assist'].label } },
  { key: 'access-control', get label() { return DEVICE_SCENARIO_META['access-control'].label } },
  { key: 'data-center', get label() { return DEVICE_SCENARIO_META['data-center'].label } },
] as const

export const DEVICE_INDUSTRY_META: Record<DeviceIndustry, string> = {
  get park() { return t('IotDeviceLibrary.industry.park') },
  get energy() { return t('IotDeviceLibrary.industry.energy') },
  get security() { return t('IotDeviceLibrary.industry.security') },
  get building() { return t('IotDeviceLibrary.industry.building') },
  get manufacturing() { return t('IotDeviceLibrary.industry.manufacturing') },
  get water() { return t('IotDeviceLibrary.industry.water') },
  get commercial() { return t('IotDeviceLibrary.industry.commercial') },
  get chemical() { return t('IotDeviceLibrary.industry.chemical') },
  get care() { return t('IotDeviceLibrary.industry.care') },
  get 'data-center'() { return t('IotDeviceLibrary.industry.dataCenter') },
}

export const DEVICE_INDUSTRY_OPTIONS = [
  { key: 'all', get label() { return t('IotDeviceLibrary.industry.all') } },
  { key: 'park', get label() { return DEVICE_INDUSTRY_META.park } },
  { key: 'energy', get label() { return DEVICE_INDUSTRY_META.energy } },
  { key: 'security', get label() { return DEVICE_INDUSTRY_META.security } },
  { key: 'building', get label() { return DEVICE_INDUSTRY_META.building } },
  { key: 'manufacturing', get label() { return DEVICE_INDUSTRY_META.manufacturing } },
  { key: 'water', get label() { return DEVICE_INDUSTRY_META.water } },
  { key: 'commercial', get label() { return DEVICE_INDUSTRY_META.commercial } },
  { key: 'chemical', get label() { return DEVICE_INDUSTRY_META.chemical } },
  { key: 'care', get label() { return DEVICE_INDUSTRY_META.care } },
  { key: 'data-center', get label() { return DEVICE_INDUSTRY_META['data-center'] } },
] as const

export const DEVICE_BRAND_OPTIONS = [
  { key: 'all', get label() { return t('IotDeviceLibrary.brand.all') } },
  { key: '海康威视', get label() { return t('IotDeviceLibrary.brand.hikvision') } },
  { key: '大华', get label() { return t('IotDeviceLibrary.brand.dahua') } },
  { key: '宇视', get label() { return t('IotDeviceLibrary.brand.uniview') } },
  { key: '通用 ONVIF 摄像机', label: 'ONVIF' },
  { key: '通用 GB28181 设备', label: 'GB28181' },
  { key: '施耐德', get label() { return t('IotDeviceLibrary.brand.schneider') } },
  { key: '西门子', get label() { return t('IotDeviceLibrary.brand.siemens') } },
  { key: '铭控', get label() { return t('IotDeviceLibrary.brand.meokon') } },
  { key: '海为 HaiWell', get label() { return t('IotDeviceLibrary.brand.haiwell') } },
  { key: '通用 MQTT 传感器', get label() { return t('IotDeviceLibrary.brand.genericMqttSensor') } },
  { key: '通用 Zigbee 传感器', get label() { return t('IotDeviceLibrary.brand.genericZigbeeSensor') } },
  { key: '通用 Modbus 仪表', get label() { return t('IotDeviceLibrary.brand.genericModbusMeter') } },
  { key: '通用气体探测器', get label() { return t('IotDeviceLibrary.brand.genericGasDetector') } },
  { key: '汉威科技', get label() { return t('IotDeviceLibrary.brand.hanwei') } },
  { key: '霍尼韦尔', get label() { return t('IotDeviceLibrary.brand.honeywell') } },
  { key: '安科瑞', get label() { return t('IotDeviceLibrary.brand.acrel') } },
  { key: '海康威视门禁', get label() { return t('IotDeviceLibrary.brand.hikvisionAccess') } },
  { key: '大华门禁', get label() { return t('IotDeviceLibrary.brand.dahuaAccess') } },
  { key: '通用门禁控制器', get label() { return t('IotDeviceLibrary.brand.genericAccess') } },
] as const

export const DEVICE_ACCESS_OPTIONS = [
  { key: 'all', get label() { return t('IotDeviceLibrary.access.all') } },
  { key: 'direct', get label() { return DEVICE_ACCESS_META.direct.business } },
  { key: 'edge', get label() { return DEVICE_ACCESS_META.edge.business } },
  { key: 'gb28181', get label() { return DEVICE_ACCESS_META.gb28181.business } },
  { key: 'collector', get label() { return DEVICE_ACCESS_META.collector.business } },
  { key: 'third-party', get label() { return DEVICE_ACCESS_META['third-party'].business } },
] as const

export const DEVICE_DATA_META: Record<DeviceDataKind, { label: string; icon: string }> = {
  status: { get label() { return t('IotDeviceLibrary.data.status') }, icon: 'LineChartOutlined' },
  telemetry: { get label() { return t('IotDeviceLibrary.data.telemetry') }, icon: 'LineChartOutlined' },
  event: { get label() { return t('IotDeviceLibrary.data.event') }, icon: 'RadarChartOutlined' },
  command: { get label() { return t('IotDeviceLibrary.data.command') }, icon: 'CodeOutlined' },
  video: { get label() { return t('IotDeviceLibrary.data.video') }, icon: 'VideoCameraOutlined' },
  alarm: { get label() { return t('IotDeviceLibrary.data.alarm') }, icon: 'BellOutlined' },
}

export const DEVICE_SOURCE_META: Record<DeviceMaintainSource, string> = {
  get official() { return t('IotDeviceLibrary.source.official') },
  get partner() { return t('IotDeviceLibrary.source.partner') },
  get community() { return t('IotDeviceLibrary.source.community') },
}

export const DEVICE_PROJECT_OPTIONS = [
  { key: 'doraemon', get label() { return t('IotDeviceLibrary.project.doraemon') } },
  { key: 'dream-city', get label() { return t('IotDeviceLibrary.project.dreamCity') } },
  { key: 'fuel-station', get label() { return t('IotDeviceLibrary.project.fuelStation') } },
] as const

export function getDeviceCategoryMeta(category: DeviceCategory | string) {
  return DEVICE_CATEGORY_META[category as DeviceCategory] ?? DEVICE_CATEGORY_META.integration
}

export function getDeviceAccessLabel(mode: DeviceAccessMode) {
  return DEVICE_ACCESS_META[mode].short
}
