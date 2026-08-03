import { readonly, ref } from 'vue'

import { createProjectIdentityMockAdapter } from './adapters/projectIdentityMockAdapter'
import type {
  ProjectIdentityAdapter,
  ProjectIdentitySettings,
  ProjectMemberAccessUpdateInput,
} from '../types'

/**
 * Contract:
 * getSettings(projectId)
 * setActiveMember(projectId, memberId)
 * updateMemberAccess(projectId, memberId, input)
 * resetProjectData(projectId)
 *
 * 项目用户与组织的业务真值源。当前原型 adapter 从 content seed 读取成员，
 * 并把"当前演示用户"持久化在本地运行层，供后续页面按用户视角读取。
 */
export function createProjectIdentityService(adapter: ProjectIdentityAdapter) {
  const currentSettings = ref<ProjectIdentitySettings | null>(null)

  async function getSettings(projectId: string) {
    const result = await adapter.getSettings(projectId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function setActiveMember(projectId: string, memberId: string) {
    const result = await adapter.setActiveMember(projectId, memberId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updateMemberAccess(
    projectId: string,
    memberId: string,
    input: ProjectMemberAccessUpdateInput,
  ) {
    const result = await adapter.updateMemberAccess(projectId, memberId, input)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function resetProjectData(projectId: string) {
    const result = await adapter.resetProjectData(projectId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  function subscribeSettings() {
    return readonly(currentSettings)
  }

  return {
    getSettings,
    setActiveMember,
    updateMemberAccess,
    resetProjectData,
    subscribeSettings,
  }
}

export const projectIdentityService = createProjectIdentityService(createProjectIdentityMockAdapter())

