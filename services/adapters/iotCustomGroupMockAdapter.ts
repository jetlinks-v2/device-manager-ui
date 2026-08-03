import { err, ok } from '@device-manager-ui/services/shared/serviceResult'

import type {
  IotCustomDeviceGroup,
  IotCustomGroupAdapter,
  IotCustomGroupDraftInput,
} from '../../types'

const GROUPS_BY_PROJECT = new Map<string, IotCustomDeviceGroup[]>()
const STORAGE_KEY = 'jl:iot-custom-groups:v1'

function readStorage(): Record<string, IotCustomDeviceGroup[]> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, IotCustomDeviceGroup[]> : {}
  } catch {
    return {}
  }
}

function writeStorage(snapshot: Record<string, IotCustomDeviceGroup[]>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function getProjectGroups(projectId: string) {
  const cached = GROUPS_BY_PROJECT.get(projectId)
  if (cached) return cached
  const stored = readStorage()[projectId] ?? []
  GROUPS_BY_PROJECT.set(projectId, stored)
  return stored
}

function setProjectGroups(projectId: string, groups: IotCustomDeviceGroup[]) {
  GROUPS_BY_PROJECT.set(projectId, groups)
  const snapshot = readStorage()
  snapshot[projectId] = groups
  writeStorage(snapshot)
}

function cloneGroup(group: IotCustomDeviceGroup): IotCustomDeviceGroup {
  return {
    objective: '',
    description: '',
    condition: '',
    ...group,
    query: {
      ...group.query,
      areaIds: group.query.areaIds ? [...group.query.areaIds] : undefined,
      deviceTypes: group.query.deviceTypes ? [...group.query.deviceTypes] : undefined,
      productNames: group.query.productNames ? [...group.query.productNames] : undefined,
      owners: group.query.owners ? [...group.query.owners] : undefined,
      statuses: group.query.statuses ? [...group.query.statuses] : undefined,
      risks: group.query.risks ? [...group.query.risks] : undefined,
      tags: group.query.tags ? [...group.query.tags] : undefined,
    },
    actions: [...group.actions],
  }
}

function slugifyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .slice(0, 32)
}

export function createIotCustomGroupMockAdapter(): IotCustomGroupAdapter {
  return {
    async list(projectId) {
      return ok(getProjectGroups(projectId).map(cloneGroup))
    },

    async create(input: IotCustomGroupDraftInput) {
      const name = input.name.trim()
      if (!name) return err('VALIDATION_FAILED', '请输入分组名称')
      const objective = input.objective.trim()
      if (!objective) return err('VALIDATION_FAILED', '请输入业务目标')
      const condition = input.condition.trim()
      if (!condition) return err('VALIDATION_FAILED', '请输入设备范围')
      const description = input.description.trim()
      if (!description) return err('VALIDATION_FAILED', '请输入分组说明')

      const current = getProjectGroups(input.projectId)
      if (current.some((group) => group.name === name)) {
        return err('CONFLICT', '已存在同名场景分组')
      }

      const now = new Date().toISOString()
      const id = `custom-${Date.now()}-${slugifyName(name) || 'group'}`
      const group: IotCustomDeviceGroup = {
        id,
        projectId: input.projectId,
        name,
        objective,
        description,
        condition,
        purpose: input.purpose,
        owner: input.owner.trim() || '值班负责人',
        alarmContacts: input.alarmContacts.map((contact) => contact.trim()).filter(Boolean),
        query: {
          ...input.query,
          areaIds: input.query.areaIds?.filter(Boolean),
          deviceTypes: input.query.deviceTypes?.filter(Boolean),
          productNames: input.query.productNames?.filter(Boolean),
          owners: input.query.owners?.filter(Boolean),
          statuses: input.query.statuses?.filter(Boolean),
          risks: input.query.risks?.filter(Boolean),
          tags: input.query.tags?.filter(Boolean),
          keyword: input.query.keyword?.trim() || undefined,
        },
        actions: input.actions.map((action) => action.trim()).filter(Boolean),
        automationRules: input.automationRules.map((rule) => rule.trim()).filter(Boolean),
        visibility: input.visibility,
        createdBy: '当前用户',
        createdAt: now,
        updatedAt: now,
      }

      setProjectGroups(input.projectId, [group, ...current])
      return ok(cloneGroup(group))
    },

    async delete(projectId, groupId) {
      const current = getProjectGroups(projectId)
      const next = current.filter((group) => group.id !== groupId)
      if (next.length === current.length) return err('NOT_FOUND', '未找到该场景分组')
      setProjectGroups(projectId, next)
      return ok({ id: groupId })
    },
  }
}

