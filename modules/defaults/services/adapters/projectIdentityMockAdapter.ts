import { err, ok } from '@device-manager-ui/services/shared/serviceResult'
import type {
  ProjectIdentityAdapter,
  ProjectIdentitySettings,
  ProjectMember,
  ProjectMemberAccessUpdateInput,
} from '../../types'

interface ContentSeed<T> {
  items?: T[]
}

const ACTIVE_MEMBER_KEY = 'jl-project-identity:active-member:v1'
const MEMBER_ACCESS_OVERRIDE_KEY = 'jl-project-identity:member-access-overrides:v1'

type MemberAccessOverrides = Record<string, Partial<ProjectMemberAccessUpdateInput>>

async function loadProjectMemberSeed(): Promise<ProjectMember[]> {
  const root = await queryCollection('projectMembers').first() as ContentSeed<ProjectMember> | null
  return root?.items ?? []
}

function activeMemberStorageKey(projectId: string): string {
  return `${ACTIVE_MEMBER_KEY}:${projectId}`
}

function memberAccessOverrideStorageKey(projectId: string): string {
  return `${MEMBER_ACCESS_OVERRIDE_KEY}:${projectId}`
}

function readActiveMemberId(projectId: string): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(activeMemberStorageKey(projectId))
}

function writeActiveMemberId(projectId: string, memberId: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(activeMemberStorageKey(projectId), memberId)
}

function clearActiveMemberId(projectId: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(activeMemberStorageKey(projectId))
}

function readMemberAccessOverrides(projectId: string): MemberAccessOverrides {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(memberAccessOverrideStorageKey(projectId))
    return raw ? JSON.parse(raw) as MemberAccessOverrides : {}
  } catch {
    return {}
  }
}

function writeMemberAccessOverrides(projectId: string, overrides: MemberAccessOverrides) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(memberAccessOverrideStorageKey(projectId), JSON.stringify(overrides))
}

function clearMemberAccessOverrides(projectId: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(memberAccessOverrideStorageKey(projectId))
}

function cloneMember(member: ProjectMember): ProjectMember {
  return {
    ...member,
    areaAccess: {
      ...member.areaAccess,
      areaIds: [...member.areaAccess.areaIds],
    },
    dataAccess: {
      ...member.dataAccess,
      areaIds: [...member.dataAccess.areaIds],
    },
    assignments: member.assignments.map((item) => ({ ...item })),
  }
}

function applyAccessOverrides(projectId: string, members: ProjectMember[]): ProjectMember[] {
  const overrides = readMemberAccessOverrides(projectId)
  return members.map((sourceMember) => {
    const member = cloneMember(sourceMember)
    const override = overrides[member.id]
    if (!override) return member

    return {
      ...member,
      areaAccess: override.areaAccess
        ? {
          ...override.areaAccess,
          areaIds: [...override.areaAccess.areaIds],
        }
        : member.areaAccess,
      dataAccess: override.dataAccess
        ? {
          ...override.dataAccess,
          areaIds: [...override.dataAccess.areaIds],
        }
        : member.dataAccess,
    }
  })
}

function buildSettings(projectId: string, members: ProjectMember[]): ProjectIdentitySettings {
  const scopedMembers = applyAccessOverrides(projectId, members)
  const storedActiveId = readActiveMemberId(projectId)
  const activeMemberId = scopedMembers.some((member) => member.id === storedActiveId)
    ? storedActiveId!
    : scopedMembers[0]?.id ?? ''

  return {
    projectId,
    activeMemberId,
    members: scopedMembers,
  }
}

export function createProjectIdentityMockAdapter(): ProjectIdentityAdapter {
  return {
    async getSettings(projectId) {
      const members = (await loadProjectMemberSeed()).filter((member) => member.projectId === projectId)
      if (!members.length) return err('NOT_FOUND', '未找到项目成员配置')
      return ok(buildSettings(projectId, members))
    },

    async setActiveMember(projectId, memberId) {
      const members = (await loadProjectMemberSeed()).filter((member) => member.projectId === projectId)
      if (!members.length) return err('NOT_FOUND', '未找到项目成员配置')
      if (!members.some((member) => member.id === memberId)) {
        return err('NOT_FOUND', `成员 ${memberId} 不存在`)
      }
      writeActiveMemberId(projectId, memberId)
      return ok(buildSettings(projectId, members))
    },

    async updateMemberAccess(projectId, memberId, input) {
      const members = (await loadProjectMemberSeed()).filter((member) => member.projectId === projectId)
      if (!members.length) return err('NOT_FOUND', '未找到项目成员配置')
      if (!members.some((member) => member.id === memberId)) {
        return err('NOT_FOUND', `成员 ${memberId} 不存在`)
      }

      const overrides = readMemberAccessOverrides(projectId)
      overrides[memberId] = {
        areaAccess: {
          ...input.areaAccess,
          areaIds: [...input.areaAccess.areaIds],
        },
        dataAccess: {
          ...input.dataAccess,
          areaIds: [...input.dataAccess.areaIds],
        },
      }
      writeMemberAccessOverrides(projectId, overrides)
      return ok(buildSettings(projectId, members))
    },

    async resetProjectData(projectId) {
      const members = (await loadProjectMemberSeed()).filter((member) => member.projectId === projectId)
      if (!members.length) return err('NOT_FOUND', '未找到项目成员配置')
      clearActiveMemberId(projectId)
      clearMemberAccessOverrides(projectId)
      return ok(buildSettings(projectId, members))
    },
  }
}

