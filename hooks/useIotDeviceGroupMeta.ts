import i18n from '@jetlinks-web-core/locales'

export type IotDeviceGroupView = 'area' | 'type'

export interface IotDeviceGroupViewMeta {
  label: string
  icon: string
}

export const IOT_DEVICE_GROUP_VIEW_META: Record<IotDeviceGroupView, IotDeviceGroupViewMeta> = {
  area: { get label() { return i18n.global.t('IotDeviceGroups.view.area') }, icon: 'EnvironmentOutlined' },
  type: { get label() { return i18n.global.t('IotDeviceGroups.view.type') }, icon: 'ClusterOutlined' },
}

export const IOT_DEVICE_GROUP_VIEW_OPTIONS = [
  { key: 'area', get label() { return IOT_DEVICE_GROUP_VIEW_META.area.label }, icon: IOT_DEVICE_GROUP_VIEW_META.area.icon },
  { key: 'type', get label() { return IOT_DEVICE_GROUP_VIEW_META.type.label }, icon: IOT_DEVICE_GROUP_VIEW_META.type.icon },
] as const satisfies ReadonlyArray<{ key: IotDeviceGroupView; label: string; icon: string }>

const FALLBACK_GROUP_VIEW_META: IotDeviceGroupViewMeta = {
  get label() { return i18n.global.t('IotDeviceGroups.confirm.unbindDevice.target.group') },
  icon: 'ApartmentOutlined',
}

export function getIotDeviceGroupViewMeta(value: IotDeviceGroupView | string | undefined): IotDeviceGroupViewMeta {
  if (!value) return FALLBACK_GROUP_VIEW_META
  return IOT_DEVICE_GROUP_VIEW_META[value as IotDeviceGroupView] ?? FALLBACK_GROUP_VIEW_META
}
