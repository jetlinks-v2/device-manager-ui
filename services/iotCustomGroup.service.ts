import { readonly, ref } from 'vue'
import i18n from '@jetlinks-web-core/locales'

import { createIotCustomGroupMockAdapter } from './adapters/iotCustomGroupMockAdapter'
import type {
  IotCustomDeviceGroup,
  IotCustomGroupAdapter,
  IotCustomGroupDraftInput,
  IotCustomGroupPreview,
  IotCustomGroupQuery,
  IotDevice,
  IotDeviceGroup,
} from '../types'

export const IOT_CUSTOM_GROUP_PREFIX = 'custom-'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params || {})
const joinValues = (values: string[]) => values.join(t('IotDeviceList.presentation.separator'))

function includesAny<T extends string>(needles: T[] | undefined, value: T | string | undefined) {
  return !needles?.length || (value ? needles.includes(value as T) : false)
}

function includesText(device: IotDevice, keyword: string | undefined) {
  if (!keyword) return true
  const haystack = [
    device.name,
    device.productName,
    device.deviceType,
    device.area,
    device.location,
    device.owner,
    device.summary,
    device.identifier,
    ...device.tags,
  ].join(' ').toLowerCase()
  return haystack.includes(keyword.toLowerCase())
}

function lastSeenMinutes(value: string): number {
  if (/刚刚|1 分钟/.test(value)) return 1
  const minute = value.match(/(\d+)\s*分钟/)
  const hour = value.match(/(\d+)\s*小时/)
  const day = value.match(/(\d+)\s*天/)
  let total = 0
  if (day) total += Number(day[1]) * 24 * 60
  if (hour) total += Number(hour[1]) * 60
  if (minute) total += Number(minute[1])
  return total || Number.MAX_SAFE_INTEGER
}

function withinLastSeenWindow(device: IotDevice, window: IotCustomGroupQuery['lastSeenWindow']) {
  if (!window) return true
  const minutes = lastSeenMinutes(device.lastSeen)
  const limit = {
    '2h': 120,
    '24h': 24 * 60,
    '7d': 7 * 24 * 60,
  }[window]
  return minutes <= limit
}

export function matchesIotCustomGroup(device: IotDevice, query: IotCustomGroupQuery) {
  if (!includesAny(query.areaIds, device.areaId)) return false
  if (!includesAny(query.deviceTypes, device.deviceType)) return false
  if (!includesAny(query.productNames, device.productName)) return false
  if (!includesAny(query.owners, device.owner)) return false
  if (!includesAny(query.statuses, device.status)) return false
  if (!includesAny(query.risks, device.risk)) return false
  if (query.tags?.length && !query.tags.some((tag) => device.tags.includes(tag))) return false
  if (!includesText(device, query.keyword)) return false
  if (!withinLastSeenWindow(device, query.lastSeenWindow)) return false
  return true
}

function groupSummary(devices: IotDevice[]): IotDeviceGroup['summary'] {
  return {
    total: devices.length,
    urgent: devices.filter((device) => device.risk === 'urgent').length,
    watch: devices.filter((device) => device.risk === 'watch').length,
    normal: devices.filter((device) => device.risk === 'normal').length,
    offline: devices.filter((device) => device.status === 'offline').length,
    noData: devices.filter((device) => device.status === 'no-data').length,
    alarm: devices.filter((device) => device.status === 'alarm').length,
  }
}

function describeCustomQuery(query: IotCustomGroupQuery) {
  const parts = [
    query.areaIds?.length ? t('IotCustomGroup.summary.areaCount', { count: query.areaIds.length }) : '',
    query.deviceTypes?.length ? t('IotCustomGroup.summary.deviceTypes', { value: joinValues(query.deviceTypes) }) : '',
    query.productNames?.length ? t('IotCustomGroup.summary.products', { value: joinValues(query.productNames) }) : '',
    query.owners?.length ? t('IotCustomGroup.summary.owners', { value: joinValues(query.owners) }) : '',
    query.statuses?.length ? t('IotCustomGroup.summary.statusCount', { count: query.statuses.length }) : '',
    query.risks?.length ? t('IotCustomGroup.summary.riskCount', { count: query.risks.length }) : '',
    query.tags?.length ? t('IotCustomGroup.summary.tags', { value: joinValues(query.tags) }) : '',
    query.keyword ? t('IotCustomGroup.summary.keyword', { value: query.keyword }) : '',
    query.lastSeenWindow ? t('IotCustomGroup.summary.lastSeen', { value: query.lastSeenWindow }) : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('IotCustomGroup.summary.allVisible')
}

export function previewIotCustomGroup(devices: IotDevice[], query: IotCustomGroupQuery): IotCustomGroupPreview {
  const matched = devices.filter((device) => matchesIotCustomGroup(device, query))
  return {
    matchedDeviceIds: matched.map((device) => device.id),
    summary: groupSummary(matched),
  }
}

export function projectIotCustomGroup(group: IotCustomDeviceGroup, devices: IotDevice[]): IotDeviceGroup {
  const matched = devices.filter((device) => matchesIotCustomGroup(device, group.query))
  return {
    id: group.id,
    projectId: group.projectId,
    name: group.name,
    basis: 'scene',
    description: group.description || t('IotCustomGroup.sceneDescription', { summary: describeCustomQuery(group.query) }),
    condition: group.condition || describeCustomQuery(group.query),
    owner: group.owner,
    objective: group.objective,
    alarmContacts: [...group.alarmContacts],
    deviceIds: matched.map((device) => device.id),
    tags: [
      t('IotCustomGroup.tag.userCreated'),
      group.visibility === 'project' ? t('IotCustomGroup.tag.projectVisible') : t('IotCustomGroup.tag.private'),
    ],
    healthScore: Math.max(28, Math.min(98, 100 - matched.filter((device) => device.risk !== 'normal').length * 12 - matched.filter((device) => device.status !== 'online').length * 8)),
    riskLevel: matched.some((device) => device.risk === 'urgent') ? 'high' : matched.some((device) => device.risk === 'watch' || device.status !== 'online') ? 'medium' : 'low',
    automationRules: [...group.automationRules],
    summary: groupSummary(matched),
    actions: group.actions,
  }
}

export function createIotCustomGroupService(adapter: IotCustomGroupAdapter) {
  const groups = ref<IotCustomDeviceGroup[]>([])

  async function list(projectId: string) {
    const result = await adapter.list(projectId)
    if (result.ok) groups.value = result.data
    return result
  }

  async function create(input: IotCustomGroupDraftInput) {
    const result = await adapter.create(input)
    if (result.ok) groups.value = [result.data, ...groups.value.filter((group) => group.id !== result.data.id)]
    return result
  }

  async function deleteGroup(projectId: string, groupId: string) {
    const result = await adapter.delete(projectId, groupId)
    if (result.ok) groups.value = groups.value.filter((group) => group.id !== groupId)
    return result
  }

  function subscribeGroups() {
    return readonly(groups)
  }

  return {
    list,
    create,
    deleteGroup,
    subscribeGroups,
  }
}

export const iotCustomGroupService = createIotCustomGroupService(createIotCustomGroupMockAdapter())
