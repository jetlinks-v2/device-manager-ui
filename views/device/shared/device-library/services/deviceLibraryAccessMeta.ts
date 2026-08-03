import type { DeviceAccessMode } from '@device-manager-ui/views/device/shared/device-library/services/types'
import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export const DEVICE_ACCESS_META: Record<DeviceAccessMode, { label: string; short: string; business: string; tech: string }> = {
  direct: { get label() { return t('IotDeviceAccessMeta.direct.label') }, get short() { return t('IotDeviceAccessMeta.direct.short') }, get business() { return t('IotDeviceAccessMeta.direct.business') }, tech: 'MQTT / TCP / HTTP' },
  edge: { get label() { return t('IotDeviceAccessMeta.edge.label') }, get short() { return t('IotDeviceAccessMeta.edge.short') }, get business() { return t('IotDeviceAccessMeta.edge.business') }, tech: 'Edge Gateway' },
  gb28181: { get label() { return t('IotDeviceAccessMeta.gb28181.label') }, get short() { return t('IotDeviceAccessMeta.gb28181.short') }, get business() { return t('IotDeviceAccessMeta.gb28181.business') }, tech: 'GB/T 28181' },
  collector: { get label() { return t('IotDeviceAccessMeta.collector.label') }, get short() { return t('IotDeviceAccessMeta.collector.short') }, get business() { return t('IotDeviceAccessMeta.collector.business') }, tech: 'Modbus / OPC UA / S7' },
  'third-party': { get label() { return t('IotDeviceAccessMeta.thirdParty.label') }, get short() { return t('IotDeviceAccessMeta.thirdParty.short') }, get business() { return t('IotDeviceAccessMeta.thirdParty.business') }, tech: 'ISAPI / API callback' },
}
