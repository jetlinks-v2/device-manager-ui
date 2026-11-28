import { request } from '@jetlinks-web/core'

export type DeviceHeaderPatch = { name: string; i18nMessages: Record<string, Record<string, string>> } | { describe: string; i18nMessages: Record<string, Record<string, string>> } | { photoUrl: string }

/** 单字段更新不重建 configuration、extensions 或其他基础资料。 */
export const updateDeviceHeader_api = (deviceId: string, patch: DeviceHeaderPatch) =>
  request.put(`/device-instance/${encodeURIComponent(deviceId)}`, patch)
