import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export interface IotDeviceScenarioOption {
  key: string
  label: string
}

export const IOT_DEVICE_SCENARIO_OPTIONS = [
  { key: '防汛', get label() { return t('IotDeviceScenario.floodControl') } },
  { key: '消防', get label() { return t('IotDeviceScenario.fireSafety') } },
  { key: '能耗', get label() { return t('IotDeviceScenario.energy') } },
  { key: '计量', get label() { return t('IotDeviceScenario.metering') } },
  { key: '安防', get label() { return t('IotDeviceScenario.security') } },
  { key: '环境', get label() { return t('IotDeviceScenario.environment') } },
  { key: '油气安全', get label() { return t('IotDeviceScenario.fuelSafety') } },
  { key: '危化', get label() { return t('IotDeviceScenario.chemicalSafety') } },
  { key: '工业采集', get label() { return t('IotDeviceScenario.industrial') } },
  { key: '康养', get label() { return t('IotDeviceScenario.care') } },
  { key: '数据中心', get label() { return t('IotDeviceScenario.dataCenter') } },
  { key: '视频接入', get label() { return t('IotDeviceScenario.video') } },
  { key: '通行安防', get label() { return t('IotDeviceScenario.accessControl') } },
] as const satisfies ReadonlyArray<IotDeviceScenarioOption>
