import type { ProjectAreaType } from '@device-manager-ui/modules/defaults/types'
import i18n from '@jetlinks-web-core/locales'

const t = (key: string) => i18n.global.t(key)

export interface ProjectAreaTypeMeta {
  label: string
  icon: string
}

export const PROJECT_AREA_TYPE_META: Record<ProjectAreaType, ProjectAreaTypeMeta> = {
  site: {
    get label() { return t('IotProjectArea.site') },
    icon: 'DeploymentUnitOutlined',
  },
  building: {
    get label() { return t('IotProjectArea.building') },
    icon: 'BankOutlined',
  },
  floor: {
    get label() { return t('IotProjectArea.floor') },
    icon: 'ApartmentOutlined',
  },
  zone: {
    get label() { return t('IotProjectArea.zone') },
    icon: 'BorderOutlined',
  },
  room: {
    get label() { return t('IotProjectArea.room') },
    icon: 'LoginOutlined',
  },
  point: {
    get label() { return t('IotProjectArea.point') },
    icon: 'EnvironmentOutlined',
  },
}

export const PROJECT_AREA_TYPE_OPTIONS = [
  { key: 'site', label: PROJECT_AREA_TYPE_META.site.label },
  { key: 'building', label: PROJECT_AREA_TYPE_META.building.label },
  { key: 'floor', label: PROJECT_AREA_TYPE_META.floor.label },
  { key: 'zone', label: PROJECT_AREA_TYPE_META.zone.label },
  { key: 'room', label: PROJECT_AREA_TYPE_META.room.label },
  { key: 'point', label: PROJECT_AREA_TYPE_META.point.label },
] as const satisfies ReadonlyArray<{ key: ProjectAreaType; label: string }>

const FALLBACK_PROJECT_AREA_TYPE_META: ProjectAreaTypeMeta = {
  get label() { return t('IotProjectArea.zone') },
  icon: 'BorderOutlined',
}

export function getProjectAreaTypeMeta(value: ProjectAreaType | string | undefined): ProjectAreaTypeMeta {
  if (!value) return FALLBACK_PROJECT_AREA_TYPE_META
  return PROJECT_AREA_TYPE_META[value as ProjectAreaType] ?? FALLBACK_PROJECT_AREA_TYPE_META
}

export function getProjectAreaTypeLabel(value: ProjectAreaType | string | undefined): string {
  return getProjectAreaTypeMeta(value).label
}
