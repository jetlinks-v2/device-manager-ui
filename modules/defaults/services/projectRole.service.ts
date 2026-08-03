import { readonly, ref } from 'vue'

import { createProjectRoleMockAdapter } from './adapters/projectRoleMockAdapter'
import type {
  ProjectPermissionState,
  ProjectRoleAdapter,
  ProjectRoleMenuDataScope,
  ProjectRoleSettings,
} from '../types'

/**
 * Contract:
 * getSettings(projectId)
 * resetProjectData(projectId)
 * updatePermission(projectId, roleId, permissionKey, state)
 * updateMenuPermission(projectId, roleId, menuKey, state)
 * updateMenuActionPermission(projectId, roleId, menuKey, actionKey, state)
 * updateMenuDataScope(projectId, roleId, menuKey, mode)
 *
 * 项目角色权限的业务真值源。页面只关心角色、成员引用、菜单和权限矩阵，
 * 原型运行层负责从 content seed 读取默认角色，并持久化权限调整。
 */
export function createProjectRoleService(adapter: ProjectRoleAdapter) {
  const currentSettings = ref<ProjectRoleSettings | null>(null)

  async function getSettings(projectId: string) {
    const result = await adapter.getSettings(projectId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function resetProjectData(projectId: string) {
    const result = await adapter.resetProjectData(projectId)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updatePermission(
    projectId: string,
    roleId: string,
    permissionKey: string,
    state: ProjectPermissionState,
  ) {
    const result = await adapter.updatePermission(projectId, roleId, permissionKey, state)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updateMenuPermission(
    projectId: string,
    roleId: string,
    menuKey: string,
    state: ProjectPermissionState,
  ) {
    const result = await adapter.updateMenuPermission(projectId, roleId, menuKey, state)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updateMenuActionPermission(
    projectId: string,
    roleId: string,
    menuKey: string,
    actionKey: string,
    state: ProjectPermissionState,
  ) {
    const result = await adapter.updateMenuActionPermission(projectId, roleId, menuKey, actionKey, state)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  async function updateMenuDataScope(
    projectId: string,
    roleId: string,
    menuKey: string,
    mode: ProjectRoleMenuDataScope,
  ) {
    const result = await adapter.updateMenuDataScope(projectId, roleId, menuKey, mode)
    if (result.ok) currentSettings.value = result.data
    return result
  }

  function subscribeSettings() {
    return readonly(currentSettings)
  }

  return {
    getSettings,
    resetProjectData,
    updatePermission,
    updateMenuPermission,
    updateMenuActionPermission,
    updateMenuDataScope,
    subscribeSettings,
  }
}

export const projectRoleService = createProjectRoleService(createProjectRoleMockAdapter())

